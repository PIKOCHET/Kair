import React, { useState, useEffect } from 'react';
import { C, fmt, STATUS_CONFIG } from '../lib/constants';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// Relative time: "2 hours ago"
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

// Partner-facing journey badges
const JOURNEY_BADGE = {
  at_channel_partner:     { label: 'With you',          bg: C.tealLight,    color: C.teal },
  in_transit_to_workshop: { label: 'Sent to workshop',  bg: '#FEF3E2',      color: '#D97706' },
  delivered:              { label: 'Completed journey', bg: C.successBg,    color: C.success },
};

// ── CHANNEL PARTNER APP ──
function ChannelPartnerHome() {
  const { profile, user } = useAuth();
  const [tab, setTab] = useState('today'); // today | orders | earnings | account
  const [orders, setOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [earnTxns, setEarnTxns] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('all'); // all | pending | completed
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [stats, setStats] = useState({ pending: 0, todayReceived: 0, todayDispatched: 0, todayCommission: 0 });
  const [garmentCount, setGarmentCount] = useState({ shirts: 0, trousers: 0, sarees: 0, dryClean: 0, shoes: 0 });
  const [handingOver, setHandingOver] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [toast, setToast] = useState('');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  const fetchData = async () => {
    if (!user?.id) return;
    try {
      setErrorMsg('');

      // 1. channel_partners record for this logged-in user (auth.uid → profiles.id → channel_partners.profile_id)
      const { data: cpData, error: cpError } = await supabase
        .from('channel_partners')
        .select('*')
        .eq('profile_id', user.id)
        .maybeSingle();

      console.log('Channel Partner record:', cpData, cpError);
      if (cpError || !cpData) {
        setErrorMsg(cpError ? 'Something went wrong loading your collection point. Pull to refresh.' : 'No collection point is linked to this account yet. Please contact Kair ops.');
        setLoading(false);
        return;
      }
      setPartner(cpData);

      const todayStart = new Date().toISOString().split('T')[0];

      // 2. Orders currently with this partner — 3. today's transactions — 4. full history — in parallel
      const [activeRes, txnRes, historyRes, allEarnRes] = await Promise.all([
        supabase.from('orders')
          .select('*, customer:profiles!orders_customer_id_fkey(full_name, phone), items:order_items(id, service_name, quantity, price_paise)')
          .eq('channel_partner_id', cpData.id)
          .eq('status', 'at_channel_partner')
          .order('at_partner_at', { ascending: false }),
        supabase.from('partner_transactions')
          .select('type, commission_paise, created_at')
          .eq('channel_partner_id', cpData.id)
          .gte('created_at', todayStart),
        supabase.from('partner_transactions')
          .select('*, order:orders(order_number, status, customer_id, created_at, customer:profiles!orders_customer_id_fkey(full_name))')
          .eq('channel_partner_id', cpData.id)
          .eq('type', 'received')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('partner_transactions')
          .select('commission_paise, created_at')
          .eq('channel_partner_id', cpData.id)
          .eq('type', 'received'),
      ]);

      console.log('Orders:', activeRes.data, activeRes.error);
      if (activeRes.error) console.error('Orders fetch error:', activeRes.error);
      setOrders(activeRes.data || []);
      setHistory(historyRes.data || []);
      setEarnTxns(allEarnRes.data || []);

      const txns = txnRes.data || [];
      setStats({
        pending: activeRes.data?.length || 0,
        todayReceived: txns.filter(t => t.type === 'received').length,
        todayDispatched: txns.filter(t => t.type === 'dispatched').length,
        todayCommission: txns.filter(t => t.type === 'received').reduce((s, t) => s + (t.commission_paise || 0), 0) / 100,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      setErrorMsg('Something went wrong. Pull to refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Realtime — new drops appear without a refresh
    const ch = supabase.channel('partner_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user?.id]);

  // Hand all pending bags to the batch rider: at_channel_partner → in_transit_to_workshop
  async function confirmBatchHandover() {
    if (!partner?.id || orders.length === 0 || handingOver) return;
    setHandingOver(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'in_transit_to_workshop', collected_by_batch_at: new Date().toISOString() })
        .eq('channel_partner_id', partner.id)
        .eq('status', 'at_channel_partner');
      if (error) { console.error('Handover error:', error); showToast('Handover failed — please try again'); return; }

      // Dispatched transactions (commission already earned on receive) + customer notifications
      await supabase.from('partner_transactions').insert(orders.map(o => ({
        channel_partner_id: partner.id, order_id: o.id, type: 'dispatched', commission_paise: 0,
      })));
      await supabase.from('notifications').insert(orders.map(o => ({
        user_id: o.customer_id, order_id: o.id, type: 'in_transit_to_workshop',
        title: 'Heading to workshop 🚐',
        message: `${o.order_number}: Your clothes are on their way to our workshop for overnight care.`,
        is_read: false,
      })));

      showToast(`${orders.length} order${orders.length > 1 ? 's' : ''} handed over ✓`);
      setGarmentCount({ shirts: 0, trousers: 0, sarees: 0, dryClean: 0, shoes: 0 });
      fetchData();
    } finally {
      setHandingOver(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:C.cream }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:'48px', marginBottom:'16px' }}>📍</div>
          <div style={{ fontSize:'12px', color:C.stone }}>Loading your concierge...</div>
        </div>
      </div>
    );
  }

  // ── Earnings math (grouped in JS) ──
  const now = new Date();
  const weekDays = [...Array(7)].map((_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
  const byDay = weekDays.map(day => ({
    day,
    label: new Date(day).toLocaleDateString('en-IN', { weekday: 'short' }),
    paise: earnTxns.filter(t => t.created_at?.startsWith(day)).reduce((s, t) => s + (t.commission_paise || 0), 0),
  }));
  const weekPaise = byDay.reduce((s, d) => s + d.paise, 0);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthPaise = earnTxns.filter(t => t.created_at?.startsWith(monthStart)).reduce((s, t) => s + (t.commission_paise || 0), 0);
  const allTimePaise = earnTxns.reduce((s, t) => s + (t.commission_paise || 0), 0);
  const maxDay = Math.max(...byDay.map(d => d.paise), 1);

  const filteredHistory = history.filter(h => {
    if (historyFilter === 'pending') return h.order?.status === 'at_channel_partner';
    if (historyFilter === 'completed') return h.order?.status !== 'at_channel_partner';
    return true;
  });

  return (
    <div style={{ minHeight:'100vh', background:C.cream, paddingBottom:'100px' }}>
      {/* Luxury Header */}
      <div style={{ background:C.navy, color:'white', padding:'14px 20px' }}>
        <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:'9px', fontWeight:600, color:C.gold, letterSpacing:'3px', textTransform:'uppercase', marginTop:'8px' }}>Partner</div>
        <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'28px', color:'#fff', fontWeight:400 }}>Concierge</div>
        <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.5)', marginTop:'2px', fontFamily:'DM Sans, sans-serif' }}>{partner?.name} · {partner?.area}</div>
      </div>

      {errorMsg && (
        <div style={{ margin:'16px 20px 0', background:C.dangerBg, color:C.danger, borderRadius:'12px', padding:'14px', fontSize:'12px', fontWeight:600, fontFamily:'DM Sans, sans-serif' }}>
          {errorMsg}
        </div>
      )}

      {/* ── TODAY TAB ── */}
      {tab === 'today' && !errorMsg && (
        <>
          {/* Hero Bento Grid */}
          <div style={{ padding:'20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div style={{ background:C.navy, borderRadius:'16px', padding:'16px', minHeight:'150px', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:'10px', fontWeight:600, color:C.gold, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Bags Pending</div>
                <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:'52px', color:'#fff', fontWeight:700, lineHeight:1 }}>{stats.pending}</div>
              </div>
              <div style={{ fontSize:'28px', opacity:0.2, textAlign:'right' }}>📦</div>
            </div>
            <div style={{ background:C.linen, borderRadius:'16px', padding:'16px', minHeight:'150px', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:'10px', fontWeight:600, color:C.saffron, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Today's Commission (₹)</div>
                <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:'52px', color:C.navy, fontWeight:700, lineHeight:1 }}>{Math.floor(stats.todayCommission)}</div>
              </div>
              <div style={{ fontSize:'28px', opacity:0.2, textAlign:'right' }}>💰</div>
            </div>
          </div>

          {/* Today strip */}
          <div style={{ padding:'0 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'20px' }}>
            <div style={{ background:'#fff', borderRadius:'12px', border:`1px solid ${C.border}`, padding:'12px', textAlign:'center' }}>
              <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:'22px', fontWeight:700, color:C.teal }}>{stats.todayReceived}</div>
              <div style={{ fontSize:'10px', color:C.stone }}>Received today</div>
            </div>
            <div style={{ background:'#fff', borderRadius:'12px', border:`1px solid ${C.border}`, padding:'12px', textAlign:'center' }}>
              <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:'22px', fontWeight:700, color:'#D97706' }}>{stats.todayDispatched}</div>
              <div style={{ fontSize:'10px', color:C.stone }}>Handed over today</div>
            </div>
          </div>

          {/* Active Handover */}
          <div style={{ padding:'0 20px', marginBottom:'20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'12px' }}>
              <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'24px', color:C.navy, fontWeight:400 }}>Active Handover</div>
              <button onClick={() => setTab('orders')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'10px', color:C.saffron, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', fontFamily:'DM Sans, sans-serif' }}>VIEW ALL</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {orders.length === 0 ? (
                <div style={{ background:'white', borderRadius:'14px', padding:'24px', textAlign:'center', color:C.stone, border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:'28px', marginBottom:'8px' }}>📦</div>
                  <div style={{ fontSize:'12px' }}>No bags waiting right now. New drops appear here instantly.</div>
                </div>
              ) : (
                orders.map(order => (
                  <div key={order.id} onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                    style={{ background:'white', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', cursor:'pointer' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                      <div style={{ width:'48px', height:'48px', borderRadius:'50%', background:C.linen, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', flexShrink:0 }}>👕</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'16px', fontWeight:700, color:C.navy, fontFamily:'DM Sans, sans-serif' }}>{order.order_number}</div>
                        <div style={{ fontSize:'13px', color:C.stone, fontStyle:'italic', fontFamily:'DM Sans, sans-serif' }}>{order.customer?.full_name} • {order.items?.length || 0} items</div>
                        <div style={{ fontSize:'10px', color:C.stone, marginTop:'2px' }}>Received {timeAgo(order.at_partner_at)}</div>
                      </div>
                      <div style={{ background:C.teal, color:'#fff', fontSize:'10px', fontWeight:700, padding:'4px 10px', borderRadius:'20px' }}>Arrived</div>
                    </div>
                    {expandedOrder === order.id && (
                      <div style={{ borderTop:`1px solid ${C.linen}`, marginTop:'12px', paddingTop:'10px' }}>
                        {order.items?.length > 0 ? order.items.map((item, i) => (
                          <div key={item.id || i} style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:C.navy, marginBottom:'4px' }}>
                            <span>{item.quantity}× {item.service_name}</span>
                            <span style={{ fontFamily:'DM Sans, sans-serif', fontWeight:700, color:C.saffron }}>{fmt.rupees(item.price_paise * item.quantity)}</span>
                          </div>
                        )) : <div style={{ fontSize:'11px', color:C.stone }}>No item details yet</div>}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Garment Count */}
          <div style={{ margin:'0 20px', background:C.linen, borderRadius:'16px', padding:'20px', marginBottom:'20px' }}>
            <div style={{ fontSize:'16px', fontWeight:700, color:C.navy, fontFamily:'DM Sans, sans-serif', marginBottom:'16px', display:'flex', alignItems:'center', gap:'8px' }}>👔 Quick Garment Count</div>
            {[
              { key:'shirts', label:'Shirts' },
              { key:'trousers', label:'Trousers' },
              { key:'sarees', label:'Silk Sarees' },
              { key:'dryClean', label:'Dry Clean' },
              { key:'shoes', label:'Shoes' }
            ].map(item => (
              <div key={item.key} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 0', justifyContent:'space-between' }}>
                <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'18px', color:C.navy, fontStyle:'italic' }}>{item.label}</div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <button onClick={() => setGarmentCount({...garmentCount, [item.key]: Math.max(0, garmentCount[item.key] - 1)})}
                    style={{ width:'40px', height:'40px', borderRadius:'50%', border:`1.5px solid ${C.stone}`, background:'#fff', cursor:'pointer', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                  <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:'24px', color:C.navy, fontWeight:700, minWidth:'40px', textAlign:'center' }}>{String(garmentCount[item.key]).padStart(2, '0')}</div>
                  <button onClick={() => setGarmentCount({...garmentCount, [item.key]: garmentCount[item.key] + 1})}
                    style={{ width:'40px', height:'40px', borderRadius:'50%', border:`1.5px solid ${C.stone}`, background:'#fff', cursor:'pointer', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                </div>
              </div>
            ))}
            <button onClick={confirmBatchHandover} disabled={orders.length === 0 || handingOver}
              style={{ width:'100%', background:orders.length === 0 ? '#D8D2C7' : C.saffron, color:'#fff', border:'none', borderRadius:'26px', padding:'12px 20px', marginTop:'16px', fontSize:'12px', fontWeight:700, letterSpacing:'3px', textTransform:'uppercase', cursor:orders.length === 0 ? 'not-allowed' : 'pointer', fontFamily:'DM Sans, sans-serif', height:'52px', opacity:handingOver ? 0.7 : 1 }}>
              {handingOver ? 'Handing over...' : orders.length === 0 ? 'No bags to hand over' : `Confirm Batch Handover (${orders.length}) →`}
            </button>
          </div>

          {/* Mood Image */}
          <div style={{ margin:'0 20px', borderRadius:'16px', minHeight:'192px', background:C.navy, backgroundImage:'linear-gradient(180deg, rgba(13,27,62,0.7) 0%, rgba(13,27,62,0.95) 100%)', display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'20px', marginBottom:'20px' }}>
            <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'24px', color:'#fff', fontStyle:'italic', textAlign:'center' }}>Quality is the soul of luxury.</div>
          </div>
        </>
      )}

      {/* ── ORDERS TAB (full history) ── */}
      {tab === 'orders' && (
        <div style={{ padding:'20px' }}>
          <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'24px', color:C.navy, fontWeight:400, marginBottom:'14px' }}>Order History</div>
          <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
            {[['all','All'],['pending','Pending'],['completed','Completed']].map(([f, label]) => (
              <button key={f} onClick={() => setHistoryFilter(f)}
                style={{ padding:'7px 16px', borderRadius:'20px', border:`1.5px solid ${historyFilter===f?C.navy:C.border}`, background:historyFilter===f?C.navy:'#fff', color:historyFilter===f?'#fff':C.stone, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                {label}
              </button>
            ))}
          </div>
          {filteredHistory.length === 0 ? (
            <div style={{ background:'white', borderRadius:'14px', padding:'32px 20px', textAlign:'center', color:C.stone, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:'28px', marginBottom:'8px' }}>🗂️</div>
              <div style={{ fontSize:'12px' }}>Orders you handle will appear here.</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {filteredHistory.map(txn => {
                const badge = JOURNEY_BADGE[txn.order?.status] || { label: STATUS_CONFIG[txn.order?.status]?.label || txn.order?.status, bg: C.linen, color: C.stone };
                return (
                  <div key={txn.id} style={{ background:'white', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'14px 16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
                      <div>
                        <div style={{ fontSize:'14px', fontWeight:700, color:C.navy, fontFamily:'DM Sans, sans-serif' }}>{txn.order?.order_number || '—'}</div>
                        <div style={{ fontSize:'11px', color:C.stone, fontStyle:'italic' }}>{txn.order?.customer?.full_name || 'Customer'}</div>
                      </div>
                      <span style={{ fontSize:'10px', fontWeight:700, padding:'4px 10px', borderRadius:'20px', background:badge.bg, color:badge.color }}>{badge.label}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:C.stone }}>
                      <span>{new Date(txn.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' })} · {timeAgo(txn.created_at)}</span>
                      <span style={{ fontFamily:'DM Sans, sans-serif', fontWeight:700, color:C.teal }}>+{fmt.rupees(txn.commission_paise || 0)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── EARNINGS TAB ── */}
      {tab === 'earnings' && (
        <div style={{ padding:'20px' }}>
          <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'24px', color:C.navy, fontWeight:400, marginBottom:'14px' }}>Earnings</div>
          {earnTxns.length === 0 ? (
            <div style={{ background:'white', borderRadius:'14px', padding:'32px 20px', textAlign:'center', color:C.stone, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:'28px', marginBottom:'8px' }}>💰</div>
              <div style={{ fontSize:'12px' }}>Commissions appear here after your first handover.</div>
            </div>
          ) : (
            <>
              {/* Week bar chart — simple divs */}
              <div style={{ background:'#fff', borderRadius:'16px', border:`1px solid ${C.border}`, padding:'16px', marginBottom:'12px' }}>
                <div style={{ fontSize:'11px', fontWeight:700, color:C.stone, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'14px' }}>This Week · <span style={{ color:C.teal, fontFamily:'DM Sans, sans-serif' }}>{fmt.rupees(weekPaise)}</span></div>
                <div style={{ display:'flex', alignItems:'flex-end', gap:'8px', height:'90px' }}>
                  {byDay.map(d => (
                    <div key={d.day} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', height:'100%', justifyContent:'flex-end' }}>
                      <div style={{ width:'100%', borderRadius:'6px 6px 0 0', background:d.paise > 0 ? C.teal : C.linen, height:`${Math.max((d.paise / maxDay) * 70, 4)}px`, transition:'height 0.3s' }} />
                      <div style={{ fontSize:'9px', color:C.stone }}>{d.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                <div style={{ background:C.navy, borderRadius:'14px', padding:'16px' }}>
                  <div style={{ fontSize:'10px', color:C.gold, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>This Month</div>
                  <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:'24px', fontWeight:700, color:'#fff' }}>{fmt.rupees(monthPaise)}</div>
                </div>
                <div style={{ background:C.linen, borderRadius:'14px', padding:'16px' }}>
                  <div style={{ fontSize:'10px', color:C.saffron, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>All Time</div>
                  <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:'24px', fontWeight:700, color:C.navy }}>{fmt.rupees(allTimePaise)}</div>
                </div>
              </div>
              <div style={{ background:'#fff', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:'12px', fontWeight:700, color:C.navy }}>Commission rate</div>
                  <div style={{ fontSize:'10px', color:C.stone }}>Earned on every bag received</div>
                </div>
                <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:'18px', fontWeight:700, color:C.teal }}>{fmt.rupees(partner?.commission_paise || 2500)}</div>
              </div>
              <div style={{ marginTop:'12px', fontSize:'11px', color:C.stone, textAlign:'center', fontStyle:'italic' }}>Settlements are processed weekly by Kair ops.</div>
            </>
          )}
        </div>
      )}

      {/* ── ACCOUNT TAB ── */}
      {tab === 'account' && (
        <div>
          <div style={{ padding:'20px 20px 0', display:'flex', alignItems:'center', gap:'14px', marginBottom:'8px' }}>
            <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:C.saffron, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'24px', fontWeight:700, color:'#fff', fontFamily:'DM Sans, sans-serif' }}>
              {profile?.full_name?.charAt(0)?.toUpperCase() || '👤'}
            </div>
            <div>
              <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'20px', color:C.navy, fontWeight:400 }}>{profile?.full_name || '—'}</div>
              <div style={{ fontSize:'11px', color:C.stone, marginTop:'2px' }}>{user?.email}</div>
              {profile?.phone && <div style={{ fontSize:'11px', color:C.stone }}>{profile.phone}</div>}
            </div>
          </div>
          <div style={{ padding:'16px 20px' }}>
            <div style={{ background:'#fff', borderRadius:'16px', border:`1px solid ${C.border}`, padding:'16px', marginBottom:'12px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:'12px', fontWeight:700, color:C.navy, marginBottom:'12px', fontFamily:'DM Sans, sans-serif' }}>📍 Collection Point</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                <div>
                  <div style={{ fontSize:'10px', color:C.stone }}>Name</div>
                  <div style={{ fontSize:'13px', fontWeight:600, color:C.navy }}>{partner?.name || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize:'10px', color:C.stone }}>Area</div>
                  <div style={{ fontSize:'13px', fontWeight:600, color:C.navy }}>{partner?.area || '—'}{partner?.city ? `, ${partner.city}` : ''}</div>
                </div>
                <div>
                  <div style={{ fontSize:'10px', color:C.stone }}>Commission Rate</div>
                  <div style={{ fontSize:'13px', fontWeight:700, color:C.teal, fontFamily:'DM Sans, sans-serif' }}>{fmt.rupees(partner?.commission_paise || 2500)} per order</div>
                </div>
              </div>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{ width:'100%', padding:'14px', border:`1.5px solid ${C.danger}`, borderRadius:'12px', background:'#fff', fontSize:'14px', fontWeight:700, color:C.danger, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Bottom Nav — 4 tabs */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:C.cream, borderTop:`1px solid ${C.border}`, display:'flex', zIndex:100, maxWidth:'480px', margin:'0 auto', height:'70px' }}>
        {[
          { id:'today',    label:'Home',     icon:'🏠' },
          { id:'orders',   label:'Orders',   icon:'📦' },
          { id:'earnings', label:'Earnings', icon:'💰' },
          { id:'account',  label:'Account',  icon:'👤' },
        ].map(item => (
          <button key={item.id} onClick={() => setTab(item.id)}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'4px', border:'none', background:'none', cursor:'pointer', fontFamily:'DM Sans, sans-serif', color:tab===item.id?C.saffron:C.stone, fontSize:'11px', fontWeight:tab===item.id?700:500 }}>
            <span style={{ fontSize:'18px' }}>{item.icon}</span>{item.label}
          </button>
        ))}
      </div>

      {toast && (
        <div style={{ position:'fixed', bottom:'84px', left:'50%', transform:'translateX(-50%)', background:C.navy, color:'#fff', padding:'10px 18px', borderRadius:'10px', fontSize:'13px', fontWeight:500, zIndex:200, whiteSpace:'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

export default function ChannelPartnerApp() {
  return <ChannelPartnerHome />;
}
