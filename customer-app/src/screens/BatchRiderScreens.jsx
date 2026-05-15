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
    <div style={{ minHeight:'100vh', background:C.cream, paddingBottom:'80px' }}>
      {/* Header */}
      <div style={{
        background:C.navy, color:'white', padding:'24px 16px',
        marginBottom:'24px'
      }}>
        <div style={{ fontSize:'28px', fontFamily:'Cormorant Garamond, serif', fontWeight:500 }}>
          🚐 Batch Collection
        </div>
        <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.7)', marginTop:'4px' }}>
          {profile?.full_name || 'Batch Rider'} • Today's Route
        </div>
      </div>

      {/* Stats Strip */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', padding:'0 16px', marginBottom:'24px' }}>
        {[
          { label:'Total Orders', value: stats.total.toString(), icon:'📦', color:C.teal },
          { label:'Partners', value: stats.partners.toString(), icon:'📍', color:C.info },
          { label:'Collected', value: stats.collected.toString(), icon:'✓', color:C.success }
        ].map((stat, i) => (
          <div key={i} style={{
            background:'white', borderRadius:'12px', padding:'14px',
            textAlign:'center', border:`1px solid ${C.border}`
          }}>
            <div style={{ fontSize:'22px', marginBottom:'6px' }}>{stat.icon}</div>
            <div style={{ fontSize:'10px', color:C.stone, marginBottom:'6px' }}>
              {stat.label}
            </div>
            <div style={{ fontSize:'16px', fontWeight:600, color:stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display:'flex', gap:'0', padding:'0 16px', marginBottom:'16px',
        borderBottom:`2px solid ${C.border}`
      }}>
        {['route', 'deliveries', 'history'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding:'12px 16px', fontSize:'12px', fontWeight:600,
              background:'transparent', border:'none', cursor:'pointer',
              color: activeTab === tab ? C.teal : C.stone,
              borderBottom: activeTab === tab ? `3px solid ${C.teal}` : 'none',
              textTransform:'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Collection Route (Morning) */}
      {activeTab === 'route' && (
        <div style={{ padding:'0 16px' }}>
          {partners.length === 0 ? (
            <div style={{
              background:'white', borderRadius:'12px', padding:'32px 16px',
              textAlign:'center', color:C.stone, border:`1px solid ${C.border}`
            }}>
              <div style={{ fontSize:'32px', marginBottom:'8px' }}>📍</div>
              <div style={{ fontSize:'12px' }}>No partners with orders today.</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {partners.map((partner, index) => (
                <div key={partner.id} style={{
                  background:'white', borderRadius:'12px', padding:'14px',
                  border:`1px solid ${C.border}`
                }}>
                  {/* Partner Header */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                    <div>
                      <div style={{ fontSize:'14px', fontWeight:600, color:C.navy }}>
                        {index + 1}. {partner.name}
                      </div>
                      <div style={{ fontSize:'10px', color:C.stone, marginTop:'3px' }}>
                        📍 {partner.area}, {partner.city}
                      </div>
                    </div>
                    {collectedPartners.has(partner.id) && (
                      <div style={{
                        fontSize:'11px', fontWeight:600, color:'white',
                        background:C.success, padding:'4px 8px', borderRadius:'6px'
                      }}>
                        ✓ Collected
                      </div>
                    )}
                  </div>

                  {/* Partner Stats */}
                  <div style={{ fontSize:'11px', color:C.stone, marginBottom:'10px' }}>
                    📦 {partner.orderCount} orders waiting
                  </div>

                  {/* Action Button */}
                  {!collectedPartners.has(partner.id) && (
                    <button
                      onClick={() => handleCollectedFromPartner(partner.id, partner.name)}
                      style={{
                        width:'100%', padding:'10px', background:C.teal, color:'white',
                        border:'none', borderRadius:'6px', fontSize:'11px', fontWeight:600,
                        cursor:'pointer'
                      }}
                    >
                      ✓ Collected {partner.orderCount} orders
                    </button>
                  )}

                  {collectedPartners.has(partner.id) && (
                    <div style={{ fontSize:'10px', color:C.success, fontWeight:600 }}>
                      ✓ Picked up and in transit to workshop
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Morning Delivery (Dispatch to Partners) */}
      {activeTab === 'deliveries' && (
        <div style={{ padding:'0 16px' }}>
          <div style={{
            background:C.saffronLight, borderRadius:'12px', padding:'14px',
            marginBottom:'16px', border:`1px solid ${C.saffron}`
          }}>
            <div style={{ fontSize:'12px', fontWeight:600, color:C.saffron, marginBottom:'4px' }}>
              ℹ️ Morning Delivery
            </div>
            <div style={{ fontSize:'10px', color:C.saffron }}>
              Bundles will be ready for morning dispatch after overnight cleaning.
            </div>
          </div>

          {partners.length === 0 ? (
            <div style={{
              background:'white', borderRadius:'12px', padding:'32px 16px',
              textAlign:'center', color:C.stone, border:`1px solid ${C.border}`
            }}>
              <div style={{ fontSize:'32px', marginBottom:'8px' }}>🌅</div>
              <div style={{ fontSize:'12px' }}>No deliveries for today.</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {partners.map((partner, index) => (
                <div key={partner.id} style={{
                  background:'white', borderRadius:'12px', padding:'14px',
                  border:`1px solid ${C.border}`
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                    <div>
                      <div style={{ fontSize:'14px', fontWeight:600, color:C.navy }}>
                        {partner.name}
                      </div>
                      <div style={{ fontSize:'10px', color:C.stone, marginTop:'3px' }}>
                        📍 {partner.area}
                      </div>
                    </div>
                    <div style={{ fontSize:'11px', fontWeight:600, color:C.teal }}>
                      {partner.orderCount} orders
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeliveredToPartner(partner.id)}
                    disabled={!collectedPartners.has(partner.id)}
                    style={{
                      width:'100%', padding:'10px',
                      background: collectedPartners.has(partner.id) ? C.success : '#ccc',
                      color:'white', border:'none', borderRadius:'6px',
                      fontSize:'11px', fontWeight:600, cursor: collectedPartners.has(partner.id) ? 'pointer' : 'not-allowed'
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
        <div style={{ padding:'0 16px' }}>
          <div style={{
            background:'white', borderRadius:'12px', padding:'20px',
            textAlign:'center', color:C.stone, border:`1px solid ${C.border}`
          }}>
            <div style={{ fontSize:'14px', fontWeight:600, color:C.navy, marginBottom:'8px' }}>
              Route History
            </div>
            <div style={{ fontSize:'11px' }}>
              Past 30 days of collection and delivery routes.
            </div>
            <div style={{ fontSize:'10px', color:'#aaa', marginTop:'12px' }}>
              History feature coming soon
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BatchRiderApp() {
  return <BatchRiderHome />;
}
