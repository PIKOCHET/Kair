import React, { useState, useEffect } from 'react';
import { C, fmt, STATUS_CONFIG } from '../lib/constants';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// ── CHANNEL PARTNER HOME ──
function ChannelPartnerHome() {
  const { profile, user } = useAuth();
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
        const { data: partnerData } = await supabase
          .from('channel_partners')
          .select('*')
          .eq('profile_id', user.id)
          .single();
        setPartner(partnerData);

        if (partnerData?.id) {
          const { data: ordersData } = await supabase
            .from('orders')
            .select(`
              *,
              order_items(service_name, quantity, price_paise),
              profiles!customer_id(full_name, phone)
            `)
            .eq('channel_partner_id', partnerData.id)
            .eq('status', 'at_channel_partner')
            .order('created_at', { ascending: false });

          setOrders(ordersData || []);
          const received = ordersData?.length || 0;
          const commission = received * partnerData.commission_paise / 100;
          setStats({ received, commission });
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
            <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'52px', color:'#fff', fontWeight:400, lineHeight:1 }}>{stats.received}</div>
          </div>
          <div style={{ fontSize:'28px', opacity:0.2, textAlign:'right' }}>📦</div>
        </div>
        {/* Daily Commission */}
        <div style={{ background:C.linen, borderRadius:'16px', padding:'16px', minHeight:'160px', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:'10px', fontWeight:600, color:C.saffron, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Daily Commission (₹)</div>
            <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'52px', color:C.navy, fontWeight:400, lineHeight:1 }}>{Math.floor(stats.commission)}</div>
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
                    <div style={{ fontSize:'13px', color:C.stone, fontStyle:'italic', fontFamily:'DM Sans, sans-serif' }}>{order.profiles?.full_name} • {order.order_items?.length || 0} items</div>
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
              <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'24px', color:C.navy, fontWeight:400, minWidth:'40px', textAlign:'center' }}>{String(garmentCount[item.key]).padStart(2, '0')}</div>
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
        {[{ label:'Home', action:()=>{} }, { label:'Orders', action:()=>{} }, { label:'Account', action:()=>{} }].map(item => (
          <button key={item.label} onClick={item.action}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'5px', border:'none', background:'none', cursor:'pointer', fontFamily:'DM Sans, sans-serif', color:C.stone, fontSize:'11px', fontWeight:500 }}>
            {item.label === 'Home' && '🏠'}{item.label === 'Orders' && '📦'}{item.label === 'Account' && '👤'} {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChannelPartnerApp() {
  return <ChannelPartnerHome />;
}
