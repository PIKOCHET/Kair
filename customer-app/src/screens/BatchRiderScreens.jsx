import React, { useState, useEffect } from 'react';
import { C, fmt, STATUS_CONFIG } from '../lib/constants';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// ── BATCH RIDER HOME ──
function BatchRiderHome() {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState('route');
  const [partners, setPartners] = useState([]);
  const [collectedPartners, setCollectedPartners] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, partners: 0, collected: 0 });
  const [route, setRoute] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch today's batch route and channel partners
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);

        // Fetch all channel partners
        const { data: partnersData } = await supabase
          .from('channel_partners')
          .select('*')
          .eq('is_active', true)
          .order('area');

        if (partnersData) {
          // Fetch orders at each partner for today
          const partnersWithOrders = await Promise.all(
            partnersData.map(async (partner) => {
              const { data: ordersData } = await supabase
                .from('orders')
                .select('id')
                .eq('channel_partner_id', partner.id)
                .eq('status', 'at_channel_partner')
                .gte('created_at', new Date().toISOString().split('T')[0]);

              return {
                ...partner,
                orderCount: ordersData?.length || 0
              };
            })
          );

          setPartners(partnersWithOrders);

          // Calculate stats
          const total = partnersWithOrders.reduce((sum, p) => sum + p.orderCount, 0);
          setStats({
            total,
            partners: partnersWithOrders.length,
            collected: 0
          });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

  const handleCollectedFromPartner = async (partnerId, partnerName) => {
    try {
      const newCollected = new Set(collectedPartners);
      newCollected.add(partnerId);
      setCollectedPartners(newCollected);

      // Update orders status to in_transit_to_workshop
      const { error } = await supabase
        .from('orders')
        .update({
          batch_rider_id: user.id,
          status: 'in_transit_to_workshop',
          collected_by_batch_at: new Date().toISOString()
        })
        .eq('channel_partner_id', partnerId)
        .eq('status', 'at_channel_partner');

      if (!error) {
        // Update stats
        setStats(prev => ({
          ...prev,
          collected: prev.collected + (partners.find(p => p.id === partnerId)?.orderCount || 0)
        }));
      }
    } catch (error) {
      console.error('Error updating orders:', error);
    }
  };

  const handleDeliveredToPartner = async (partnerId) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'dispatched_to_partner',
          dispatched_to_partner_at: new Date().toISOString()
        })
        .eq('channel_partner_id', partnerId)
        .eq('status', 'in_transit_to_workshop')
        .eq('batch_rider_id', user.id);

      if (!error) {
        alert('✓ Delivered to ' + partnerId);
      }
    } catch (error) {
      console.error('Error updating delivery:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:C.cream }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:'48px', marginBottom:'16px' }}>🚐</div>
          <div style={{ fontSize:'12px', color:C.stone }}>Loading route...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:C.cream, paddingBottom:'100px' }}>
      {/* Luxury Dark Header */}
      <div style={{ background:'#0A1628', padding:'14px 20px' }}>
        <button style={{ width:'36px', height:'36px', borderRadius:'8px', border:'none', background:'rgba(255,255,255,0.1)', color:'#fff', cursor:'pointer', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'12px' }}>☰</button>
        <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'20px', color:'#fff', fontWeight:400, letterSpacing:'3px', textTransform:'uppercase' }}>Logistics Elite</div>
      </div>

      {/* Hero Route Card */}
      <div style={{ margin:'20px', background:C.navy, borderRadius:'20px', padding:'20px' }}>
        <div style={{ fontSize:'9px', fontWeight:600, color:C.gold, textTransform:'uppercase', letterSpacing:'2px', marginBottom:'12px' }}>Ongoing Shift</div>
        <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'32px', color:'#fff', fontWeight:400, marginBottom:'16px' }}>Route <span style={{ fontFamily:'DM Sans, sans-serif', fontWeight:700, fontSize:'26px', letterSpacing:'1px' }}>PUNE-E04</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <div style={{ background:'rgba(0,0,0,0.3)', borderRadius:'12px', padding:'12px', color:'#fff' }}>
            <div style={{ fontSize:'9px', color:'rgba(255,255,255,0.7)', marginBottom:'4px' }}>Next Stop</div>
            <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:'20px', fontWeight:700 }}>12 mins</div>
          </div>
          <div style={{ background:'rgba(0,0,0,0.3)', borderRadius:'12px', padding:'12px', color:'#fff' }}>
            <div style={{ fontSize:'9px', color:'rgba(255,255,255,0.7)', marginBottom:'4px' }}>Cargo Load</div>
            <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:'20px', fontWeight:700 }}>84%</div>
          </div>
        </div>
      </div>

      {/* Daily Manifest */}
      <div style={{ padding:'0 20px', marginBottom:'20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'12px' }}>
          <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'24px', color:C.navy, fontWeight:400 }}>Daily Manifest</div>
          <div style={{ background:C.navy, color:'#fff', fontSize:'10px', fontWeight:700, padding:'4px 10px', borderRadius:'20px', textTransform:'uppercase' }}>4 Stops Left</div>
        </div>
      </div>

      {/* Collection Route (Morning) */}
      {activeTab === 'route' && (
        <div style={{ padding:'0 20px' }}>
          {partners.length === 0 ? (
            <div style={{
              background:'white', borderRadius:'14px', padding:'32px 16px',
              textAlign:'center', color:C.stone, border:`1px solid ${C.border}`
            }}>
              <div style={{ fontSize:'32px', marginBottom:'8px' }}>📍</div>
              <div style={{ fontSize:'12px' }}>No partners with orders today.</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {partners.map((partner, index) => {
                const isCompleted = collectedPartners.has(partner.id) && index < currentIndex;
                const isCurrent = collectedPartners.has(partner.id) && index === currentIndex;
                const isUpcoming = !collectedPartners.has(partner.id);
                return (
                  <div key={partner.id} style={{
                    background:'white', borderRadius:'14px', padding:'16px',
                    border:`1px solid ${C.border}`, boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
                    opacity: isCompleted ? 0.5 : 1
                  }}>
                    {isCurrent && (
                      <div style={{ background:C.saffron, color:'white', fontSize:'9px', fontWeight:700, padding:'4px 10px', borderRadius:'4px', display:'inline-block', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Current Stop</div>
                    )}
                    <div style={{ display:'flex', alignItems:'flex-start', gap:'12px', marginBottom:'10px' }}>
                      <div style={{ width:'32px', height:'32px', borderRadius:'50%', border:`2px solid ${isCompleted?C.success:isCurrent?C.saffron:C.stone}`, background:isCompleted?C.success:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#fff', fontWeight:700, fontSize:'14px', marginTop:'2px' }}>
                        {isCompleted ? '✓' : index + 1}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:isCurrent?'24px':'16px', color:C.navy, fontWeight:isCurrent?400:400 }}>{partner.name}</div>
                        <div style={{ fontSize:isCurrent?'13px':'12px', color:C.stone, fontStyle:'italic' }}>{partner.area}, {partner.city}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        {isCompleted && <div style={{ fontSize:'11px', color:C.success, fontWeight:700 }}>08:30 AM</div>}
                        {isCurrent && <div style={{ fontSize:'11px', color:C.saffron, fontWeight:700 }}>Now</div>}
                        {isUpcoming && <div style={{ fontSize:'11px', color:C.stone }}>ETA 11:15 AM</div>}
                      </div>
                    </div>

                    {isCurrent && (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                        <div style={{ background:C.linen, borderRadius:'10px', padding:'12px', textAlign:'center' }}>
                          <div style={{ fontSize:'9px', color:C.stone, marginBottom:'4px' }}>Bags to Collect</div>
                          <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:'28px', color:C.saffron, fontWeight:700 }}>{partner.orderCount}</div>
                        </div>
                        <div style={{ background:C.linen, borderRadius:'10px', padding:'12px', textAlign:'center' }}>
                          <div style={{ fontSize:'9px', color:C.stone, marginBottom:'4px' }}>Contact</div>
                          <div style={{ fontFamily:'DM Sans, sans-serif', fontSize:'13px', color:C.stone, fontWeight:600 }}>Manager...</div>
                        </div>
                      </div>
                    )}

                    {!isCompleted && isUpcoming && (
                      <div style={{ fontSize:'11px', color:C.stone, marginBottom:'10px' }}>
                        📦 {partner.orderCount} bags • 2.4 km away
                      </div>
                    )}

                    {isCurrent && (
                      <button
                        onClick={() => handleCollectedFromPartner(partner.id, partner.name)}
                        style={{
                          width:'100%', padding:'12px', background:C.saffron, color:'white',
                          border:'none', borderRadius:'26px', fontSize:'11px', fontWeight:700,
                          cursor:'pointer', fontFamily:'DM Sans, sans-serif', letterSpacing:'1px', textTransform:'uppercase'
                        }}
                      >
                        Verify Collection
                      </button>
                    )}

                    {isCompleted && (
                      <div style={{ fontSize:'10px', color:C.success, fontWeight:700, display:'flex', alignItems:'center', gap:'4px' }}>
                        ✓ Collected
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Morning Delivery (Dispatch to Partners) */}
      {activeTab === 'deliveries' && (
        <div style={{ padding:'0 20px' }}>
          <div style={{ background:C.saffronLight, borderRadius:'14px', padding:'14px', marginBottom:'16px', border:`1px solid ${C.saffron}` }}>
            <div style={{ fontSize:'12px', fontWeight:700, color:C.saffron, marginBottom:'4px' }}>🌅 Morning Delivery</div>
            <div style={{ fontSize:'11px', color:C.saffron }}>Bundles ready for dispatch after overnight cleaning.</div>
          </div>

          {partners.length === 0 ? (
            <div style={{ background:'white', borderRadius:'14px', padding:'32px 16px', textAlign:'center', color:C.stone, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:'32px', marginBottom:'8px' }}>🌅</div>
              <div style={{ fontSize:'12px' }}>No deliveries for today.</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {partners.map((partner) => (
                <div key={partner.id} style={{ background:'white', borderRadius:'14px', padding:'16px', border:`1px solid ${C.border}`, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px' }}>
                    <div>
                      <div style={{ fontSize:'16px', fontWeight:700, color:C.navy }}>{partner.name}</div>
                      <div style={{ fontSize:'11px', color:C.stone, marginTop:'3px' }}>📍 {partner.area}</div>
                    </div>
                    <div style={{ fontSize:'12px', fontWeight:700, color:C.teal }}>{partner.orderCount} orders</div>
                  </div>
                  <button
                    onClick={() => handleDeliveredToPartner(partner.id)}
                    disabled={!collectedPartners.has(partner.id)}
                    style={{
                      width:'100%', padding:'12px',
                      background: collectedPartners.has(partner.id) ? C.success : '#ddd',
                      color:collectedPartners.has(partner.id)?'white':C.stone, border:'none', borderRadius:'8px',
                      fontSize:'12px', fontWeight:700, cursor: collectedPartners.has(partner.id) ? 'pointer' : 'not-allowed', fontFamily:'DM Sans, sans-serif'
                    }}
                  >
                    ✓ Delivered to {partner.name}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {activeTab === 'history' && (
        <div style={{ padding:'0 20px' }}>
          <div style={{ background:'white', borderRadius:'14px', padding:'20px', textAlign:'center', color:C.stone, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:'14px', fontWeight:700, color:C.navy, marginBottom:'8px' }}>Route History</div>
            <div style={{ fontSize:'11px' }}>Past 30 days of collection and delivery routes.</div>
            <div style={{ fontSize:'10px', color:'#aaa', marginTop:'12px' }}>Coming soon</div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div style={{ padding:'20px', display:'flex', gap:'8px', marginTop:'20px', position:'fixed', bottom:'70px', left:0, right:0, background:C.cream, zIndex:50, maxWidth:'480px', margin:'0 auto' }}>
        {['route', 'deliveries', 'history'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ flex:1, padding:'12px', background:activeTab===tab?C.navy:'#fff', color:activeTab===tab?'#fff':C.stone, border:`1px solid ${activeTab===tab?C.navy:C.border}`, borderRadius:'8px', fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'DM Sans, sans-serif', textTransform:'capitalize' }}>
            {tab === 'route' ? '📍' : tab === 'deliveries' ? '🚗' : '📋'} {tab}
          </button>
        ))}
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

export default function BatchRiderApp() {
  return <BatchRiderHome />;
}
