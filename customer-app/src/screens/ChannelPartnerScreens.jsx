import React, { useState, useEffect } from 'react';
import { C, fmt, STATUS_CONFIG } from '../lib/constants';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// ── CHANNEL PARTNER HOME ──
function ChannelPartnerHome() {
  const { profile, user } = useAuth();
  const [screen, setScreen] = useState('home');
  const [orders, setOrders] = useState([]);
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ received: 0, commission: 0 });
  const [garmentCount, setGarmentCount] = useState({ shirts: 0, trousers: 0, sarees: 0, dryClean: 0, shoes: 0 });

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);

        // 1. Fetch the channel_partners record for this logged-in user
        const { data: cpData, error: cpError } = await supabase
          .from('channel_partners')
          .select('*')
          .eq('profile_id', user.id)
          .single();

        console.log('CP Data:', cpData);
        if (cpError) console.error('CP fetch error:', cpError);

        setPartner(cpData);

        if (cpData?.id) {
          // 2. Fetch orders dropped at this collection point
          const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select(`
              *,
              customer:profiles!orders_customer_id_fkey(full_name, phone),
              items:order_items(id, service_name, quantity, price_paise)
            `)
            .eq('channel_partner_id', cpData.id)
            .eq('status', 'at_channel_partner')
            .order('at_partner_at', { ascending: false });

          console.log('Orders:', ordersData);
          if (ordersError) console.error('Orders fetch error:', ordersError);
          setOrders(ordersData || []);

          // 3. Bags pending — independent count query
          const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('channel_partner_id', cpData.id)
            .eq('status', 'at_channel_partner');

          // 4. Daily commission — sum of today's partner_transactions
          const { data: txns } = await supabase
            .from('partner_transactions')
            .select('commission_paise')
            .eq('channel_partner_id', cpData.id)
            .gte('created_at', new Date().toISOString().split('T')[0]);

          const commissionPaise = txns?.reduce((sum, t) => sum + (t.commission_paise || 0), 0) || 0;
          setStats({ received: count || 0, commission: commissionPaise / 100 });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:C.cream }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:'48px', marginBottom:'16px' }}>📍</div>
          <div style={{ fontSize:'12px', color:C.stone }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (screen === 'account') return (
    <AccountScreen user={user} profile={profile} partner={partner} onBack={() => setScreen('home')} />
  );

  return (
    <div style={{ minHeight:'100vh', background:C.cream, paddingBottom:'100px' }}>
      {/* Luxury Header */}
      <div style={{ background:C.navy, color:'white', padding:'14px 20px' }}>
        <button style={{ width:'36px', height:'36px', borderRadius:'8px', border:'none', background:'rgba(255,255,255,0.1)', color:'#fff', cursor:'pointer', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'12px' }}>☰</button>
        <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:'9px', fontWeight:600, color:C.gold, letterSpacing:'3px', textTransform:'uppercase' }}>Partner</div>
        <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'28px', color:'#fff', fontWeight:400 }}>Concierge</div>
      </div>

      {/* Hero Bento Grid */}
      <div style={{ padding:'20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'20px' }}>
        {/* Bags Pending */}
        <div style={{ background:C.navy, borderRadius:'16px', padding:'16px', minHeight:'160px', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:'10px', fontWeight:600, color:C.gold, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Bags Pending</div>
            <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:'52px', color:'#fff', fontWeight:700, lineHeight:1 }}>{stats.received}</div>
          </div>
          <div style={{ fontSize:'28px', opacity:0.2, textAlign:'right' }}>📦</div>
        </div>
        {/* Daily Commission */}
        <div style={{ background:C.linen, borderRadius:'16px', padding:'16px', minHeight:'160px', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:'10px', fontWeight:600, color:C.saffron, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Daily Commission (₹)</div>
            <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:'52px', color:C.navy, fontWeight:700, lineHeight:1 }}>{Math.floor(stats.commission)}</div>
          </div>
          <div style={{ fontSize:'28px', opacity:0.2, textAlign:'right' }}>💰</div>
        </div>
      </div>

      {/* Active Handover Section */}
      <div style={{ padding:'0 20px', marginBottom:'20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'12px' }}>
          <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'24px', color:C.navy, fontWeight:400 }}>Active Handover</div>
          <div style={{ fontSize:'10px', color:C.saffron, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase' }}>VIEW ALL</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {orders.length === 0 ? (
            <div style={{ background:'white', borderRadius:'14px', padding:'24px', textAlign:'center', color:C.stone, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:'28px', marginBottom:'8px' }}>📦</div>
              <div style={{ fontSize:'12px' }}>No orders at this location yet.</div>
            </div>
          ) : (
            orders.map(order => (
              <div key={order.id} style={{ background:'white', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px' }}>
                  <div style={{ width:'48px', height:'48px', borderRadius:'50%', background:C.linen, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', flexShrink:0 }}>👕</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'16px', fontWeight:700, color:C.navy, fontFamily:'DM Sans, sans-serif' }}>{order.order_number}</div>
                    <div style={{ fontSize:'13px', color:C.stone, fontStyle:'italic', fontFamily:'DM Sans, sans-serif' }}>{order.customer?.full_name} • {order.items?.length || 0} items</div>
                  </div>
                  <div style={{ background:C.teal, color:'#fff', fontSize:'10px', fontWeight:700, padding:'4px 10px', borderRadius:'20px' }}>Arrived</div>
                </div>
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
        <button style={{ width:'100%', background:C.saffron, color:'#fff', border:'none', borderRadius:'26px', padding:'12px 20px', marginTop:'16px', fontSize:'12px', fontWeight:700, letterSpacing:'3px', textTransform:'uppercase', cursor:'pointer', fontFamily:'DM Sans, sans-serif', height:'52px' }}>
          Confirm Batch Handover →
        </button>
      </div>

      {/* Mood Image */}
      <div style={{ margin:'0 20px', borderRadius:'16px', minHeight:'192px', background:C.navy, backgroundImage:'linear-gradient(180deg, rgba(13,27,62,0.7) 0%, rgba(13,27,62,0.95) 100%)', display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'20px', marginBottom:'20px' }}>
        <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'24px', color:'#fff', fontStyle:'italic', textAlign:'center' }}>Quality is the soul of luxury.</div>
      </div>

      {/* Bottom Nav */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:C.cream, borderTop:`1px solid ${C.border}`, display:'flex', zIndex:100, maxWidth:'480px', margin:'0 auto', height:'70px' }}>
        {[{ label:'Home', action:() => setScreen('home') }, { label:'Orders', action:() => {} }, { label:'Account', action:() => setScreen('account') }].map(item => (
          <button key={item.label} onClick={item.action}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'5px', border:'none', background:'none', cursor:'pointer', fontFamily:'DM Sans, sans-serif', color:screen===item.label.toLowerCase()?C.saffron:C.stone, fontSize:'11px', fontWeight:500 }}>
            {item.label === 'Home' && '🏠'}{item.label === 'Orders' && '📦'}{item.label === 'Account' && '👤'} {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── ACCOUNT SCREEN ──
function AccountScreen({ user, profile, partner, onBack }) {
  return (
    <div style={{ minHeight:'100vh', background:C.cream, paddingBottom:'40px' }}>
      <div style={{ background:C.navy, padding:'14px 20px 20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
          <button onClick={onBack} style={{ width:'36px', height:'36px', borderRadius:'50%', border:'1px solid rgba(255,255,255,0.2)', background:'transparent', cursor:'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'16px' }}>←</button>
          <span style={{ fontSize:'15px', fontWeight:700, color:'#fff', fontFamily:'DM Sans, sans-serif' }}>Account</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
          <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:C.saffron, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'24px', fontWeight:700, color:'#fff', fontFamily:'DM Sans, sans-serif' }}>
            {profile?.full_name?.charAt(0)?.toUpperCase() || '👤'}
          </div>
          <div>
            <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'20px', color:'#fff', fontWeight:400 }}>{profile?.full_name || '—'}</div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.5)', marginTop:'2px' }}>{user?.email}</div>
            {profile?.phone && <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.5)' }}>{profile.phone}</div>}
          </div>
        </div>
      </div>

      <div style={{ padding:'16px 20px' }}>
        <div style={{ background:'#fff', borderRadius:'16px', border:`1px solid ${C.border}`, padding:'16px', marginBottom:'12px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize:'12px', fontWeight:700, color:C.navy, marginBottom:'12px', fontFamily:'DM Sans, sans-serif' }}>📍 Collection Point</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            <div>
              <div style={{ fontSize:'10px', color:C.stone, fontFamily:'DM Sans, sans-serif' }}>Name</div>
              <div style={{ fontSize:'13px', fontWeight:600, color:C.navy, fontFamily:'DM Sans, sans-serif' }}>{partner?.name || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize:'10px', color:C.stone, fontFamily:'DM Sans, sans-serif' }}>Area</div>
              <div style={{ fontSize:'13px', fontWeight:600, color:C.navy, fontFamily:'DM Sans, sans-serif' }}>{partner?.area || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize:'10px', color:C.stone, fontFamily:'DM Sans, sans-serif' }}>Commission Rate</div>
              <div style={{ fontSize:'13px', fontWeight:700, color:C.teal, fontFamily:'DM Sans, sans-serif' }}>{fmt.rupees(partner?.commission_paise || 2500)} per order</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding:'0 20px' }}>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ width:'100%', padding:'14px', border:`1.5px solid ${C.danger}`, borderRadius:'12px', background:'#fff', fontSize:'14px', fontWeight:700, color:C.danger, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function ChannelPartnerApp() {
  return <ChannelPartnerHome />;
}
