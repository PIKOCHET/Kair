import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { C, STATUS_CONFIG, CATALOG, fmt } from '../lib/constants';

// ── HELPERS ───────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || { label: status, color: C.stone, bg: C.linen };
  return (
    <span style={{ fontSize:'11px', fontWeight:700, padding:'4px 10px', borderRadius:'20px', background:s.bg, color:s.color, display:'inline-flex', alignItems:'center', gap:'4px' }}>
      <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:s.color }} />
      {s.label}
    </span>
  );
}

function ProgressBar({ status }) {
  const STEPS = ['Pickup','Cleaning','Ready','Delivered'];
  const IDX = { pending_pickup:0, rider_assigned:0, picked_up:1, in_cleaning:1, quality_check:2, ready:2, out_for_delivery:3, delivered:3 };
  const si = IDX[status] ?? 0;
  const pct = Math.min((si/3)*100, 100);
  return (
    <div style={{ margin:'10px 0 4px' }}>
      <div style={{ position:'relative', height:'2px', background:C.border, margin:'0 10px', borderRadius:'2px' }}>
        <div style={{ position:'absolute', top:0, left:0, height:'2px', background:C.saffron, width:`${pct}%`, borderRadius:'2px', transition:'width 0.5s' }} />
      </div>
      <div style={{ display:'flex', marginTop:'-10px' }}>
        {STEPS.map((step, i) => (
          <div key={step} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
            <div style={{ width:'20px', height:'20px', borderRadius:'50%', border:`2px solid ${i<=si?C.saffron:C.border}`, background:i<si?C.saffron:i===si?'#fff':C.linen, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'8px', color:'#fff', zIndex:1 }}>
              {i<si?'✓':i===si?<span style={{ width:'7px', height:'7px', borderRadius:'50%', background:C.saffron, display:'block' }} />:''}
            </div>
            <span style={{ fontSize:'8px', color:C.stone, textAlign:'center', lineHeight:1.2 }}>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── HOME ──────────────────────────────────────────────────
function HomeView({ profile, onPickup, onViewOrders }) {
  const [activeOrders, setActiveOrders] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    supabase.from('orders')
      .select('id,order_number,status,pickup_type,estimated_delivery,total_paise')
      .eq('customer_id', user.id)
      .not('status', 'in', '("delivered","cancelled")')
      .order('created_at', { ascending: false })
      .then(({ data }) => setActiveOrders(data || []));

    // Realtime
    const ch = supabase.channel('home_orders')
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'orders', filter:`customer_id=eq.${user.id}` },
        payload => setActiveOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o))
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [user]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div style={{ background:C.cream, minHeight:'100vh', paddingBottom:'70px' }}>
      {/* Nav */}
      <div style={{ background:C.navy, padding:'12px 16px 0' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ width:'30px', height:'30px', background:C.saffron, borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px' }}>🧺</div>
            <div>
              <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'19px', color:'#fff', fontWeight:400, letterSpacing:'2px', lineHeight:1 }}>KAIR</div>
              <div style={{ fontSize:'8px', color:'rgba(255,255,255,0.3)', fontStyle:'italic' }}>Your clothes, in safe hands</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'4px', background:'rgba(255,255,255,0.08)', borderRadius:'20px', padding:'4px 10px', fontSize:'10px', color:'rgba(255,255,255,0.6)' }}>
            📍 Pune
          </div>
        </div>
        <div style={{ fontSize:'14px', color:'#fff', paddingBottom:'14px' }}>
          {greeting()}, <em style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic' }}>{profile?.full_name?.split(' ')[0] || 'there'}</em> 👋
        </div>
      </div>

      {/* Pickup hero */}
      <div style={{ background:C.navy, padding:'0 16px 16px' }}>
        <div style={{ background:'linear-gradient(135deg,#152447,#1e3460)', borderRadius:'20px', padding:'18px', border:'1px solid rgba(200,169,110,0.18)' }}>
          <div style={{ fontSize:'8px', fontWeight:700, color:C.gold, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'5px' }}>Premium garment care · Pune</div>
          <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'22px', color:'#fff', fontWeight:400, marginBottom:'3px' }}>Ready for a pickup?</div>
          <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.4)', marginBottom:'16px' }}>We'll be at your door within 1 hour</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
            {[
              { type:'standard', icon:'🕐', title:'Standard', sub:'Within 1 hour', bg:'#fff', color:C.navy },
              { type:'urgent',   icon:'⚡', title:'Urgent',   sub:'Priority pickup', bg:C.saffron, color:'#fff' },
            ].map(btn => (
              <button key={btn.type} onClick={() => onPickup(btn.type)}
                style={{ borderRadius:'14px', padding:'13px 10px', border:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', fontFamily:'DM Sans, sans-serif', background:btn.bg, color:btn.color, transition:'transform 0.15s' }}>
                <span style={{ fontSize:'22px', marginBottom:'2px' }}>{btn.icon}</span>
                <span style={{ fontSize:'12px', fontWeight:700 }}>{btn.title}</span>
                <span style={{ fontSize:'9px', opacity:0.65 }}>{btn.sub}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding:'14px 16px' }}>
        {/* Active orders */}
        {activeOrders.length > 0 && (
          <div style={{ marginBottom:'14px' }}>
            {activeOrders.map(order => (
              <div key={order.id} onClick={onViewOrders}
                style={{ background:'#fff', borderRadius:'12px', border:`1px solid ${C.border}`, padding:'12px 14px', marginBottom:'8px', cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                  <div>
                    <div style={{ fontSize:'9px', fontFamily:'monospace', fontWeight:700, color:C.stone }}>{order.order_number}</div>
                    {order.pickup_type === 'urgent' && <span style={{ fontSize:'9px', background:C.saffronLight, color:C.saffron, padding:'1px 6px', borderRadius:'6px', fontWeight:700 }}>⚡ Urgent</span>}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <StatusBadge status={order.status} />
                    {order.total_paise > 0 && <div style={{ fontSize:'13px', fontWeight:700, color:C.saffron, marginTop:'4px' }}>{fmt.rupees(order.total_paise)}</div>}
                    {order.estimated_delivery && <div style={{ fontSize:'9px', color:C.stone, marginTop:'2px' }}>Est. {fmt.date(order.estimated_delivery)}</div>}
                  </div>
                </div>
                <ProgressBar status={order.status} />
              </div>
            ))}
          </div>
        )}

        {/* How it works */}
        <div style={{ background:'#fff', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'14px', marginBottom:'14px' }}>
          <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'17px', color:C.navy, fontWeight:500, marginBottom:'12px' }}>How it works</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px' }}>
            {[['📱','1','Request pickup'],['🏍️','2','Rider arrives'],['🧺','3','Expert clean'],['✨','4','Back to door']].map(([icon, num, txt]) => (
              <div key={num} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', textAlign:'center' }}>
                <span style={{ fontSize:'18px' }}>{icon}</span>
                <span style={{ width:'16px', height:'16px', borderRadius:'50%', background:C.saffron, color:'#fff', fontSize:'8px', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{num}</span>
                <span style={{ fontSize:'9px', color:C.stone, lineHeight:1.3 }}>{txt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Price list */}
        <div style={{ background:'#fff', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px', marginBottom:'14px' }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:'14px' }}>
            <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'17px', color:C.navy, fontWeight:500 }}>Price list</div>
            <div style={{ fontSize:'10px', color:C.stone, fontStyle:'italic' }}>Confirmed at pickup</div>
          </div>
          {Object.entries(CATALOG).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom:'12px' }}>
              <div style={{ fontSize:'10px', fontWeight:700, color:C.stone, textTransform:'uppercase', letterSpacing:'1px', paddingBottom:'6px', borderBottom:`2px solid ${C.linen}`, marginBottom:'4px' }}>{cat}</div>
              {items.map((svc, i) => (
                <div key={svc.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 0', borderBottom:i<items.length-1?`1px solid ${C.linen}`:'none' }}>
                  <span style={{ fontSize:'15px', width:'22px', textAlign:'center', flexShrink:0 }}>{svc.emoji}</span>
                  <span style={{ flex:1, fontSize:'12px', fontWeight:500, color:C.navy }}>{svc.name}</span>
                  <span style={{ fontSize:'13px', fontWeight:700, color:C.navy }}>
                    {fmt.rupees(svc.price_paise)}<span style={{ fontSize:'10px', fontWeight:400, color:C.stone }}> {svc.unit}</span>
                  </span>
                  <span style={{ fontSize:'10px', color:C.stone, background:C.linen, padding:'2px 7px', borderRadius:'6px', whiteSpace:'nowrap' }}>{svc.tat_days}d</span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ marginTop:'10px', paddingTop:'10px', borderTop:`1px solid ${C.linen}`, fontSize:'11px', color:C.stone, textAlign:'center', fontStyle:'italic' }}>
            💡 Rider confirms exact items & total at pickup · Pay on delivery
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CONFIRM PICKUP ────────────────────────────────────────
function ConfirmView({ pickupType, onConfirmed, onBack }) {
  const { user } = useAuth();
  const [saved,          setSaved]          = useState([]);
  const [selected,       setSelected]       = useState(null);
  const [flat,           setFlat]           = useState('');
  const [area,           setArea]           = useState('');
  const [landmark,       setLandmark]       = useState('');
  const [specialNotes,   setSpecialNotes]   = useState('');
  const [promoCode,      setPromoCode]      = useState('');
  const [discountPaise,  setDiscountPaise]  = useState(0);
  const [promoMsg,       setPromoMsg]       = useState('');
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');

  useEffect(() => {
    supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending:false })
      .then(({ data }) => { if (data?.length) { setSaved(data); setSelected(data[0].id); } });
  }, [user.id]);

  async function applyPromoCode() {
    if (!promoCode.trim()) { setPromoMsg(''); return; }
    const { data, error: e } = await supabase.from('promo_codes')
      .select('discount_type,discount_value,max_discount_paise')
      .eq('code', promoCode.toUpperCase())
      .eq('is_active', true)
      .single();
    if (e || !data) { setPromoMsg('Invalid or inactive promo code'); setDiscountPaise(0); return; }
    if (data.discount_type === 'percentage') {
      setPromoMsg(`✓ ${promoCode.toUpperCase()}: ${data.discount_value}% off (will be calculated at checkout)`);
      setDiscountPaise(1); // Mark as applied, actual percentage discount calculated at checkout
    } else if (data.discount_type === 'fixed') {
      const discount = data.discount_value;
      setDiscountPaise(discount);
      setPromoMsg(`✓ ${promoCode.toUpperCase()}: ${fmt.rupees(discount)} discount applied`);
    }
  }

  async function confirm() {
    setLoading(true); setError('');
    try {
      let addressId = selected;
      if (!selected) {
        if (!area.trim()) { setError('Please enter your area'); setLoading(false); return; }
        const { data: addr, error: ae } = await supabase.from('addresses')
          .insert({ user_id:user.id, flat_no:flat, area, landmark, city:'Pune' })
          .select().single();
        if (ae) throw ae;
        addressId = addr.id;
      }
      const { data: order, error: oe } = await supabase.from('orders')
        .insert({ customer_id:user.id, address_id:addressId, status:'pending_pickup', pickup_type:pickupType, payment_method:'cod', payment_status:'pending', total_paise:0, special_notes:specialNotes||null, promo_code:promoCode||null, discount_paise:discountPaise, language:'en' })
        .select().single();
      if (oe) throw oe;
      onConfirmed(order);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const isUrgent = pickupType === 'urgent';

  return (
    <div style={{ background:C.cream, minHeight:'100vh' }}>
      <div style={{ background:'#fff', padding:'12px 16px', display:'flex', alignItems:'center', gap:'10px', borderBottom:`1px solid ${C.border}`, position:'sticky', top:0, zIndex:10 }}>
        <button onClick={onBack} style={{ width:'30px', height:'30px', borderRadius:'50%', border:`1px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>←</button>
        <span style={{ fontSize:'15px', fontWeight:700, color:C.navy }}>Confirm pickup</span>
      </div>

      <div style={{ padding:'14px 16px 100px' }}>
        {/* Type badge */}
        <div style={{ borderRadius:'10px', padding:'10px 14px', fontSize:'12px', fontWeight:600, marginBottom:'12px', background:isUrgent?C.saffronLight:C.infoBg, color:isUrgent?C.saffron:C.info }}>
          {isUrgent ? '⚡ Urgent pickup — priority service' : '🕐 Standard pickup — within 1 hour'}
        </div>

        {/* Saved addresses */}
        <div style={{ background:'#fff', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'14px', marginBottom:'10px' }}>
          <div style={{ fontSize:'12px', fontWeight:700, color:C.navy, marginBottom:'10px' }}>📍 Pickup address</div>
          {saved.map(addr => (
            <div key={addr.id} onClick={() => setSelected(addr.id)}
              style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'10px', borderRadius:'10px', border:`1.5px solid ${selected===addr.id?C.saffron:C.border}`, background:selected===addr.id?'#FFF8F5':'#fff', cursor:'pointer', marginBottom:'8px' }}>
              <div style={{ width:'16px', height:'16px', borderRadius:'50%', border:`2px solid ${selected===addr.id?C.saffron:C.border}`, background:selected===addr.id?C.saffron:'#fff', flexShrink:0, marginTop:'2px' }} />
              <div>
                <div style={{ fontSize:'12px', fontWeight:600, color:C.navy }}>{addr.flat_no} {addr.area}</div>
                {addr.landmark && <div style={{ fontSize:'10px', color:C.stone }}>Near {addr.landmark}</div>}
                <div style={{ fontSize:'10px', color:C.stone }}>Pune</div>
              </div>
            </div>
          ))}
          <div onClick={() => setSelected(null)}
            style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px', borderRadius:'10px', border:`1.5px solid ${selected===null?C.saffron:C.border}`, background:selected===null?'#FFF8F5':'#fff', cursor:'pointer' }}>
            <div style={{ width:'16px', height:'16px', borderRadius:'50%', border:`2px solid ${selected===null?C.saffron:C.border}`, background:selected===null?C.saffron:'#fff', flexShrink:0 }} />
            <span style={{ fontSize:'12px', color:C.saffron, fontWeight:600 }}>+ {saved.length>0?'Use a different address':'Enter address'}</span>
          </div>

          {selected === null && (
            <div style={{ marginTop:'12px' }}>
              {[['Flat / Building','flat',flat,setFlat,'B-204, Sunrise Society'],['Area / Locality *','area',area,setArea,'Koregaon Park, Pune'],['Landmark','landmark',landmark,setLandmark,'Near D-Mart']].map(([lbl,key,val,setter,ph]) => (
                <div key={key} style={{ marginBottom:'8px' }}>
                  <label style={{ display:'block', fontSize:'10px', fontWeight:600, color:C.stone, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'4px' }}>{lbl}</label>
                  <input value={val} onChange={e => setter(e.target.value)} placeholder={ph}
                    style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${C.border}`, borderRadius:'8px', fontSize:'13px', fontFamily:'DM Sans, sans-serif', color:C.navy, outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Special instructions */}
        <div style={{ background:'#fff', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'14px', marginBottom:'14px' }}>
          <div style={{ fontSize:'12px', fontWeight:700, color:C.navy, marginBottom:'10px' }}>💬 Special instructions (optional)</div>
          <textarea value={specialNotes} onChange={e => setSpecialNotes(e.target.value.slice(0, 300))}
            placeholder="E.g. Handle silk saree with care, wine stain on blue shirt sleeve, do not fold the suit jacket"
            style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${C.border}`, borderRadius:'8px', fontSize:'13px', fontFamily:'DM Sans, sans-serif', color:C.navy, outline:'none', boxSizing:'border-box', minHeight:'70px', resize:'vertical' }} />
          <div style={{ fontSize:'10px', color:C.stone, textAlign:'right', marginTop:'4px' }}>{specialNotes.length} / 300</div>
        </div>

        {/* Promo code */}
        <div style={{ background:'#fff', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'14px', marginBottom:'14px' }}>
          <div style={{ fontSize:'12px', fontWeight:700, color:C.navy, marginBottom:'10px' }}>🎁 Promo code (optional)</div>
          <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
            <input value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder='Enter promo code'
              style={{ flex:1, padding:'10px 12px', border:`1.5px solid ${C.border}`, borderRadius:'8px', fontSize:'13px', fontFamily:'DM Sans, sans-serif', color:C.navy, outline:'none', boxSizing:'border-box' }} />
            <button onClick={applyPromoCode}
              style={{ padding:'10px 16px', background:C.navy, color:'#fff', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
              Apply
            </button>
          </div>
          {promoMsg && (
            <div style={{ fontSize:'12px', color:promoMsg.includes('Invalid')?C.danger:C.success, fontWeight:600, padding:'6px 10px', borderRadius:'6px', background:promoMsg.includes('Invalid')?C.dangerBg:C.successBg }}>
              {promoMsg}
            </div>
          )}
          {discountPaise > 0 && discountPaise !== 1 && (
            <div style={{ marginTop:'8px', fontSize:'13px', color:C.success, fontWeight:700, textAlign:'center', padding:'8px', background:C.successBg, borderRadius:'6px' }}>
              💰 Discount: {fmt.rupees(discountPaise)}
            </div>
          )}
        </div>

        {/* What happens next */}
        <div style={{ background:'#fff', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'14px', marginBottom:'14px' }}>
          <div style={{ fontSize:'12px', fontWeight:700, color:C.navy, marginBottom:'10px' }}>What happens next</div>
          {[['1','Rider assigned immediately'],['2',`Rider arrives within ${isUrgent?'priority time':'1 hour'}`],['3','Rider lists all your items at pickup'],['4','You get full item list + ETA notification'],['5','Pay on delivery — no upfront charge']].map(([n,t]) => (
            <div key={n} style={{ display:'flex', alignItems:'flex-start', gap:'10px', marginBottom:'9px' }}>
              <div style={{ width:'20px', height:'20px', borderRadius:'50%', background:C.navy, color:'#fff', fontSize:'9px', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:'1px' }}>{n}</div>
              <div style={{ fontSize:'12px', color:C.stone, lineHeight:1.5 }} dangerouslySetInnerHTML={{ __html:t.replace(/\*\*(.*?)\*\*/g,'<strong style="color:#0D1B3E">$1</strong>') }} />
            </div>
          ))}
        </div>

        {error && <p style={{ color:C.danger, fontSize:'12px', marginBottom:'10px', textAlign:'center' }}>{error}</p>}

        <button onClick={confirm} disabled={loading}
          style={{ width:'100%', padding:'15px', background:C.saffron, color:'#fff', border:'none', borderRadius:'12px', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'DM Sans, sans-serif', marginBottom:'8px' }}>
          {loading ? 'Requesting...' : `Request ${isUrgent?'⚡ Urgent':'Standard'} Pickup`}
        </button>
        <p style={{ textAlign:'center', fontSize:'11px', color:C.stone }}>💵 No payment needed now · Pay on delivery</p>
      </div>
    </div>
  );
}

// ── CONFIRMED ─────────────────────────────────────────────
function ConfirmedView({ order, onTrack }) {
  const [secs, setSecs] = useState(3600);
  useEffect(() => {
    const iv = setInterval(() => setSecs(s => Math.max(0, s-1)), 1000);
    return () => clearInterval(iv);
  }, []);
  const mm = String(Math.floor(secs/60)).padStart(2,'0');
  const ss = String(secs%60).padStart(2,'0');

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 24px', background:C.cream }}>
      <div style={{ fontSize:'56px', marginBottom:'14px' }}>🎉</div>
      <h2 style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'28px', color:C.navy, fontWeight:400, textAlign:'center', marginBottom:'8px' }}>Pickup requested!</h2>
      <p style={{ fontSize:'13px', color:C.stone, textAlign:'center', lineHeight:1.6, marginBottom:'28px' }}>
        Order <strong style={{ fontFamily:'monospace', color:C.navy }}>{order.order_number}</strong> confirmed.<br />A rider is being assigned now.
      </p>
      <div style={{ background:C.navy, borderRadius:'20px', padding:'22px 36px', width:'100%', textAlign:'center', marginBottom:'16px' }}>
        <div style={{ fontSize:'9px', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'6px' }}>Rider arriving within</div>
        <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'56px', color:'#fff', fontWeight:300, lineHeight:1 }}>{mm}:{ss}</div>
        <div style={{ fontSize:'9px', color:'rgba(255,255,255,0.4)', marginTop:'5px' }}>minutes · seconds</div>
      </div>
      {order.pickup_type === 'urgent' && (
        <div style={{ background:C.saffronLight, color:C.saffron, fontSize:'11px', fontWeight:700, padding:'6px 16px', borderRadius:'20px', marginBottom:'16px' }}>⚡ Urgent — priority pickup assigned</div>
      )}
      <button onClick={onTrack} style={{ width:'100%', padding:'14px', background:C.navy, color:'#fff', border:'none', borderRadius:'12px', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
        Track my order →
      </button>
    </div>
  );
}

// ── MY ORDERS ─────────────────────────────────────────────
function OrdersView({ onBack }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [cancelConfirm, setCancelConfirm] = useState(null);
  const [ratingOrder, setRatingOrder] = useState(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function cancelOrder(orderId) {
    setCancelConfirm(null);
    const { error } = await supabase.from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId)
      .eq('customer_id', user.id);
    if (error) { showToast('Error: ' + error.message); return; }
    showToast('Order cancelled');
    fetchOrders();
  }

  useEffect(() => {
    if (!user) return;
    fetchOrders();
    const ch = supabase.channel('my_orders')
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'orders', filter:`customer_id=eq.${user.id}` },
        () => fetchOrders()  // re-fetch to get joined items & tags — payload.new only has orders columns
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [user]);

  async function fetchOrders() {
    const { data } = await supabase.from('orders')
      .select('*, address:addresses(flat_no,area), items:order_items(service_name,quantity,price_paise), tags:garment_tags(tag_code,item_name,status), rating:order_ratings(rating,feedback)')
      .eq('customer_id', user.id)
      .order('created_at', { ascending:false });
    setOrders(data || []);
    setLoading(false);
  }

  async function submitRating(orderId) {
    if (ratingValue === 0) { showToast('Please select a rating'); return; }
    setSubmittingRating(true);
    const { error } = await supabase.from('order_ratings')
      .insert({ order_id:orderId, customer_id:user.id, rating:ratingValue, feedback:ratingFeedback||null });
    setSubmittingRating(false);
    if (error) { showToast('Error: ' + error.message); return; }
    showToast('Thank you for your feedback!');
    setRatingOrder(null);
    setRatingValue(0);
    setRatingFeedback('');
    fetchOrders();
  }

  return (
    <div style={{ background:C.cream, minHeight:'100vh', paddingBottom:'70px' }}>
      <div style={{ background:'#fff', padding:'12px 16px', display:'flex', alignItems:'center', gap:'10px', borderBottom:`1px solid ${C.border}`, position:'sticky', top:0, zIndex:10 }}>
        <button onClick={onBack} style={{ width:'30px', height:'30px', borderRadius:'50%', border:`1px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center' }}>←</button>
        <span style={{ fontSize:'15px', fontWeight:700, color:C.navy }}>My orders</span>
      </div>

      <div style={{ padding:'12px 16px' }}>
        {loading && <div style={{ textAlign:'center', padding:'60px', color:C.stone }}>Loading...</div>}
        {!loading && orders.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px' }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>📦</div>
            <p style={{ color:C.stone }}>No orders yet. Request your first pickup!</p>
          </div>
        )}
        {orders.map(order => (
          <div key={order.id} style={{ background:'#fff', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'14px', marginBottom:'12px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
              <div>
                <div style={{ fontSize:'10px', fontFamily:'monospace', fontWeight:700, color:C.stone }}>{order.order_number}</div>
                <div style={{ fontSize:'12px', color:C.stone, marginTop:'2px' }}>📍 {order.address?.area || '—'}</div>
                {order.pickup_type==='urgent' && <span style={{ fontSize:'9px', background:C.saffronLight, color:C.saffron, padding:'1px 6px', borderRadius:'6px', fontWeight:700 }}>⚡ Urgent</span>}
              </div>
              <div style={{ textAlign:'right' }}>
                <StatusBadge status={order.status} />
                <div style={{ fontSize:'14px', fontWeight:700, color:C.saffron, marginTop:'4px' }}>
                  {order.total_paise > 0 ? fmt.rupees(order.total_paise) : 'TBD'}
                </div>
                {order.estimated_delivery && <div style={{ fontSize:'10px', color:C.stone }}>Est. {fmt.date(order.estimated_delivery)}</div>}
              </div>
            </div>

            <ProgressBar status={order.status} />

            {/* Items after rider confirms */}
            {order.items_confirmed && order.items?.length > 0 && (
              <div style={{ borderTop:`1px solid ${C.linen}`, paddingTop:'8px', marginTop:'6px' }}>
                <div style={{ fontSize:'9px', fontWeight:700, color:C.stone, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>Items picked up</div>
                {order.items.map((item, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'4px' }}>
                    <span style={{ color:C.navy }}>{item.quantity}× {item.service_name}</span>
                    <span style={{ color:C.saffron, fontWeight:700 }}>{fmt.rupees(item.price_paise * item.quantity)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Garment tags */}
            {order.tags?.length > 0 && (
              <div style={{ marginTop:'10px', background:C.linen, borderRadius:'10px', padding:'10px' }}>
                <div style={{ fontSize:'9px', fontWeight:700, color:C.stone, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'7px' }}>Item tracking</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px' }}>
                  {order.tags.map(tag => (
                    <div key={tag.tag_code} style={{ background:'#fff', borderRadius:'7px', padding:'6px 8px', border:`1px solid ${C.border}` }}>
                      <div style={{ fontSize:'8px', fontFamily:'monospace', background:C.navy, color:'#fff', padding:'1px 5px', borderRadius:'3px', display:'inline-block', marginBottom:'2px' }}>{tag.tag_code}</div>
                      <div style={{ fontSize:'10px', fontWeight:600, color:C.navy }}>{tag.item_name}</div>
                      <div style={{ fontSize:'9px', fontWeight:700, color:['ready','packed'].includes(tag.status)?C.success:C.saffron }}>{tag.status.replace(/_/g,' ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rating (show for delivered orders without rating) */}
            {order.status === 'delivered' && (!order.rating || order.rating.length === 0) && (
              ratingOrder === order.id ? (
                <div style={{ marginTop:'10px', background:C.infoBg, borderRadius:'10px', padding:'12px', border:`1px solid ${C.info}` }}>
                  <div style={{ fontSize:'12px', fontWeight:700, color:C.navy, marginBottom:'10px' }}>How was your experience?</div>
                  <div style={{ display:'flex', gap:'8px', justifyContent:'center', marginBottom:'12px' }}>
                    {[1,2,3,4,5].map(star => (
                      <button key={star} onClick={() => setRatingValue(star)}
                        style={{ fontSize:'28px', border:'none', background:'transparent', cursor:'pointer', opacity:ratingValue>=star?1:0.3, transform:ratingValue>=star?'scale(1.1)':'scale(1)', transition:'all 0.15s' }}>
                        ⭐
                      </button>
                    ))}
                  </div>
                  <textarea value={ratingFeedback} onChange={e => setRatingFeedback(e.target.value.slice(0, 200))}
                    placeholder='Share your feedback (optional)'
                    style={{ width:'100%', padding:'8px 10px', border:`1px solid ${C.border}`, borderRadius:'6px', fontSize:'12px', fontFamily:'DM Sans, sans-serif', color:C.navy, outline:'none', boxSizing:'border-box', minHeight:'50px', marginBottom:'8px' }} />
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button onClick={() => setRatingOrder(null)}
                      style={{ flex:1, padding:'8px', border:`1px solid ${C.border}`, borderRadius:'6px', background:'#fff', fontSize:'11px', fontWeight:600, color:C.stone, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                      Skip
                    </button>
                    <button onClick={() => submitRating(order.id)} disabled={ratingValue===0 || submittingRating}
                      style={{ flex:1, padding:'8px', border:'none', borderRadius:'6px', background:C.success, fontSize:'11px', fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'DM Sans, sans-serif', opacity:submittingRating?0.7:1 }}>
                      {submittingRating ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setRatingOrder(order.id)}
                  style={{ width:'100%', marginTop:'10px', padding:'10px', border:`1.5px solid ${C.info}`, borderRadius:'8px', background:C.infoBg, fontSize:'12px', fontWeight:700, color:C.info, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                  ⭐ Rate your experience
                </button>
              )
            )}

            {/* Rating display (show if already rated) */}
            {order.status === 'delivered' && order.rating && order.rating.length > 0 && (
              <div style={{ marginTop:'10px', background:C.successBg, borderRadius:'10px', padding:'10px', border:`1px solid ${C.success}` }}>
                <div style={{ fontSize:'11px', color:C.success, fontWeight:700, marginBottom:'4px' }}>✓ Your rating</div>
                <div style={{ fontSize:'16px', letterSpacing:'2px', marginBottom:'4px' }}>
                  {Array(order.rating[0].rating).fill('⭐').join('')}
                </div>
                {order.rating[0].feedback && <div style={{ fontSize:'11px', color:C.navy, fontStyle:'italic' }}>{order.rating[0].feedback}</div>}
              </div>
            )}

            {order.payment_method === 'cod' && order.status !== 'delivered' && (
              <div style={{ marginTop:'10px', fontSize:'11px', color:C.stone, textAlign:'center', background:C.linen, padding:'7px', borderRadius:'8px' }}>
                💵 Pay on delivery · No upfront payment
              </div>
            )}

            {order.status === 'pending_pickup' && (
              cancelConfirm === order.id ? (
                <div style={{ marginTop:'10px', padding:'10px', background:C.dangerBg, borderRadius:'8px', border:`1px solid ${C.danger}` }}>
                  <div style={{ fontSize:'12px', color:C.danger, fontWeight:600, marginBottom:'8px', textAlign:'center' }}>Are you sure? This will cancel your pickup request.</div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button onClick={() => setCancelConfirm(null)}
                      style={{ flex:1, padding:'8px', border:`1px solid ${C.border}`, borderRadius:'8px', background:'#fff', fontSize:'12px', fontWeight:600, color:C.stone, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                      Keep order
                    </button>
                    <button onClick={() => cancelOrder(order.id)}
                      style={{ flex:1, padding:'8px', border:`1px solid ${C.danger}`, borderRadius:'8px', background:C.danger, fontSize:'12px', fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                      Yes, cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setCancelConfirm(order.id)}
                  style={{ width:'100%', marginTop:'10px', padding:'8px', border:`1px solid ${C.danger}`, borderRadius:'8px', background:'#fff', fontSize:'12px', fontWeight:600, color:C.danger, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                  Cancel order
                </button>
              )
            )}
          </div>
        ))}
      </div>

      {toast && (
        <div style={{ position:'fixed', bottom:'20px', left:'50%', transform:'translateX(-50%)', background:C.navy, color:'#fff', padding:'10px 18px', borderRadius:'10px', fontSize:'13px', fontWeight:500, zIndex:200, whiteSpace:'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── ACCOUNT ───────────────────────────────────────────────
function AccountView({ onBack }) {
  const { user, profile, signOut } = useAuth();
  const [addresses,   setAddresses]   = useState([]);
  const [addingNew,   setAddingNew]   = useState(false);
  const [flat,        setFlat]        = useState('');
  const [area,        setArea]        = useState('');
  const [landmark,    setLandmark]    = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  useEffect(() => { fetchAddresses(); }, []);

  async function fetchAddresses() {
    const { data } = await supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending:false });
    setAddresses(data || []);
  }

  async function addAddress() {
    if (!area.trim()) { setError('Please enter your area'); return; }
    setSaving(true); setError('');
    const { error: e } = await supabase.from('addresses')
      .insert({ user_id:user.id, flat_no:flat, area, landmark, city:'Pune', is_default: addresses.length === 0 });
    setSaving(false);
    if (e) { setError(e.message); return; }
    setFlat(''); setArea(''); setLandmark(''); setAddingNew(false);
    fetchAddresses();
  }

  async function setDefault(id) {
    await supabase.from('addresses').update({ is_default:false }).eq('user_id', user.id);
    await supabase.from('addresses').update({ is_default:true  }).eq('id', id);
    fetchAddresses();
  }

  async function deleteAddress(id) {
    await supabase.from('addresses').delete().eq('id', id);
    fetchAddresses();
  }

  return (
    <div style={{ background:C.cream, minHeight:'100vh', paddingBottom:'80px' }}>
      {/* Header */}
      <div style={{ background:C.navy, padding:'14px 16px 20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
          <button onClick={onBack} style={{ width:'30px', height:'30px', borderRadius:'50%', border:'1px solid rgba(255,255,255,0.2)', background:'transparent', cursor:'pointer', fontSize:'16px', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>←</button>
          <span style={{ fontSize:'15px', fontWeight:700, color:'#fff' }}>Account</span>
        </div>
        {/* Avatar + name */}
        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
          <div style={{ width:'52px', height:'52px', borderRadius:'50%', background:C.saffron, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', flexShrink:0 }}>
            {profile?.full_name?.charAt(0)?.toUpperCase() || '👤'}
          </div>
          <div>
            <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:'20px', color:'#fff', fontWeight:400 }}>{profile?.full_name || '—'}</div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.5)', marginTop:'2px' }}>{user?.email}</div>
            {profile?.phone && <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.5)' }}>{profile.phone}</div>}
          </div>
        </div>
      </div>

      <div style={{ padding:'16px' }}>
        {/* Saved addresses */}
        <div style={{ background:'#fff', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'14px', marginBottom:'12px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
            <div style={{ fontSize:'13px', fontWeight:700, color:C.navy }}>📍 Saved addresses</div>
            {!addingNew && (
              <button onClick={() => setAddingNew(true)}
                style={{ fontSize:'11px', fontWeight:700, color:C.saffron, background:C.saffronLight, border:'none', borderRadius:'8px', padding:'4px 10px', cursor:'pointer' }}>
                + Add new
              </button>
            )}
          </div>

          {addresses.length === 0 && !addingNew && (
            <div style={{ textAlign:'center', padding:'20px', color:C.stone, fontSize:'12px' }}>No saved addresses yet</div>
          )}

          {addresses.map(addr => (
            <div key={addr.id} style={{ borderRadius:'10px', border:`1.5px solid ${addr.is_default?C.saffron:C.border}`, padding:'10px 12px', marginBottom:'8px', background:addr.is_default?'#FFF8F5':'#fff' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'12px', fontWeight:600, color:C.navy }}>{addr.flat_no} {addr.area}</div>
                  {addr.landmark && <div style={{ fontSize:'10px', color:C.stone }}>Near {addr.landmark}</div>}
                  <div style={{ fontSize:'10px', color:C.stone }}>{addr.city}</div>
                  {addr.is_default && <span style={{ fontSize:'9px', fontWeight:700, color:C.saffron, background:C.saffronLight, padding:'2px 7px', borderRadius:'6px', display:'inline-block', marginTop:'4px' }}>Default</span>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'4px', alignItems:'flex-end', flexShrink:0 }}>
                  {!addr.is_default && (
                    <button onClick={() => setDefault(addr.id)}
                      style={{ fontSize:'10px', color:C.info, background:C.infoBg, border:'none', borderRadius:'6px', padding:'3px 8px', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                      Set default
                    </button>
                  )}
                  <button onClick={() => deleteAddress(addr.id)}
                    style={{ fontSize:'10px', color:C.danger, background:C.dangerBg, border:'none', borderRadius:'6px', padding:'3px 8px', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

          {addingNew && (
            <div style={{ marginTop:'8px', borderTop:`1px solid ${C.border}`, paddingTop:'12px' }}>
              <div style={{ fontSize:'11px', fontWeight:700, color:C.navy, marginBottom:'10px' }}>New address</div>
              {[['Flat / Building','flat',flat,setFlat,'B-204, Sunrise Society'],['Area / Locality *','area',area,setArea,'Koregaon Park'],['Landmark','landmark',landmark,setLandmark,'Near D-Mart']].map(([lbl,key,val,setter,ph]) => (
                <div key={key} style={{ marginBottom:'8px' }}>
                  <label style={{ display:'block', fontSize:'10px', fontWeight:600, color:C.stone, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'4px' }}>{lbl}</label>
                  <input value={val} onChange={e => setter(e.target.value)} placeholder={ph}
                    style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${C.border}`, borderRadius:'8px', fontSize:'13px', fontFamily:'DM Sans, sans-serif', color:C.navy, outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
              {error && <p style={{ color:C.danger, fontSize:'11px', marginBottom:'8px' }}>{error}</p>}
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={() => { setAddingNew(false); setError(''); setFlat(''); setArea(''); setLandmark(''); }}
                  style={{ flex:1, padding:'10px', border:`1px solid ${C.border}`, borderRadius:'8px', background:'#fff', fontSize:'12px', fontWeight:600, color:C.stone, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                  Cancel
                </button>
                <button onClick={addAddress} disabled={saving}
                  style={{ flex:1, padding:'10px', border:'none', borderRadius:'8px', background:C.saffron, fontSize:'12px', fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                  {saving ? 'Saving…' : 'Save address'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sign out — fixed to bottom */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'12px 16px', background:C.cream, borderTop:`1px solid ${C.border}`, maxWidth:'480px', margin:'0 auto', boxSizing:'border-box' }}>
        <button onClick={signOut}
          style={{ width:'100%', padding:'14px', border:`1.5px solid ${C.danger}`, borderRadius:'12px', background:'#fff', fontSize:'14px', fontWeight:700, color:C.danger, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── CUSTOMER APP (root view with tabs) ────────────────────
export default function CustomerApp() {
  const { profile } = useAuth();
  const [view,       setView]       = useState('home'); // home | confirm | confirmed | orders | account
  const [pickupType, setPickupType] = useState('standard');
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  if (view === 'confirm') return <ConfirmView pickupType={pickupType} onConfirmed={order => { setConfirmedOrder(order); setView('confirmed'); }} onBack={() => setView('home')} />;
  if (view === 'confirmed') return <ConfirmedView order={confirmedOrder} onTrack={() => setView('orders')} />;
  if (view === 'orders') return <OrdersView onBack={() => setView('home')} />;
  if (view === 'account') return <AccountView onBack={() => setView('home')} />;

  return (
    <div style={{ position:'relative' }}>
      <HomeView profile={profile} onPickup={type => { setPickupType(type); setView('confirm'); }} onViewOrders={() => setView('orders')} />
      {/* Bottom nav */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#fff', borderTop:`1px solid ${C.border}`, display:'flex', zIndex:100, boxShadow:'0 -4px 20px rgba(0,0,0,0.06)', maxWidth:'480px', margin:'0 auto' }}>
        {[['🏠','Home',()=>setView('home'),view==='home'],['📦','Orders',()=>setView('orders'),view==='orders'],['👤','Account',()=>setView('account'),view==='account']].map(([icon,label,action,active]) => (
          <button key={label} onClick={action}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', padding:'10px 0 8px', border:'none', background:'none', cursor:'pointer', fontFamily:'DM Sans, sans-serif', color:active?C.saffron:C.stone }}>
            <span style={{ fontSize:'19px' }}>{icon}</span>
            <span style={{ fontSize:'9px', fontWeight:500 }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
