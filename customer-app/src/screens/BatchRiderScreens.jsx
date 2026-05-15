import React, { useState } from 'react';
import { C, fmt } from '../lib/constants';
import { useAuth } from '../context/AuthContext';

// ── BATCH RIDER HOME ──
function BatchRiderHome() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('route');

  return (
    <div style={{ minHeight:'100vh', background:C.cream, padding:'16px' }}>
      {/* Header */}
      <div style={{ marginBottom:'24px' }}>
        <div style={{ fontSize:'32px', fontFamily:'Cormorant Garamond, serif', fontWeight:500, color:C.navy }}>
          🚐 Batch Route
        </div>
        <div style={{ fontSize:'12px', color:C.stone, marginTop:'4px' }}>
          {profile?.full_name || 'Batch Rider'}
        </div>
      </div>

      {/* Today's Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'24px' }}>
        {[
          { label:'Total Orders', value:'47', icon:'📦' },
          { label:'Partners', value:'6', icon:'📍' },
          { label:'KMs', value:'18', icon:'🗺️' }
        ].map((stat, i) => (
          <div key={i} style={{
            background:'white', borderRadius:'12px', padding:'12px',
            textAlign:'center', border:`1px solid ${C.border}`
          }}>
            <div style={{ fontSize:'20px', marginBottom:'4px' }}>{stat.icon}</div>
            <div style={{ fontSize:'10px', color:C.stone }}>
              {stat.label}
            </div>
            <div style={{ fontSize:'14px', fontWeight:600, color:C.navy, marginTop:'4px' }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px', borderBottom:`1px solid ${C.border}` }}>
        {['route', 'deliveries', 'history'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding:'8px 16px', fontSize:'12px', fontWeight:500,
              background:'transparent', border:'none', cursor:'pointer',
              color: activeTab === tab ? C.teal : C.stone,
              borderBottom: activeTab === tab ? `2px solid ${C.teal}` : 'none',
              textTransform:'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Collection Route */}
      {activeTab === 'route' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {[
            { name:'Wakad Collection', orders:'12', status:'pending' },
            { name:'Hinjewadi Partner', orders:'8', status:'pending' },
            { name:'Kalyani Nagar Hub', orders:'15', status:'pending' }
          ].map((partner, i) => (
            <div key={i} style={{
              background:'white', borderRadius:'12px', padding:'16px',
              border:`1px solid ${C.border}`
            }}>
              <div style={{ fontSize:'14px', fontWeight:600, color:C.navy, marginBottom:'8px' }}>
                {partner.name}
              </div>
              <div style={{ fontSize:'11px', color:C.stone, marginBottom:'12px' }}>
                📦 {partner.orders} orders waiting
              </div>
              <button style={{
                width:'100%', padding:'8px', background:C.teal, color:'white',
                border:'none', borderRadius:'6px', fontSize:'11px', fontWeight:600,
                cursor:'pointer'
              }}>
                ✓ Collected from this partner
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Deliveries (Morning Drop) */}
      {activeTab === 'deliveries' && (
        <div style={{
          background:'white', borderRadius:'12px', padding:'16px',
          border:`1px solid ${C.border}`, textAlign:'center', color:C.stone
        }}>
          <div style={{ fontSize:'14px', fontWeight:600, color:C.navy, marginBottom:'8px' }}>
            Morning Delivery
          </div>
          <div style={{ fontSize:'12px', marginBottom:'16px' }}>
            Drop bundles at 6 collection points
          </div>
          <button style={{
            width:'100%', padding:'10px', background:C.success, color:'white',
            border:'none', borderRadius:'6px', fontSize:'12px', fontWeight:600,
            cursor:'pointer'
          }}>
            📲 Start Morning Route
          </button>
        </div>
      )}

      {/* History */}
      {activeTab === 'history' && (
        <div style={{
          background:'#f9f9f9', borderRadius:'12px', padding:'16px',
          textAlign:'center', color:C.stone, fontSize:'12px'
        }}>
          📋 Route history coming soon
        </div>
      )}
    </div>
  );
}

export default function BatchRiderApp() {
  return <BatchRiderHome />;
}
