import React, { useState, useEffect } from 'react';
import { C, fmt, STATUS_CONFIG } from '../lib/constants';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// ── CHANNEL PARTNER HOME ──
function ChannelPartnerHome() {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState('today');
  const [orders, setOrders] = useState([]);
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ received: 0, pending: 0, commission: 0 });
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Fetch channel partner data and orders
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);

        // Fetch channel partner profile
        const { data: partnerData } = await supabase
          .from('channel_partners')
          .select('*')
          .eq('profile_id', user.id)
          .single();

        setPartner(partnerData);

        if (partnerData?.id) {
          // Fetch orders at this channel partner
          const { data: ordersData } = await supabase
            .from('orders')
            .select(`
              *,
              order_items(service_name, quantity, price_paise),
              profiles!customer_id(full_name, phone)
            `)
            .eq('channel_partner_id', partnerData.id)
            .in('status', ['at_channel_partner', 'picked_up'])
            .order('created_at', { ascending: false });

          setOrders(ordersData || []);

          // Calculate stats
          const received = ordersData?.filter(o => o.status === 'at_channel_partner').length || 0;
          const pending = ordersData?.filter(o => o.status === 'picked_up').length || 0;
          const commission = (received + pending) * partnerData.commission_paise / 100;

          setStats({ received, pending, commission });
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

  const handleOrderReceived = async (orderId) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'at_channel_partner',
          at_partner_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (!error) {
        setOrders(prev => prev.map(o =>
          o.id === orderId ? { ...o, status: 'at_channel_partner' } : o
        ));
        setSelectedOrder(null);
        // Recalculate stats
        const received = orders.filter(o => o.status === 'at_channel_partner' || o.id === orderId).length;
        const commission = (received + stats.pending) * (partner?.commission_paise || 2500) / 100;
        setStats({ ...stats, received, commission });
      }
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:C.cream, paddingBottom:'80px' }}>
      {/* Header */}
      <div style={{
        background:C.navy, color:'white', padding:'24px 16px',
        marginBottom:'24px'
      }}>
        <div style={{ fontSize:'28px', fontFamily:'Cormorant Garamond, serif', fontWeight:500 }}>
          📍 {partner?.name || 'Collection Point'}
        </div>
        <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.7)', marginTop:'4px' }}>
          {partner?.area || 'Loading...'} • Commission: {fmt.rupees(partner?.commission_paise || 2500)}/order
        </div>
      </div>

      {/* Stats Strip */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', padding:'0 16px', marginBottom:'24px' }}>
        {[
          { label:'Received Today', value: stats.received.toString(), icon:'📥', color:C.teal },
          { label:'Pending Handover', value: stats.pending.toString(), icon:'⏳', color:C.saffron },
          { label:'Today\'s Commission', value: fmt.rupees(stats.commission), icon:'💰', color:C.success }
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
        {['today', 'history', 'profile'].map(tab => (
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

      {/* Today's Orders */}
      {activeTab === 'today' && (
        <div style={{ padding:'0 16px' }}>
          {orders.length === 0 ? (
            <div style={{
              background:'white', borderRadius:'12px', padding:'32px 16px',
              textAlign:'center', color:C.stone, border:`1px solid ${C.border}`
            }}>
              <div style={{ fontSize:'32px', marginBottom:'8px' }}>📦</div>
              <div style={{ fontSize:'12px' }}>No orders at this location yet.</div>
              <div style={{ fontSize:'10px', color:'#aaa', marginTop:'4px' }}>
                Orders will appear when riders drop them here.
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {orders.map(order => (
                <div key={order.id} style={{
                  background:'white', borderRadius:'12px', padding:'14px',
                  border:`1px solid ${C.border}`, cursor:'pointer'
                }} onClick={() => setSelectedOrder(order.id === selectedOrder ? null : order.id)}>
                  {/* Order Header */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                    <div>
                      <div style={{ fontSize:'14px', fontWeight:600, color:C.navy }}>
                        {order.order_number}
                      </div>
                      <div style={{ fontSize:'11px', color:C.stone, marginTop:'2px' }}>
                        👤 {order.profiles?.full_name || 'Customer'}
                      </div>
                    </div>
                    <div style={{
                      fontSize:'10px', fontWeight:600, padding:'4px 8px',
                      background: STATUS_CONFIG[order.status]?.bg,
                      color: STATUS_CONFIG[order.status]?.color,
                      borderRadius:'6px'
                    }}>
                      {STATUS_CONFIG[order.status]?.label}
                    </div>
                  </div>

                  {/* Order Items Preview */}
                  <div style={{ fontSize:'11px', color:C.stone, marginBottom:'10px' }}>
                    📦 {order.order_items?.length || 0} items
                  </div>

                  {/* Expanded View */}
                  {selectedOrder === order.id && (
                    <div style={{
                      borderTop:`1px solid ${C.border}`, paddingTop:'10px',
                      marginBottom:'10px'
                    }}>
                      <div style={{ fontSize:'10px', color:C.stone, marginBottom:'8px' }}>
                        <strong>Items:</strong>
                      </div>
                      {order.order_items?.map((item, i) => (
                        <div key={i} style={{ fontSize:'10px', color:C.stone, marginBottom:'4px' }}>
                          • {item.service_name} × {item.quantity}
                        </div>
                      ))}
                      <div style={{ fontSize:'10px', marginTop:'8px', color:C.navy, fontWeight:600 }}>
                        Total: {fmt.rupees(order.total_paise)}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {order.status === 'picked_up' && (
                    <div style={{
                      display:'flex', gap:'8px'
                    }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOrderReceived(order.id); }}
                        style={{
                          flex:1, padding:'8px', background:C.teal, color:'white',
                          border:'none', borderRadius:'6px', fontSize:'11px', fontWeight:600,
                          cursor:'pointer'
                        }}
                      >
                        ✓ Confirm Received
                      </button>
                    </div>
                  )}

                  {order.status === 'at_channel_partner' && (
                    <div style={{ fontSize:'10px', color:C.success, fontWeight:600 }}>
                      ✓ Received at {new Date(order.at_partner_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div style={{ padding:'0 16px' }}>
          <div style={{
            background:'white', borderRadius:'12px', padding:'20px',
            textAlign:'center', color:C.stone, border:`1px solid ${C.border}`
          }}>
            <div style={{ fontSize:'14px', fontWeight:600, color:C.navy, marginBottom:'8px' }}>
              Order History
            </div>
            <div style={{ fontSize:'11px' }}>
              Past 7 days of orders handled by this location.
            </div>
            <div style={{ fontSize:'10px', color:'#aaa', marginTop:'12px' }}>
              History feature coming soon
            </div>
          </div>
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:'12px' }}>
          {/* Partner Info Card */}
          <div style={{
            background:'white', borderRadius:'12px', padding:'16px',
            border:`1px solid ${C.border}`
          }}>
            <div style={{ fontSize:'12px', fontWeight:600, color:C.navy, marginBottom:'12px' }}>
              📍 Location Details
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              <div>
                <div style={{ fontSize:'10px', color:C.stone }}>Name</div>
                <div style={{ fontSize:'12px', fontWeight:600, color:C.navy }}>{partner?.name}</div>
              </div>
              <div>
                <div style={{ fontSize:'10px', color:C.stone }}>Address</div>
                <div style={{ fontSize:'12px', fontWeight:600, color:C.navy }}>{partner?.address}</div>
              </div>
              <div>
                <div style={{ fontSize:'10px', color:C.stone }}>Area</div>
                <div style={{ fontSize:'12px', fontWeight:600, color:C.navy }}>{partner?.area}</div>
              </div>
              <div>
                <div style={{ fontSize:'10px', color:C.stone }}>Commission Rate</div>
                <div style={{ fontSize:'12px', fontWeight:600, color:C.teal }}>
                  {fmt.rupees(partner?.commission_paise)} per order
                </div>
              </div>
            </div>
          </div>

          {/* Account Card */}
          <div style={{
            background:'white', borderRadius:'12px', padding:'16px',
            border:`1px solid ${C.border}`
          }}>
            <div style={{ fontSize:'12px', fontWeight:600, color:C.navy, marginBottom:'12px' }}>
              👤 Account
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              <div>
                <div style={{ fontSize:'10px', color:C.stone }}>Name</div>
                <div style={{ fontSize:'12px', fontWeight:600, color:C.navy }}>{profile?.full_name}</div>
              </div>
              <div>
                <div style={{ fontSize:'10px', color:C.stone }}>Phone</div>
                <div style={{ fontSize:'12px', fontWeight:600, color:C.navy }}>{profile?.phone || 'Not set'}</div>
              </div>
              <div>
                <div style={{ fontSize:'10px', color:C.stone }}>Member Since</div>
                <div style={{ fontSize:'12px', fontWeight:600, color:C.navy }}>
                  {partner?.created_at ? fmt.date(partner.created_at) : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={() => {
              supabase.auth.signOut();
              window.location.reload();
            }}
            style={{
              width:'100%', padding:'12px', background:C.danger, color:'white',
              border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:600,
              cursor:'pointer', marginTop:'8px'
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export default function ChannelPartnerApp() {
  return <ChannelPartnerHome />;
}
