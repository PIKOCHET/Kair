import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage    from './pages/LoginPage';
import CheckoutPage from './pages/CheckoutPage';
import OrdersPage   from './pages/OrdersPage';
import { supabase } from './lib/supabase';

// ── Translations ──────────────────────────────────────────
const T = {
  en: { home: 'Home', orders: 'Orders', ops: 'Ops', greeting: 'Good day 👋', tagline: 'Your clothes, in safe hands', services: 'Our services', addToCart: 'Add', viewCart: 'View cart' },
  hi: { home: 'होम',  orders: 'ऑर्डर', ops: 'ऑप्स', greeting: 'नमस्ते 👋',   tagline: 'आपके कपड़े, सुरक्षित हाथों में', services: 'हमारी सेवाएं', addToCart: 'जोड़ें', viewCart: 'कार्ट देखें' },
  mr: { home: 'होम',  orders: 'ऑर्डर', ops: 'ऑप्स', greeting: 'नमस्कार 👋',  tagline: 'तुमचे कपडे, सुरक्षित हातात', services: 'आमच्या सेवा', addToCart: 'जोडा', viewCart: 'कार्ट पहा' },
};

const SERVICES = {
  clothes: [
    { service_id:'c1', emoji:'👕', name_en:'Wash & Fold',     price_paise:4900,  unit:'per kg',    description:'Machine washed & neatly folded' },
    { service_id:'c2', emoji:'👔', name_en:'Wash & Iron',     price_paise:7900,  unit:'per kg',    description:'Washed, dried and ironed' },
    { service_id:'c3', emoji:'🥼', name_en:'Dry Cleaning',    price_paise:14900, unit:'per item',  description:'Expert dry cleaning' },
    { service_id:'c4', emoji:'🧥', name_en:'Jacket / Coat',   price_paise:19900, unit:'per item',  description:'Heavy outerwear pressed' },
    { service_id:'c5', emoji:'🥻', name_en:'Saree / Lehenga', price_paise:12900, unit:'per item',  description:'Delicate ethnic wear' },
    { service_id:'c6', emoji:'👖', name_en:'Denims / Jeans',  price_paise:5900,  unit:'per piece', description:'Deep clean treatment' },
  ],
  shoes: [
    { service_id:'s1', emoji:'👟', name_en:'Sneaker Deep Clean',    price_paise:29900, unit:'per pair',  description:'Full clean & sole restore' },
    { service_id:'s2', emoji:'👞', name_en:'Leather Shoes Polish',  price_paise:19900, unit:'per pair',  description:'Clean, condition & polish' },
    { service_id:'s3', emoji:'👡', name_en:'Heels / Sandals',       price_paise:14900, unit:'per pair',  description:'Gentle clean & refresh' },
  ],
  curtains: [
    { service_id:'cu1', emoji:'🪟', name_en:'Curtains – Regular',  price_paise:9900,  unit:'per panel', description:'Machine wash, dry & fold' },
    { service_id:'cu2', emoji:'🎭', name_en:'Curtains – Blackout', price_paise:14900, unit:'per panel', description:'Deep clean heavy curtains' },
    { service_id:'cu3', emoji:'🛋️', name_en:'Sofa Cover / Cushion',price_paise:12900, unit:'per piece', description:'Wash, dry and refresh' },
  ],
  household: [
    { service_id:'h1', emoji:'🛏️', name_en:'Bedsheet set',    price_paise:12900, unit:'per set',   description:'Sheet + 2 pillow covers' },
    { service_id:'h2', emoji:'🛁', name_en:'Blanket / Duvet', price_paise:24900, unit:'per piece', description:'Large item deep wash' },
    { service_id:'h3', emoji:'🧸', name_en:'Soft toys',       price_paise:9900,  unit:'per piece', description:'Gentle wash & dry' },
    { service_id:'h4', emoji:'🧴', name_en:'Bath Towels',     price_paise:3900,  unit:'per piece', description:'Wash, fresh & fold' },
  ],
};

const CATS = [
  { id:'clothes',   label:{en:'Clothes',   hi:'कपड़े',  mr:'कपडे'},  emoji:'👕', count:'6 services' },
  { id:'shoes',     label:{en:'Shoes',     hi:'जूते',   mr:'बूट'},   emoji:'👟', count:'3 services' },
  { id:'curtains',  label:{en:'Curtains',  hi:'पर्दे',  mr:'पडदे'},  emoji:'🪟', count:'3 services' },
  { id:'household', label:{en:'Household', hi:'घरेलू',  mr:'घरगुती'},emoji:'🛏️', count:'4 services' },
];

// ── Main inner app (after auth) ───────────────────────────
function MainApp() {
  const { profile, signOut } = useAuth();
  const [tab,     setTab]     = useState('home');
  const [cat,     setCat]     = useState('clothes');
  const [cart,    setCart]    = useState({});
  const [lang,    setLang]    = useState(profile?.language_pref || 'en');
  const [etaSecs, setEtaSecs] = useState(null);
  const [checkoutDone, setCheckoutDone] = useState(false);

  const t = T[lang];
  const cartCount  = Object.values(cart).reduce((s,i) => s + i.quantity, 0);
  const cartTotal  = Object.values(cart).reduce((s,i) => s + (i.price_paise * i.quantity), 0);

  function addToCart(svc) {
    setCart(prev => ({
      ...prev,
      [svc.service_id]: prev[svc.service_id]
        ? { ...prev[svc.service_id], quantity: prev[svc.service_id].quantity + 1 }
        : { ...svc, quantity: 1 },
    }));
  }

  function changeQty(id, delta) {
    setCart(prev => {
      const qty = (prev[id]?.quantity || 0) + delta;
      if (qty <= 0) { const n = { ...prev }; delete n[id]; return n; }
      return { ...prev, [id]: { ...prev[id], quantity: qty } };
    });
  }

  function startEta() {
    setEtaSecs(1200);
    const iv = setInterval(() => {
      setEtaSecs(s => { if (s <= 1) { clearInterval(iv); return null; } return s - 1; });
    }, 1000);
  }

  function handleOrderSuccess(order) {
    setCart({});
    setCheckoutDone(false);
    setTab('orders');
    startEta();
  }

  const fmtEta = etaSecs ? `${String(Math.floor(etaSecs/60)).padStart(2,'0')}:${String(etaSecs%60).padStart(2,'0')}` : null;

  // Show checkout
  if (checkoutDone) return (
    <CheckoutPage cart={cart} onSuccess={handleOrderSuccess} onBack={() => setCheckoutDone(false)} />
  );

  return (
    <div style={{ fontFamily: 'Poppins, sans-serif', background: '#FAFAF8', minHeight: '100vh' }}>

      {/* Top nav */}
      <nav style={S.nav}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={S.navIcon}>🧺</div>
          <div>
            <div style={S.navBrand}>Kair <span style={S.navBadge}>PUNE</span></div>
            <div style={S.navSub}>{t.tagline}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={S.langPill}>
            {['en','hi','mr'].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{ ...S.langBtn, ...(lang===l ? S.langBtnActive : {}) }}>
                {l==='en'?'EN':l==='hi'?'हि':'म'}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <div style={{ padding:'16px 16px 80px' }}>

        {tab === 'home' && (
          <>
            {/* Hero */}
            <div style={S.hero}>
              <div style={S.heroGreeting}>{t.greeting}</div>
              <div style={S.heroName}>{profile?.full_name || 'Welcome'}</div>
              <div style={S.heroPill}>⚡ <span style={{ color:'#FF6B00', fontWeight:700 }}>{t.tagline}</span> · after booking</div>
              <div style={S.heroArea}>📍 <span style={S.areaBadge}>Pune</span></div>
            </div>

            {/* ETA banner */}
            {fmtEta && (
              <div style={S.etaBanner}>
                <div>
                  <div style={{ fontSize:'11px', opacity:0.85 }}>Rider arriving in</div>
                  <div style={{ fontSize:'28px', fontWeight:700 }}>{fmtEta}</div>
                </div>
                <div style={S.riderChip}>🏍️ &nbsp;Raju Patil<br/><span style={{fontSize:'10px',opacity:0.8}}>+91 98220 34567</span></div>
              </div>
            )}

            {/* Category tabs */}
            <div style={S.catRow}>
              {CATS.map(c => (
                <div key={c.id} onClick={() => setCat(c.id)}
                  style={{ ...S.catCard, ...(cat===c.id ? S.catCardActive : {}) }}>
                  <div style={{ fontSize:'26px', marginBottom:'5px' }}>{c.emoji}</div>
                  <div style={{ fontSize:'11px', fontWeight:700 }}>{c.label[lang]}</div>
                  <div style={{ fontSize:'10px', color:'#6B6B6B', marginTop:'2px' }}>{c.count}</div>
                </div>
              ))}
            </div>

            {/* Services */}
            <h3 style={{ fontSize:'15px', fontWeight:700, marginBottom:'12px' }}>{t.services}</h3>
            {(SERVICES[cat]||[]).map(svc => {
              const inCart = cart[svc.service_id]?.quantity || 0;
              return (
                <div key={svc.service_id} style={S.svcItem}>
                  <div style={S.svcEmoji}>{svc.emoji}</div>
                  <div style={{ flex:1 }}>
                    <div style={S.svcName}>{svc.name_en}</div>
                    <div style={S.svcDesc}>{svc.description}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={S.svcPrice}>₹{(svc.price_paise/100).toFixed(0)}<span style={{ fontSize:'10px', color:'#6B6B6B', fontWeight:400 }}> {svc.unit}</span></div>
                    <div style={{ marginTop:'6px' }}>
                      {inCart === 0 ? (
                        <button onClick={() => addToCart(svc)} style={S.addBtn}>+</button>
                      ) : (
                        <div style={S.qtyCtrl}>
                          <button onClick={() => changeQty(svc.service_id, -1)} style={S.qtyBtn}>−</button>
                          <span style={S.qtyNum}>{inCart}</span>
                          <button onClick={() => changeQty(svc.service_id,  1)} style={S.qtyBtn}>+</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === 'orders' && <OrdersPage />}
      </div>

      {/* Cart bar */}
      {cartCount > 0 && tab === 'home' && (
        <div style={S.cartBar}>
          <div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.6)' }}>{cartCount} item{cartCount>1?'s':''} added</div>
            <div style={{ fontSize:'16px', fontWeight:700, color:'#fff' }}>
              Total: <span style={{ color:'#FF6B00' }}>₹{(cartTotal/100).toFixed(0)}</span>
            </div>
          </div>
          <button onClick={() => setCheckoutDone(true)} style={S.cartCta}>{t.viewCart} →</button>
        </div>
      )}

      {/* Bottom nav */}
      <div style={S.bottomNav}>
        {[['home','🏠',t.home],['orders','📦',t.orders]].map(([id,icon,label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ ...S.bnavItem, ...(tab===id ? S.bnavActive : {}) }}>
            <span style={{ fontSize:'20px', position:'relative' }}>
              {icon}
              {id==='orders' && cartCount > 0 && <span style={S.bnavBadge}>{cartCount}</span>}
            </span>
            <span style={{ fontSize:'10px', fontWeight:500 }}>{label}</span>
          </button>
        ))}
        <button onClick={signOut} style={S.bnavItem}>
          <span style={{ fontSize:'20px' }}>👤</span>
          <span style={{ fontSize:'10px', fontWeight:500 }}>Sign out</span>
        </button>
      </div>
    </div>
  );
}

// ── Root: auth gate ───────────────────────────────────────
function AppInner() {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontSize:'32px' }}>🧺</div>;
  if (!isLoggedIn) return <LoginPage onSuccess={() => {}} />;
  return <MainApp />;
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}

// ── Styles ────────────────────────────────────────────────
const S = {
  nav:          { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'#0D1B3E', position:'sticky', top:0, zIndex:100 },
  navIcon:      { width:'36px', height:'36px', background:'#FF6B00', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px' },
  navBrand:     { color:'#fff', fontSize:'17px', fontWeight:700, lineHeight:1 },
  navBadge:     { fontSize:'10px', background:'rgba(255,107,0,0.3)', color:'#FF8C33', padding:'1px 6px', borderRadius:'4px', fontWeight:600, marginLeft:'4px' },
  navSub:       { color:'rgba(255,255,255,0.5)', fontSize:'10px', fontWeight:400 },
  langPill:     { display:'flex', background:'rgba(255,255,255,0.1)', borderRadius:'20px', overflow:'hidden' },
  langBtn:      { padding:'5px 9px', fontSize:'10px', fontWeight:600, color:'rgba(255,255,255,0.6)', cursor:'pointer', border:'none', background:'transparent', fontFamily:'Poppins, sans-serif' },
  langBtnActive:{ background:'#FF6B00', color:'#fff' },
  hero:         { background:'#0D1B3E', borderRadius:'16px', padding:'20px', marginBottom:'16px', color:'#fff' },
  heroGreeting: { fontSize:'12px', color:'rgba(255,255,255,0.5)', marginBottom:'3px' },
  heroName:     { fontSize:'20px', fontWeight:700, marginBottom:'10px' },
  heroPill:     { background:'rgba(255,107,0,0.2)', border:'1px solid rgba(255,107,0,0.4)', borderRadius:'8px', padding:'8px 12px', fontSize:'12px', color:'#fff', marginBottom:'10px' },
  heroArea:     { fontSize:'12px', color:'rgba(255,255,255,0.6)' },
  areaBadge:    { background:'#FF6B00', color:'#fff', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:600, marginLeft:'4px' },
  etaBanner:    { background:'#FF6B00', borderRadius:'12px', padding:'14px 16px', marginBottom:'16px', display:'flex', alignItems:'center', justifyContent:'space-between', color:'#fff' },
  riderChip:    { background:'rgba(255,255,255,0.2)', padding:'8px 12px', borderRadius:'8px', fontSize:'12px', fontWeight:600 },
  catRow:       { display:'flex', gap:'10px', overflowX:'auto', paddingBottom:'4px', marginBottom:'16px', scrollbarWidth:'none' },
  catCard:      { flexShrink:0, width:'90px', background:'#fff', borderRadius:'12px', border:'2px solid #E8E8E8', padding:'10px 6px', textAlign:'center', cursor:'pointer' },
  catCardActive:{ borderColor:'#FF6B00', background:'#FFF0E5' },
  svcItem:      { background:'#fff', borderRadius:'12px', border:'1px solid #E8E8E8', padding:'14px', display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px' },
  svcEmoji:     { width:'42px', height:'42px', background:'#F5F4F1', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', flexShrink:0 },
  svcName:      { fontSize:'13px', fontWeight:600, color:'#0D1B3E', marginBottom:'2px' },
  svcDesc:      { fontSize:'11px', color:'#6B6B6B', lineHeight:1.4 },
  svcPrice:     { fontSize:'13px', fontWeight:700, color:'#FF6B00' },
  addBtn:       { width:'28px', height:'28px', borderRadius:'50%', background:'#FF6B00', border:'none', color:'#fff', fontSize:'18px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', marginLeft:'auto' },
  qtyCtrl:      { display:'flex', alignItems:'center', gap:'6px' },
  qtyBtn:       { width:'26px', height:'26px', borderRadius:'50%', border:'1.5px solid #FF6B00', background:'#fff', color:'#FF6B00', fontSize:'15px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 },
  qtyNum:       { fontSize:'14px', fontWeight:700, minWidth:'18px', textAlign:'center', color:'#0D1B3E' },
  cartBar:      { position:'fixed', bottom:'64px', left:'12px', right:'12px', background:'#0D1B3E', borderRadius:'14px', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', zIndex:99, boxShadow:'0 4px 24px rgba(0,0,0,0.25)' },
  cartCta:      { background:'#FF6B00', color:'#fff', border:'none', padding:'10px 20px', borderRadius:'10px', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Poppins, sans-serif' },
  bottomNav:    { position:'fixed', bottom:0, left:0, right:0, background:'#fff', borderTop:'1px solid #E8E8E8', display:'flex', zIndex:100, boxShadow:'0 -4px 20px rgba(0,0,0,0.08)' },
  bnavItem:     { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', padding:'10px 0 8px', cursor:'pointer', color:'#6B6B6B', border:'none', background:'none', fontFamily:'Poppins, sans-serif' },
  bnavActive:   { color:'#FF6B00' },
  bnavBadge:    { position:'absolute', top:'-4px', right:'-6px', background:'#FF6B00', color:'#fff', fontSize:'9px', fontWeight:700, width:'15px', height:'15px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' },
};
