import React, { useState } from 'react';
import { C, fmt } from '../lib/constants';
import { useAuth } from '../context/AuthContext';

// ── CHANNEL PARTNER HOME ──
function ChannelPartnerHome() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('today');

  return (
    <div style={{ minHeight:'100vh', background:C.cream, padding:'16px' }}>
      {/* Header */}
      <div style={{ marginBottom:'24px' }}>
        <div style={{ fontSize:'32px', fontFamily:'Cormorant Garamond, serif', fontWeight:500, color:C.navy }}>
          📍 Collection Point
        </div>
        <div style={{ fontSize:'12px', color:C.stone, marginTop:'4px' }}>
          {profile?.full_name || 'Channel Partner'}
        </div>
      </div>

      {/* Stats Strip */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'24px' }}>
        {[
          { label:'Received Today', value:'8', icon:'📥' },
          { label:'Pending Pickup', value:'3', icon:'⏳' },
          { label:'Today\'s Commission', value:'₹200', icon:'💰' }
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
        {['today', 'history', 'earnings'].map(tab => (
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

      {/* Today's Orders (Placeholder) */}
      {activeTab === 'today' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{
            background:'white', borderRadius:'12px', padding:'16px',
            border:`1px solid ${C.border}`
          }}>
            <div style={{ fontSize:'14px', fontWeight:600, color:C.navy, marginBottom:'8px' }}>
              Order #KR-0042
            </div>
            <div style={{ fontSize:'11px', color:C.stone, marginBottom:'8px' }}>
              👤 Piyush Kumar
            </div>
            <div style={{ fontSize:'11px', color:C.stone, marginBottom:'12px' }}>
              📍 Wakad, Pune
            </div>
            <div style={{
              display:'flex', gap:'8px',
              borderTop:`1px solid ${C.border}`, paddingTop:'8px'
            }}>
              <button style={{
                flex:1, padding:'8px', background:C.teal, color:'white',
                border:'none', borderRadius:'6px', fontSize:'11px', fontWeight:600,
                cursor:'pointer'
              }}>
                ✓ Confirm Received
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Earnings Tab */}
      {activeTab === 'earnings' && (
        <div style={{
          background:'white', borderRadius:'12px', padding:'16px',
          border:`1px solid ${C.border}`
        }}>
          <div style={{ fontSize:'12px', color:C.stone, marginBottom:'12px' }}>
            Monthly Summary
          </div>
          <div style={{ fontSize:'24px', fontWeight:600, color:C.teal, marginBottom:'8px' }}>
            ₹2,500
          </div>
          <div style={{ fontSize:'10px', color:C.stone }}>
            125 orders × ₹25 commission
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div style={{
          background:'#f9f9f9', borderRadius:'12px', padding:'16px',
          textAlign:'center', color:C.stone, fontSize:'12px'
        }}>
          📋 Order history coming soon
        </div>
      )}
    </div>
  );
}

export default function ChannelPartnerApp() {
  return <ChannelPartnerHome />;
}
