import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STATUS_NEXT = {
  pending_pickup:   'rider_assigned',
  rider_assigned:   'picked_up',
  picked_up:        'out_for_delivery',
  out_for_delivery: 'delivered',
};
const STATUS_LABEL = {
  pending_pickup:    'New pickup',
  rider_assigned:    'Go pickup',
  picked_up:         'At facility',
  out_for_delivery:  'For delivery',
  delivered:         'Done',
};
const BTN_LABEL = {
  pending_pickup:   '✅ Accept & assign to me',
  rider_assigned:   '📦 Mark as picked up',
  picked_up:        '🔄 Hand to facility',
  out_for_delivery: '✅ Mark delivered',
};

// ── OTP Login ─────────────────────────────────────────────
function RiderLogin({ onLogin }) {
  const [phone, setPhone] = useState('');
  const [otp,   setOtp]   = useState('');
  const [step,  setStep]  = useState('phone');
  const [fmted, setFmted] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function sendOtp() {
    const formatted = `+91${phone.replace(/\D/g,'')}`;
    setLoading(true); setErr('');
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
    if (error) { setErr(error.message); setLoading(false); return; }
    setFmted(formatted); setStep('otp'); setLoading(false);
  }

  async function verifyOtp() {
    setLoading(true); setErr('');
    const { data, error } = await supabase.auth.verifyOtp({ phone: fmted, token: otp, type: 'sms' });
    if (error) { setErr('Invalid OTP'); setLoading(false); return; }
    // Check rider role
    const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', data.user.id).single();
    if (profile?.role !== 'rider') { setErr('This account is not registered as a rider.'); setLoading(false); return; }
    onLogin(data.user, profile);
    setLoading(false);
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', background:'#0D1B3E' }}>
      <div style={{ fontSize:'48px', marginBottom:'8px' }}>🏍️</div>
      <h1 style={{ color:'#fff', fontSize:'22px', fontWeight:700, marginBottom:'4px', fontFamily:'Poppins, sans-serif' }}>Rider App</h1>
      <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'13px', marginBottom:'32px' }}>Kair · Pune</p>

      <div style={{ width:'100%', maxWidth:'320px', background:'rgba(255,255,255,0.05)', borderRadius:'16px', padding:'20px' }}>
        {step === 'phone' ? (
          <>
            <label style={lbl}>Mobile number</label>
            <div style={{ display:'flex', background:'rgba(255,255,255,0.1)', borderRadius:'10px', marginBottom:'12px', overflow:'hidden' }}>
              <div style={{ padding:'12px', color:'rgba(255,255,255,0.6)', fontSize:'13px', whiteSpace:'nowrap', borderRight:'1px solid rgba(255,255,255,0.1)' }}>🇮🇳 +91</div>
              <input type="tel" value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,''))} maxLength={10} placeholder="98765 43210" style={{ background:'transparent', border:'none', outline:'none', padding:'12px', color:'#fff', fontSize:'16px', flex:1, fontFamily:'Poppins, sans-serif' }} onKeyDown={e=>e.key==='Enter'&&sendOtp()} />
            </div>
            {err && <p style={{ color:'#FF6B6B', fontSize:'12px', marginBottom:'8px' }}>{err}</p>}
            <button onClick={sendOtp} disabled={loading} style={orangeBtn}>{loading ? 'Sending...' : 'Send OTP'}</button>
          </>
        ) : (
          <>
            <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'13px', textAlign:'center', marginBottom:'14px' }}>OTP sent to {fmted}</p>
            <label style={lbl}>Enter OTP</label>
            <input type="tel" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} maxLength={6} placeholder="• • • • • •" style={{ width:'100%', background:'rgba(255,255,255,0.1)', border:'none', outline:'none', padding:'12px', borderRadius:'10px', color:'#fff', fontSize:'20px', letterSpacing:'8px', textAlign:'center', fontFamily:'Poppins, sans-serif', marginBottom:'12px', boxSizing:'border-box' }} autoFocus onKeyDown={e=>e.key==='Enter'&&verifyOtp()} />
            {err && <p style={{ color:'#FF6B6B', fontSize:'12px', marginBottom:'8px' }}>{err}</p>}
            <button onClick={verifyOtp} disabled={loading} style={orangeBtn}>{loading ? 'Verifying...' : 'Verify & Login'}</button>
            <button onClick={()=>setStep('phone')} style={{ width:'100%', background:'transparent', border:'none', color:'rgba(255,255,255,0.4)', fontSize:'12px', cursor:'pointer', marginTop:'8px', fontFamily:'Poppins, sans-serif' }}>← Back</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Rider Dashboard ──────────────────────────────────
function RiderDashboard({ user, riderProfile, onSignOut }) {
  const [orders,  setOrders]  = useState([]);
  const [tab,     setTab]     = useState('active');
  const [loading, setLoading] = useState(false);
  const [toast,   setToast]   = useState('');

  async function fetchOrders() {
    setLoading(true);
    const statuses = tab === 'active'
      ? ['pending_pickup','rider_assigned','picked_up','out_for_delivery']
      : ['delivered','cancelled'];

    const { data } = await supabase
      .from('orders')
      .select(`*, address:addresses(flat_no, area, city), items:order_items(service_name, quantity), customer:profiles!orders_customer_id_fkey(full_name, phone)`)
      .in('status', statuses)
      .or(tab === 'active' ? `rider_id.eq.${user.id},rider_id.is.null` : `rider_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    setOrders(data || []);
    setLoading(false);
  }

  // Realtime subscription
  useEffect(() => {
    fetchOrders();
    const ch = supabase.channel('rider_orders')
      .on('postgres_changes', { event:'*', schema:'public', table:'orders' }, () => fetchOrders())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [tab]);

  // Update GPS every 30 seconds
  useEffect(() => {
    function updateLocation() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(pos => {
        fetch(`${API}/api/riders/${user.id}/location`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        });
      });
    }
    updateLocation();
    const iv = setInterval(updateLocation, 30000);
    return () => clearInterval(iv);
  }, []);

  async function handleAction(order) {
    const nextStatus = STATUS_NEXT[order.status];
    if (!nextStatus) return;

    const body = { status: nextStatus };
    if (order.status === 'pending_pickup') body.rider_id = user.id;

    const res = await fetch(`${API}/api/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      showToast(`✅ Order ${order.order_number} → ${nextStatus.replace(/_/g,' ')}`);
      fetchOrders();
    }
  }

  // Generate garment tags after pickup
  async function generateTags(orderId) {
    const res = await fetch(`${API}/api/orders/${orderId}/generate-tags`, { method: 'POST' });
    if (res.ok) showToast('Tags generated for all items');
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const activeCount = orders.filter(o => ['pending_pickup','rider_assigned'].includes(o.status)).length;

  return (
    <div style={{ fontFamily:'Poppins, sans-serif', background:'#F5F4F1', minHeight:'100vh' }}>
      {/* Header */}
      <div style={{ background:'#0D1B3E', padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ color:'#fff', fontSize:'15px', fontWeight:700 }}>🏍️ {riderProfile?.full_name || 'Rider'}</div>
          <div style={{ color:'rgba(255,255,255,0.5)', fontSize:'11px' }}>Pune · Online</div>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <div style={{ background:'#0A7A4B', borderRadius:'20px', padding:'4px 12px', fontSize:'11px', fontWeight:700, color:'#fff' }}>● Online</div>
          <button onClick={onSignOut} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'8px', padding:'6px 12px', color:'rgba(255,255,255,0.7)', fontSize:'12px', cursor:'pointer', fontFamily:'Poppins, sans-serif' }}>Sign out</button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background:'#fff', padding:'12px 16px', display:'flex', gap:'16px', borderBottom:'1px solid #E8E8E8' }}>
        {[
          { label: 'Active orders', value: orders.filter(o=>!['delivered','cancelled'].includes(o.status)).length, color:'#FF6B00' },
          { label: 'Pending pickup', value: activeCount, color:'#E65100' },
          { label: 'Today delivered', value: orders.filter(o=>o.status==='delivered').length, color:'#0A7A4B' },
        ].map(s => (
          <div key={s.label} style={{ flex:1, textAlign:'center' }}>
            <div style={{ fontSize:'22px', fontWeight:700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize:'10px', color:'#6B6B6B', lineHeight:1.3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', background:'#fff', borderBottom:'1px solid #E8E8E8' }}>
        {[['active','Active'],['done','Completed']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex:1, padding:'12px', border:'none', background:'transparent', fontFamily:'Poppins, sans-serif', fontSize:'13px', fontWeight:600, cursor:'pointer', color: tab===id ? '#FF6B00' : '#6B6B6B', borderBottom: tab===id ? '2px solid #FF6B00' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Orders list */}
      <div style={{ padding:'12px 12px 80px' }}>
        {loading && <div style={{ textAlign:'center', padding:'40px', color:'#6B6B6B', fontSize:'13px' }}>Loading orders...</div>}
        {!loading && orders.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>🎉</div>
            <p style={{ color:'#6B6B6B', fontSize:'14px' }}>No {tab === 'active' ? 'active' : 'completed'} orders right now</p>
          </div>
        )}
        {orders.map(order => {
          const statusLabel = STATUS_LABEL[order.status] || order.status;
          const btnLabel    = BTN_LABEL[order.status];
          const totalRs     = ((order.total_paise||0)/100).toFixed(0);
          return (
            <div key={order.id} style={{ background:'#fff', borderRadius:'14px', border:'1px solid #E8E8E8', marginBottom:'12px', overflow:'hidden' }}>
              {/* Card header */}
              <div style={{ background:'#F5F4F1', padding:'10px 14px', borderBottom:'1px solid #E8E8E8', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  <span style={{ fontFamily:'monospace', fontSize:'12px', fontWeight:700, background:'#0D1B3E', color:'#fff', padding:'3px 8px', borderRadius:'5px' }}>{order.order_number}</span>
                  <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'20px', background: order.status==='delivered' ? '#E5F5EE' : '#FFF3E0', color: order.status==='delivered' ? '#0A7A4B' : '#E65100' }}>{statusLabel}</span>
                </div>
                <span style={{ fontSize:'14px', fontWeight:700, color:'#FF6B00' }}>₹{totalRs}</span>
              </div>

              {/* Card body */}
              <div style={{ padding:'12px 14px' }}>
                {/* Customer */}
                <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                  <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'#0D1B3E', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:700, flexShrink:0 }}>
                    {(order.customer?.full_name || 'C')[0]}
                  </div>
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:700 }}>{order.customer?.full_name || 'Customer'}</div>
                    <a href={`tel:${order.customer?.phone}`} style={{ fontSize:'12px', color:'#FF6B00', textDecoration:'none', fontWeight:600 }}>{order.customer?.phone}</a>
                  </div>
                </div>

                {/* Address */}
                <div style={{ fontSize:'12px', color:'#0D1B3E', background:'#F5F4F1', borderRadius:'8px', padding:'8px 10px', marginBottom:'10px' }}>
                  📍 {[order.address?.flat_no, order.address?.area, order.address?.city].filter(Boolean).join(', ')}
                </div>

                {/* Items */}
                <div style={{ fontSize:'11px', color:'#6B6B6B', marginBottom:'10px' }}>
                  {order.items?.map(i => `${i.quantity}× ${i.service_name}`).join(' · ')}
                </div>

                {/* Actions */}
                {btnLabel && (
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button onClick={() => handleAction(order)} style={{ flex:1, padding:'11px', background:'#FF6B00', color:'#fff', border:'none', borderRadius:'10px', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Poppins, sans-serif' }}>
                      {btnLabel}
                    </button>
                    {order.status === 'picked_up' && (
                      <button onClick={() => generateTags(order.id)} style={{ padding:'11px 14px', background:'#0D1B3E', color:'#fff', border:'none', borderRadius:'10px', fontSize:'13px', cursor:'pointer', fontFamily:'Poppins, sans-serif' }}>
                        🏷️
                      </button>
                    )}
                    <a href={`https://maps.google.com/?q=${encodeURIComponent([order.address?.flat_no, order.address?.area, 'Pune'].filter(Boolean).join(', '))}`}
                       target="_blank" rel="noreferrer"
                       style={{ padding:'11px 14px', background:'#E5F0FF', color:'#1A5FBF', border:'none', borderRadius:'10px', fontSize:'13px', fontWeight:700, textDecoration:'none', display:'flex', alignItems:'center' }}>
                      🗺️
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:'20px', left:'50%', transform:'translateX(-50%)', background:'#0D1B3E', color:'#fff', padding:'10px 18px', borderRadius:'10px', fontSize:'13px', fontWeight:500, whiteSpace:'nowrap', zIndex:200 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────
export default function RiderApp() {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
          .then(({ data }) => setProfile(data));
      }
      setLoading(false);
    });
    supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null); setProfile(null);
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0D1B3E', fontSize:'32px' }}>🏍️</div>;
  if (!user)   return <RiderLogin onLogin={(u, p) => { setUser(u); setProfile(p); }} />;
  return <RiderDashboard user={user} riderProfile={profile} onSignOut={handleSignOut} />;
}

const lbl = { display:'block', fontSize:'11px', fontWeight:600, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'6px' };
const orangeBtn = { width:'100%', padding:'13px', background:'#FF6B00', color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Poppins, sans-serif' };
