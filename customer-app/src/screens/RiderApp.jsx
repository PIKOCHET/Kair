import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { C, STATUS_CONFIG, CATALOG, fmt } from '../lib/constants';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const ALL_SVCS = Object.entries(CATALOG).map(([cat, items]) => ({ cat, items }));

// ── ITEM ENTRY ─────────────────────────────────────────────
function ItemEntry({ order, onDone, onBack }) {
  const [cart,   setCart]   = useState({}); // { serviceId: { ...svc, qty } }
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function add(svc) {
    setCart(p => ({ ...p, [svc.id]: { ...svc, qty: (p[svc.id]?.qty || 0) + 1 } }));
  }
  function change(id, d) {
    setCart(p => {
      const qty = (p[id]?.qty || 0) + d;
      if (qty <= 0) { const n = { ...p }; delete n[id]; return n; }
      return { ...p, [id]: { ...p[id], qty } };
    });
  }

  const items     = Object.values(cart);
  const totalPaise = items.reduce((s, i) => s + i.price_paise * i.qty, 0);
  const maxTat     = items.length > 0 ? Math.max(...items.map(i => i.tat_days)) : 0;
  const etaDate    = maxTat > 0 ? new Date(Date.now() + maxTat * 86400000) : null;

  async function save() {
    if (items.length === 0) { setError('Add at least one item'); return; }
    setSaving(true); setError('');
    try {
      const { error: ie } = await supabase.from('order_items').insert(
        items.map(i => ({ order_id:order.id, service_id:null, service_name:i.name, quantity:i.qty, price_paise:i.price_paise }))
      );
      if (ie) throw ie;

      await fetch(`${API}/api/orders/${order.id}/generate-tags`, { method:'POST' });

      await supabase.from('orders').update({
        total_paise:        totalPaise,
        estimated_delivery: etaDate?.toISOString().split('T')[0],
        items_confirmed:    true,
        status:             'in_cleaning',
      }).eq('id', order.id);

      onDone();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ background:C.cream, minHeight:'100vh', position:'relative' }}>
      <div style={{ background:C.navy, padding:'12px 16px', display:'flex', alignItems:'center', gap:'10px' }}>
        <button onClick={onBack} style={{ width:'28px', height:'28px', borderRadius:'50%', border:'1px solid rgba(255,255,255,0.15)', background:'transparent', color:'#fff', cursor:'pointer', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>←</button>
        <div>
          <div style={{ fontSize:'13px', fontWeight:700, color:'#fff' }}>Enter items — {order.order_number}</div>
          <div style={{ fontSize:'9px', color:'rgba(255,255,255,0.4)' }}>{order.customer?.full_name} · {order.address?.area}</div>
        </div>
      </div>

      <div style={{ padding:'10px 12px 100px' }}>
        {/* Selected summary */}
        {items.length > 0 && (
          <div style={{ background:'#fff', borderRadius:'12px', border:`1px solid ${C.border}`, padding:'12px', marginBottom:'10px' }}>
            <div style={{ fontSize:'9px', fontWeight:700, color:C.stone, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>Selected items</div>
            {items.map(item => (
              <div key={item.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                <div>
                  <div style={{ fontSize:'12px', fontWeight:600, color:C.navy }}>{item.emoji} {item.name}</div>
                  <div style={{ fontSize:'10px', color:C.stone }}>{fmt.rupees(item.price_paise)} {item.unit} · {item.tat_days}d TAT</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                  <button onClick={() => change(item.id,-1)} style={qtyBtn}>−</button>
                  <span style={{ fontSize:'13px', fontWeight:700, minWidth:'18px', textAlign:'center' }}>{item.qty}</span>
                  <button onClick={() => change(item.id, 1)} style={qtyBtn}>+</button>
                </div>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'8px', borderTop:`1px solid ${C.border}`, fontSize:'14px', fontWeight:700, marginTop:'4px' }}>
              <span>Total</span><span style={{ color:C.saffron }}>{fmt.rupees(totalPaise)}</span>
            </div>
            {etaDate && (
              <div style={{ background:C.infoBg, borderRadius:'8px', padding:'7px 10px', marginTop:'8px', fontSize:'10px', color:C.info, fontWeight:600 }}>
                📅 Est. delivery: {fmt.eta(maxTat)}
              </div>
            )}
          </div>
        )}

        {/* Service catalogue */}
        {ALL_SVCS.map(({ cat, items: svcs }) => (
          <div key={cat} style={{ background:'#fff', borderRadius:'12px', border:`1px solid ${C.border}`, padding:'12px', marginBottom:'8px' }}>
            <div style={{ fontSize:'9px', fontWeight:700, color:C.stone, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>{cat}</div>
            {svcs.map((svc, i) => {
              const inCart = cart[svc.id];
              return (
                <div key={svc.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:i<svcs.length-1?`1px solid ${C.linen}`:'none' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'12px', fontWeight:600, color:C.navy }}>{svc.emoji} {svc.name}</div>
                    <div style={{ fontSize:'10px', color:C.stone }}>{fmt.rupees(svc.price_paise)} {svc.unit} · {svc.tat_days}d</div>
                  </div>
                  {inCart ? (
                    <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                      <button onClick={() => change(svc.id,-1)} style={qtyBtn}>−</button>
                      <span style={{ fontSize:'12px', fontWeight:700, minWidth:'16px', textAlign:'center' }}>{inCart.qty}</span>
                      <button onClick={() => change(svc.id, 1)} style={qtyBtn}>+</button>
                    </div>
                  ) : (
                    <button onClick={() => add(svc)} style={{ width:'26px', height:'26px', borderRadius:'50%', background:C.saffron, border:'none', color:'#fff', fontSize:'17px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom confirm bar */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#fff', padding:'10px 12px', borderTop:`1px solid ${C.border}`, boxShadow:'0 -4px 20px rgba(0,0,0,0.08)' }}>
        {error && <p style={{ color:C.danger, fontSize:'11px', marginBottom:'6px', textAlign:'center' }}>{error}</p>}
        <button onClick={save} disabled={saving || items.length===0}
          style={{ width:'100%', padding:'13px', background:items.length>0?C.saffron:'#ccc', color:'#fff', border:'none', borderRadius:'11px', fontSize:'13px', fontWeight:700, cursor:items.length>0?'pointer':'default', fontFamily:'DM Sans, sans-serif' }}>
          {saving ? 'Saving...' : items.length>0 ? `Confirm ${items.reduce((s,i)=>s+i.qty,0)} items · ${fmt.rupees(totalPaise)}` : 'Add items above'}
        </button>
        <p style={{ textAlign:'center', fontSize:'9px', color:C.stone, marginTop:'5px' }}>Customer will be notified with item list + ETA</p>
      </div>
    </div>
  );
}

// ── RIDER DASHBOARD ────────────────────────────────────────
export default function RiderApp() {
  const { user, profile, signOut } = useAuth();
  const [orders,    setOrders]    = useState([]);
  const [tab,       setTab]       = useState('active');
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState('');
  const [itemEntry, setItemEntry] = useState(null);

  useEffect(() => {
    fetchOrders();
    const ch = supabase.channel('rider_orders')
      .on('postgres_changes', { event:'*', schema:'public', table:'orders' }, fetchOrders)
      .subscribe();
    const gps = setInterval(updateGPS, 30000); updateGPS();
    return () => { supabase.removeChannel(ch); clearInterval(gps); };
  }, [tab]);

  async function fetchOrders() {
    setLoading(true);
    const statuses = tab==='active'
      ? ['pending_pickup','rider_assigned','picked_up','in_cleaning','out_for_delivery']
      : ['delivered','cancelled'];

    let q = supabase.from('orders')
      .select('*, address:addresses(flat_no,area,city,landmark), items:order_items(service_name,quantity,price_paise), customer:profiles!orders_customer_id_fkey(full_name,phone)')
      .in('status', statuses)
      .order('created_at', { ascending:false });

    if (tab==='active') q = q.or(`rider_id.eq.${user.id},rider_id.is.null`);
    else q = q.eq('rider_id', user.id);

    const { data } = await q;
    setOrders(data || []);
    setLoading(false);
  }

  function updateGPS() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      fetch(`${API}/api/riders/${user.id}/location`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ lat:pos.coords.latitude, lng:pos.coords.longitude }) }).catch(()=>{});
    });
  }

 async function updateStatus(orderId, status, assignSelf) {
  const update = { status };
  if (assignSelf) update.rider_id = profile.id;
  if (status === 'picked_up') update.picked_up_at = new Date().toISOString();
  if (status === 'delivered') update.delivered_at = new Date().toISOString();

  const { error } = await supabase
    .from('orders')
    .update(update)
    .eq('id', orderId);

  if (error) {
    showToast('Error: ' + error.message);
  } else {
    showToast('Status updated ✓');
    fetchOrders();
  }
}

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  if (itemEntry) return (
    <ItemEntry order={itemEntry} onDone={() => { setItemEntry(null); fetchOrders(); showToast('Items saved — customer notified ✓'); }} onBack={() => setItemEntry(null)} />
  );

  const NEXT = {
    pending_pickup:   { label:'✅ Accept & assign to me', next:'rider_assigned', assignSelf:true },
    rider_assigned:   { label:'📦 Mark as picked up',    next:'picked_up' },
    picked_up:        { label:'🏭 Hand to facility',     next:'in_cleaning' },
    out_for_delivery: { label:'✅ Mark delivered',       next:'delivered' },
  };
  const STATUS_LABEL = {
    pending_pickup:   { text:'New pickup', color:C.saffron, bg:C.saffronLight },
    rider_assigned:   { text:'Go pickup',  color:C.saffron, bg:C.saffronLight },
    picked_up:        { text:'Picked up',  color:C.info,    bg:C.infoBg },
    in_cleaning:      { text:'At facility',color:C.info,    bg:C.infoBg },
    out_for_delivery: { text:'Delivering', color:C.saffron, bg:C.saffronLight },
    delivered:        { text:'Done ✓',    color:C.success, bg:C.successBg },
  };

  const stats = [
    { val: orders.filter(o=>!['delivered','cancelled'].includes(o.status)).length, lbl:'Active' },
    { val: orders.filter(o=>['pending_pickup','rider_assigned'].includes(o.status)).length, lbl:'Pending' },
    { val: orders.filter(o=>o.status==='delivered').length, lbl:'Done today' },
  ];

  return (
    <div style={{ fontFamily:'DM Sans, sans-serif', background:'#111827', minHeight:'100vh' }}>
      {/* Header */}
      <div style={{ background:C.navy, padding:'12px 14px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
          <div>
            <div style={{ fontSize:'13px', fontWeight:700, color:'#fff' }}>🏍️ {profile?.full_name || 'Rider'}</div>
            <div style={{ fontSize:'9px', color:'rgba(255,255,255,0.35)' }}>Pune · Online</div>
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <div style={{ background:'#065F46', borderRadius:'20px', padding:'3px 9px', fontSize:'9px', fontWeight:700, color:'#6EE7B7' }}>● Online</div>
            <button onClick={signOut} style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:'7px', padding:'5px 10px', color:'rgba(255,255,255,0.6)', fontSize:'11px', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>Sign out</button>
          </div>
        </div>
        <div style={{ display:'flex', background:'rgba(255,255,255,0.04)', borderRadius:'10px', overflow:'hidden' }}>
          {stats.map((s, i) => (
            <div key={s.lbl} style={{ flex:1, padding:'8px 4px', textAlign:'center', borderRight:i<2?'1px solid rgba(255,255,255,0.04)':'none' }}>
              <div style={{ fontSize:'20px', fontWeight:700, color:C.saffron }}>{s.val}</div>
              <div style={{ fontSize:'8px', color:'rgba(255,255,255,0.3)' }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', background:'#1F2937', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        {[['active','Active pickups'],['done','Completed']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ flex:1, padding:'11px', border:'none', background:'transparent', fontFamily:'DM Sans, sans-serif', fontSize:'12px', fontWeight:600, cursor:'pointer', color:tab===id?C.saffron:'rgba(255,255,255,0.4)', borderBottom:`2px solid ${tab===id?C.saffron:'transparent'}` }}>
            {label}
          </button>
        ))}
      </div>

      {/* Orders */}
      <div style={{ padding:'10px 12px 20px' }}>
        {loading && <div style={{ textAlign:'center', padding:'40px', color:'rgba(255,255,255,0.3)' }}>Loading...</div>}
        {!loading && orders.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px', color:'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize:'36px', marginBottom:'10px' }}>🎉</div>
            <p>No {tab==='active'?'active':'completed'} orders</p>
          </div>
        )}

        {orders.map(order => {
          const sl = STATUS_LABEL[order.status] || { text:order.status, color:C.stone, bg:C.linen };
          const nextAction = NEXT[order.status];
          const totalRs = order.total_paise > 0 ? fmt.rupees(order.total_paise) : 'TBD';
          const addr = [order.address?.flat_no, order.address?.area, order.address?.city].filter(Boolean).join(', ');

          return (
            <div key={order.id} style={{ background:'#1F2937', borderRadius:'14px', border:'1px solid rgba(255,255,255,0.06)', marginBottom:'10px', overflow:'hidden' }}>
              {/* Header */}
              <div style={{ background:'rgba(255,255,255,0.03)', padding:'9px 12px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                  <span style={{ fontFamily:'monospace', fontSize:'11px', fontWeight:700, background:'rgba(255,255,255,0.08)', color:'#fff', padding:'2px 7px', borderRadius:'4px' }}>{order.order_number}</span>
                  <span style={{ fontSize:'9px', fontWeight:700, padding:'3px 9px', borderRadius:'10px', background:sl.bg, color:sl.color }}>{sl.text}</span>
                  {order.pickup_type==='urgent' && <span style={{ fontSize:'9px', background:C.saffronLight, color:C.saffron, padding:'2px 7px', borderRadius:'8px', fontWeight:700 }}>⚡</span>}
                </div>
                <span style={{ fontSize:'13px', fontWeight:700, color:C.saffron }}>{totalRs}</span>
              </div>

              {/* Body */}
              <div style={{ padding:'10px 12px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                  <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:C.navy, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:700, flexShrink:0 }}>
                    {(order.customer?.full_name||'C')[0]}
                  </div>
                  <div>
                    <div style={{ fontSize:'12px', fontWeight:700, color:'#fff' }}>{order.customer?.full_name||'Customer'}</div>
                    <a href={`tel:${order.customer?.phone}`} style={{ fontSize:'11px', color:C.saffron, textDecoration:'none', fontWeight:600 }}>{order.customer?.phone}</a>
                  </div>
                </div>
                <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.55)', background:'rgba(255,255,255,0.04)', borderRadius:'7px', padding:'7px 9px', marginBottom:'8px' }}>
                  📍 {addr || '—'}
                  {order.address?.landmark && <span style={{ opacity:0.6 }}> · Near {order.address.landmark}</span>}
                </div>

                {/* Actions */}
                <div style={{ display:'flex', gap:'6px' }}>
                  {nextAction && (
                    <button onClick={() => updateStatus(order.id, nextAction.next, nextAction.assignSelf)}
                      style={{ flex:1, padding:'10px', background:C.saffron, color:'#fff', border:'none', borderRadius:'9px', fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                      {nextAction.label}
                    </button>
                  )}
                  {order.status==='picked_up' && !order.items_confirmed && (
                    <button onClick={() => setItemEntry({ ...order })}
                      style={{ flex:1, padding:'10px', background:C.navy, color:'#fff', border:'none', borderRadius:'9px', fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                      📋 Enter items
                    </button>
                  )}
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(addr)}`} target="_blank" rel="noreferrer"
                    style={{ padding:'10px 13px', background:'rgba(255,255,255,0.07)', border:'none', borderRadius:'9px', fontSize:'12px', color:'rgba(255,255,255,0.7)', textDecoration:'none', display:'flex', alignItems:'center' }}>
                    🗺️
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {toast && <div style={{ position:'fixed', bottom:'20px', left:'50%', transform:'translateX(-50%)', background:C.navy, color:'#fff', padding:'10px 18px', borderRadius:'10px', fontSize:'13px', fontWeight:500, zIndex:200, whiteSpace:'nowrap' }}>{toast}</div>}
    </div>
  );
}

const qtyBtn = { width:'26px', height:'26px', borderRadius:'50%', border:`1.5px solid ${C.saffron}`, background:'#fff', color:C.saffron, fontSize:'15px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 };
