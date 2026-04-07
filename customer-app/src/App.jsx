import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';

// ── Fonts loaded via index.html ──────────────────────────
// Cormorant Garamond (display) + DM Sans (body)

const COLORS = {
  navy:    '#0D1B3E',
  saffron: '#FF6B00',
  cream:   '#FAF8F4',
  gold:    '#C8A96E',
  stone:   '#6B6860',
  linen:   '#F0EDE8',
  border:  '#E4E0D9',
  success: '#0A7A4B',
  successLight: '#E5F5EE',
};

// ── ETA calculator ────────────────────────────────────────
function calcETA(items, pickupType) {
  if (!items || items.length === 0) return null;
  const maxTat = Math.max(...items.map(i => i.tat_days || 2));
  const extra = pickupType === 'urgent' ? -1 : 0; // urgent = 1 day faster (future)
  const days = Math.max(1, maxTat + extra);
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ── SCREEN: LOGIN ─────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [isSignup, setIsSignup] = useState(false);

  async function handle() {
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    const fn = isSignup
      ? supabase.auth.signUp({ email, password })
      : supabase.auth.signInWithPassword({ email, password });
    const { error: e } = await fn;
    if (e) { setError(e.message); setLoading(false); return; }
    onLogin();
    setLoading(false);
  }

  return (
    <div style={S.loginPage}>
      <div style={S.loginBox}>
        <div style={S.loginLogo}>🧺</div>
        <h1 style={S.loginBrand}>Kair</h1>
        <p style={S.loginTag}>Your clothes, in safe hands</p>

        <div style={S.formGroup}>
          <label style={S.label}>Email</label>
          <input style={S.input} type="email" value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
            placeholder="you@email.com"
            onKeyDown={e => e.key === 'Enter' && handle()} />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Password</label>
          <input style={S.input} type="password" value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            placeholder="••••••••"
            onKeyDown={e => e.key === 'Enter' && handle()} />
        </div>
        {error && <p style={S.errorTxt}>{error}</p>}
        <button onClick={handle} disabled={loading} style={S.primaryBtn}>
          {loading ? 'Please wait...' : isSignup ? 'Create account' : 'Sign in'}
        </button>
        <button onClick={() => { setIsSignup(!isSignup); setError(''); }} style={S.ghostBtn}>
          {isSignup ? 'Already have an account? Sign in' : 'New to Kair? Create account'}
        </button>
      </div>
    </div>
  );
}

// ── SCREEN: HOME — ONE TAP PICKUP ─────────────────────────
function HomeScreen({ user, profile, onPickup, onViewOrders }) {
  const [activeOrders, setActiveOrders] = useState([]);

  useEffect(() => {
    supabase.from('orders')
      .select('id, order_number, status, pickup_type, estimated_delivery, items_confirmed')
      .eq('customer_id', user.id)
      .not('status', 'in', '("delivered","cancelled")')
      .order('created_at', { ascending: false })
      .then(({ data }) => setActiveOrders(data || []));
  }, [user.id]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const STATUS_MAP = {
    pending_pickup:    { label: 'Rider on the way',  color: COLORS.saffron, bg: '#FFF3E0' },
    rider_assigned:    { label: 'Rider assigned',    color: COLORS.saffron, bg: '#FFF3E0' },
    picked_up:         { label: 'Picked up',         color: '#1A5FBF',      bg: '#E5F0FF' },
    in_cleaning:       { label: 'Being cleaned',     color: '#1A5FBF',      bg: '#E5F0FF' },
    quality_check:     { label: 'Quality check',     color: COLORS.success, bg: COLORS.successLight },
    ready:             { label: 'Ready for delivery',color: COLORS.success, bg: COLORS.successLight },
    out_for_delivery:  { label: 'Out for delivery',  color: COLORS.saffron, bg: '#FFF3E0' },
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.homeHeader}>
        <div style={S.homeHeaderTop}>
          <div style={S.brandRow}>
            <div style={S.brandIcon}>🧺</div>
            <div>
              <div style={S.brandName}>Kair</div>
              <div style={S.brandSub}>Your clothes, in safe hands</div>
            </div>
          </div>
          <div style={S.locationChip}>
            <span style={{ fontSize: '12px' }}>📍</span>
            <span>Pune</span>
          </div>
        </div>
        <div style={S.greeting}>{greeting()}, {profile?.full_name?.split(' ')[0] || 'there'} 👋</div>
      </div>

      {/* Active orders strip */}
      {activeOrders.length > 0 && (
        <div style={S.activeStrip}>
          {activeOrders.map(order => {
            const s = STATUS_MAP[order.status] || { label: order.status, color: COLORS.stone, bg: COLORS.linen };
            return (
              <div key={order.id} style={S.activeOrderChip} onClick={onViewOrders}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={S.activeOrderId}>{order.order_number}</span>
                  {order.pickup_type === 'urgent' && (
                    <span style={S.urgentBadge}>⚡ Urgent</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                  <span style={{ ...S.statusDot, background: s.color, color: s.color === '#fff' ? COLORS.navy : '#fff' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color, display: 'inline-block', marginRight: '5px' }} />
                    {s.label}
                  </span>
                  {order.estimated_delivery && (
                    <span style={S.etaChip}>
                      📅 Est. {new Date(order.estimated_delivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main pickup section */}
      <div style={S.pickupSection}>
        <div style={S.pickupCard}>
          <div style={S.pickupCardTop}>
            <div style={S.pickupTitle}>Ready for a pickup?</div>
            <div style={S.pickupSub}>We'll be at your door within 1 hour</div>
          </div>

          {/* Pickup type selector */}
          <div style={S.pickupTypeRow}>
            <PickupTypeBtn
              type="standard"
              icon="🕐"
              title="Standard"
              sub="Within 1 hour"
              onPress={() => onPickup('standard')}
            />
            <PickupTypeBtn
              type="urgent"
              icon="⚡"
              title="Urgent"
              sub="Priority pickup"
              onPress={() => onPickup('urgent')}
              isUrgent
            />
          </div>
        </div>

        {/* How it works */}
        <div style={S.howItWorks}>
          <div style={S.howTitle}>How Kair works</div>
          <div style={S.howSteps}>
            {[
              { icon: '📱', step: '1', text: 'Request a pickup' },
              { icon: '🏍️', step: '2', text: 'Rider arrives within 1 hour' },
              { icon: '🧺', step: '3', text: 'We clean with expert care' },
              { icon: '✨', step: '4', text: 'Delivered back to your door' },
            ].map((s, i) => (
              <div key={i} style={S.howStep}>
                <div style={S.howStepIcon}>{s.icon}</div>
                <div style={S.howStepNum}>{s.step}</div>
                <div style={S.howStepText}>{s.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Services preview */}
        <div style={S.servicesPreview}>
          <div style={S.sectionTitle}>What we clean</div>
          <div style={S.serviceChips}>
            {[
              { icon: '👔', name: 'Wash & Iron', tat: '4 days' },
              { icon: '🥼', name: 'Dry Cleaning', tat: '7 days' },
              { icon: '👟', name: 'Shoes', tat: '7 days' },
              { icon: '🪟', name: 'Curtains', tat: '4 days' },
              { icon: '🛏️', name: 'Household', tat: '2 days' },
            ].map((s, i) => (
              <div key={i} style={S.serviceChip}>
                <span style={{ fontSize: '20px' }}>{s.icon}</span>
                <span style={S.serviceChipName}>{s.name}</span>
                <span style={S.serviceChipTat}>{s.tat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={S.bottomNav}>
        <button style={{ ...S.bnavItem, color: COLORS.saffron }} onClick={() => {}}>
          <span style={{ fontSize: '20px' }}>🏠</span>
          <span style={S.bnavLabel}>Home</span>
        </button>
        <button style={S.bnavItem} onClick={onViewOrders}>
          <span style={{ fontSize: '20px', position: 'relative' }}>
            📦
            {activeOrders.length > 0 && (
              <span style={S.bnavBadge}>{activeOrders.length}</span>
            )}
          </span>
          <span style={S.bnavLabel}>Orders</span>
        </button>
        <button style={S.bnavItem} onClick={() => supabase.auth.signOut()}>
          <span style={{ fontSize: '20px' }}>👤</span>
          <span style={S.bnavLabel}>Account</span>
        </button>
      </div>
    </div>
  );
}

function PickupTypeBtn({ icon, title, sub, onPress, isUrgent }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      style={{
        ...S.pickupTypeBtn,
        ...(isUrgent ? S.pickupTypeBtnUrgent : S.pickupTypeBtnStd),
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onClick={onPress}
    >
      <span style={{ fontSize: '28px', marginBottom: '6px' }}>{icon}</span>
      <span style={{ fontSize: '15px', fontWeight: 700, marginBottom: '2px' }}>{title}</span>
      <span style={{ fontSize: '11px', opacity: 0.8 }}>{sub}</span>
    </button>
  );
}

// ── SCREEN: CONFIRM PICKUP ────────────────────────────────
function ConfirmPickupScreen({ user, profile, pickupType, onConfirmed, onBack }) {
  const [address,   setAddress]   = useState({ flat: '', area: '', landmark: '' });
  const [saved,     setSaved]     = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  // Load saved addresses
  useEffect(() => {
    supabase.from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .then(({ data }) => {
        if (data?.length) {
          setSaved(data);
          setSelected(data[0].id);
        }
      });
  }, [user.id]);

  async function confirmPickup() {
    setLoading(true); setError('');
    try {
      let addressId = selected;

      // If no saved address selected, save new one
      if (!selected) {
        if (!address.area.trim()) { setError('Please enter your area'); setLoading(false); return; }
        const { data: newAddr, error: addrErr } = await supabase
          .from('addresses')
          .insert({ user_id: user.id, flat_no: address.flat, area: address.area, landmark: address.landmark, city: 'Pune' })
          .select().single();
        if (addrErr) throw addrErr;
        addressId = newAddr.id;
      }

      // Create order — minimal, no items yet
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          customer_id:    user.id,
          address_id:     addressId,
          status:         'pending_pickup',
          pickup_type:    pickupType,
          payment_method: 'cod',
          payment_status: 'pending',
          total_paise:    0,
          language:       'en',
        })
        .select().single();

      if (orderErr) throw orderErr;
      onConfirmed(order);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.screenHeader}>
        <button onClick={onBack} style={S.backBtn}>←</button>
        <span style={S.screenTitle}>Confirm pickup</span>
      </div>

      <div style={{ padding: '16px 16px 100px' }}>
        {/* Pickup type badge */}
        <div style={{ ...S.pickupTypeBadge, ...(pickupType === 'urgent' ? S.urgentPickupBadge : S.stdPickupBadge) }}>
          {pickupType === 'urgent' ? '⚡ Urgent pickup — priority service' : '🕐 Standard pickup — within 1 hour'}
        </div>

        {/* Saved addresses */}
        {saved.length > 0 && (
          <div style={S.card}>
            <div style={S.cardTitle}>📍 Pickup address</div>
            {saved.map(addr => (
              <div key={addr.id}
                onClick={() => setSelected(addr.id)}
                style={{ ...S.addrOption, ...(selected === addr.id ? S.addrOptionSelected : {}) }}>
                <div style={S.addrOptionDot(selected === addr.id)} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: COLORS.navy }}>{addr.flat_no} {addr.area}</div>
                  {addr.landmark && <div style={{ fontSize: '11px', color: COLORS.stone, marginTop: '2px' }}>Near {addr.landmark}</div>}
                  <div style={{ fontSize: '11px', color: COLORS.stone }}>Pune</div>
                </div>
              </div>
            ))}
            <button
              onClick={() => setSelected(null)}
              style={{ ...S.addrOption, ...(selected === null ? S.addrOptionSelected : {}), marginTop: '8px' }}>
              <div style={S.addrOptionDot(selected === null)} />
              <span style={{ fontSize: '13px', color: COLORS.saffron, fontWeight: 600 }}>+ Use a different address</span>
            </button>
          </div>
        )}

        {/* New address form */}
        {(saved.length === 0 || selected === null) && (
          <div style={S.card}>
            <div style={S.cardTitle}>📍 {saved.length > 0 ? 'New address' : 'Your address'}</div>
            <div style={S.formGroup}>
              <label style={S.label}>Flat / Building</label>
              <input style={S.input} value={address.flat}
                onChange={e => setAddress({ ...address, flat: e.target.value })}
                placeholder="B-204, Sunrise Society" />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Area / Locality *</label>
              <input style={S.input} value={address.area}
                onChange={e => setAddress({ ...address, area: e.target.value })}
                placeholder="Koregaon Park, Pune" />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Landmark</label>
              <input style={S.input} value={address.landmark}
                onChange={e => setAddress({ ...address, landmark: e.target.value })}
                placeholder="Near D-Mart" />
            </div>
          </div>
        )}

        {/* What happens next */}
        <div style={S.card}>
          <div style={S.cardTitle}>What happens next</div>
          <div style={{ fontSize: '13px', color: COLORS.stone, lineHeight: 1.7 }}>
            1. We assign a rider immediately{'\n'}
            2. Rider arrives within <strong style={{ color: COLORS.navy }}>1 hour</strong>{'\n'}
            3. Rider lists all your items{'\n'}
            4. You get notified with full item list + ETA{'\n'}
            5. Pay on delivery — no upfront payment
          </div>
        </div>

        {error && <p style={S.errorTxt}>{error}</p>}

        <button onClick={confirmPickup} disabled={loading} style={S.primaryBtn}>
          {loading ? 'Requesting...' : `Request ${pickupType === 'urgent' ? '⚡ Urgent' : 'Standard'} Pickup`}
        </button>
        <p style={{ textAlign: 'center', fontSize: '11px', color: COLORS.stone, marginTop: '8px' }}>
          No payment needed now · Pay on delivery
        </p>
      </div>
    </div>
  );
}

// ── SCREEN: PICKUP CONFIRMED ──────────────────────────────
function PickupConfirmedScreen({ order, onViewOrders }) {
  const [secs, setSecs] = useState(3600); // 1 hour

  useEffect(() => {
    const iv = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, []);

  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');

  return (
    <div style={{ ...S.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
      <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
      <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', color: COLORS.navy, textAlign: 'center', marginBottom: '8px' }}>
        Pickup requested!
      </h2>
      <p style={{ fontSize: '13px', color: COLORS.stone, textAlign: 'center', marginBottom: '28px', lineHeight: 1.6 }}>
        Your order <strong style={{ color: COLORS.navy, fontFamily: 'monospace' }}>{order.order_number}</strong> has been confirmed.
        A rider is being assigned.
      </p>

      {/* ETA countdown */}
      <div style={S.etaCountdown}>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>Rider arriving within</div>
        <div style={{ fontSize: '48px', fontWeight: 700, fontFamily: 'Cormorant Garamond, serif', color: '#fff', lineHeight: 1 }}>
          {mm}:{ss}
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>minutes</div>
      </div>

      {order.pickup_type === 'urgent' && (
        <div style={{ ...S.urgentPickupBadge, marginBottom: '20px', textAlign: 'center' }}>
          ⚡ Urgent — priority pickup assigned
        </div>
      )}

      <button onClick={onViewOrders} style={{ ...S.primaryBtn, width: '100%' }}>
        Track my order →
      </button>
    </div>
  );
}

// ── SCREEN: MY ORDERS ─────────────────────────────────────
function OrdersScreen({ user, onBack }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
    // Realtime subscription
    const channel = supabase.channel('my_orders')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `customer_id=eq.${user.id}`
      }, payload => {
        setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user.id]);

  async function fetchOrders() {
    const { data } = await supabase
      .from('orders')
      .select(`*, address:addresses(flat_no, area), items:order_items(service_name, quantity, price_paise), tags:garment_tags(tag_code, item_name, status)`)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  }

  const STEPS = ['Pickup', 'Cleaning', 'Ready', 'Delivered'];
  const STEP_IDX = { pending_pickup: 0, rider_assigned: 0, picked_up: 1, in_cleaning: 1, quality_check: 2, ready: 2, out_for_delivery: 3, delivered: 3 };
  const STATUS_LABEL = {
    pending_pickup: { text: 'Finding rider', color: COLORS.saffron, bg: '#FFF3E0' },
    rider_assigned: { text: 'Rider on the way', color: COLORS.saffron, bg: '#FFF3E0' },
    picked_up:      { text: 'Picked up ✓', color: '#1A5FBF', bg: '#E5F0FF' },
    in_cleaning:    { text: 'Being cleaned', color: '#1A5FBF', bg: '#E5F0FF' },
    quality_check:  { text: 'Quality check', color: COLORS.success, bg: COLORS.successLight },
    ready:          { text: 'Ready! ✨', color: COLORS.success, bg: COLORS.successLight },
    out_for_delivery: { text: 'Out for delivery', color: COLORS.saffron, bg: '#FFF3E0' },
    delivered:      { text: 'Delivered ✓', color: COLORS.stone, bg: COLORS.linen },
    cancelled:      { text: 'Cancelled', color: '#D32F2F', bg: '#FDEAEA' },
  };

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: COLORS.stone }}>Loading orders...</div>;

  return (
    <div style={S.page}>
      <div style={S.screenHeader}>
        <button onClick={onBack} style={S.backBtn}>←</button>
        <span style={S.screenTitle}>My orders</span>
      </div>

      <div style={{ padding: '12px 16px 80px' }}>
        {orders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
            <p style={{ color: COLORS.stone, fontSize: '14px' }}>No orders yet. Request your first pickup!</p>
          </div>
        )}

        {orders.map(order => {
          const si = STEP_IDX[order.status] ?? 0;
          const pct = Math.min((si / 3) * 100, 100);
          const sl = STATUS_LABEL[order.status] || { text: order.status, color: COLORS.stone, bg: COLORS.linen };
          const totalRs = order.total_paise > 0 ? `₹${(order.total_paise / 100).toFixed(0)}` : 'TBD';

          return (
            <div key={order.id} style={S.orderCard}>
              {/* Header */}
              <div style={S.orderCardHeader}>
                <div>
                  <div style={S.orderNum}>{order.order_number}</div>
                  <div style={S.orderAddr}>📍 {order.address?.area || '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ ...S.statusBadge, background: sl.bg, color: sl.color }}>{sl.text}</div>
                  <div style={S.orderTotal}>{totalRs}</div>
                  {order.pickup_type === 'urgent' && <div style={S.urgentTag}>⚡ Urgent</div>}
                </div>
              </div>

              {/* Progress bar */}
              <div style={S.progressTrack}>
                <div style={{ ...S.progressFill, width: `${pct}%` }} />
              </div>
              <div style={S.stepsRow}>
                {STEPS.map((step, i) => (
                  <div key={step} style={S.stepItem}>
                    <div style={{
                      ...S.stepDot,
                      background: i < si ? COLORS.saffron : i === si ? '#fff' : COLORS.linen,
                      border: `2px solid ${i <= si ? COLORS.saffron : COLORS.border}`,
                    }}>
                      {i < si && <span style={{ fontSize: '9px', color: '#fff' }}>✓</span>}
                      {i === si && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: COLORS.saffron, display: 'block', margin: '3px' }} />}
                    </div>
                    <span style={S.stepLabel}>{step}</span>
                  </div>
                ))}
              </div>

              {/* ETA */}
              {order.estimated_delivery && (
                <div style={S.etaRow}>
                  <span>📅 Est. delivery:</span>
                  <strong style={{ color: COLORS.navy }}>
                    {new Date(order.estimated_delivery).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </strong>
                </div>
              )}

              {/* Items (shown after rider confirms) */}
              {order.items_confirmed && order.items?.length > 0 && (
                <div style={S.itemsSection}>
                  <div style={S.itemsSectionTitle}>Items picked up</div>
                  {order.items.map((item, i) => (
                    <div key={i} style={S.itemRow}>
                      <span style={S.itemName}>{item.quantity}× {item.service_name}</span>
                      <span style={S.itemPrice}>₹{((item.price_paise * item.quantity) / 100).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Garment tags */}
              {order.tags?.length > 0 && (
                <div style={S.tagsSection}>
                  <div style={S.itemsSectionTitle}>Item tracking</div>
                  <div style={S.tagsGrid}>
                    {order.tags.map(tag => (
                      <div key={tag.tag_code} style={S.tagChip}>
                        <span style={S.tagCode}>{tag.tag_code}</span>
                        <span style={S.tagName}>{tag.item_name}</span>
                        <span style={{ ...S.tagStatus, color: tag.status === 'ready' || tag.status === 'packed' ? COLORS.success : COLORS.saffron }}>
                          {tag.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment note */}
              {order.payment_method === 'cod' && order.status !== 'delivered' && (
                <div style={S.codNote}>💵 Pay on delivery · No upfront payment</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ROOT APP ──────────────────────────────────────────────
function AppInner() {
  const { user, profile, loading, isLoggedIn } = useAuth();
  const [screen, setScreen] = useState('home'); // home | confirm | confirmed | orders
  const [pickupType, setPickupType] = useState('standard');
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: COLORS.cream, fontSize: '40px' }}>
      🧺
    </div>
  );

  if (!isLoggedIn) return <LoginScreen onLogin={() => {}} />;

  if (screen === 'confirm') return (
    <ConfirmPickupScreen
      user={user} profile={profile} pickupType={pickupType}
      onConfirmed={order => { setConfirmedOrder(order); setScreen('confirmed'); }}
      onBack={() => setScreen('home')}
    />
  );

  if (screen === 'confirmed') return (
    <PickupConfirmedScreen
      order={confirmedOrder}
      onViewOrders={() => setScreen('orders')}
    />
  );

  if (screen === 'orders') return (
    <OrdersScreen user={user} onBack={() => setScreen('home')} />
  );

  return (
    <HomeScreen
      user={user} profile={profile}
      onPickup={type => { setPickupType(type); setScreen('confirm'); }}
      onViewOrders={() => setScreen('orders')}
    />
  );
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}

// ── STYLES ────────────────────────────────────────────────
const S = {
  // Login
  loginPage:    { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: COLORS.cream },
  loginBox:     { width: '100%', maxWidth: '360px' },
  loginLogo:    { fontSize: '48px', textAlign: 'center', marginBottom: '8px' },
  loginBrand:   { fontFamily: 'Cormorant Garamond, serif', fontSize: '32px', fontWeight: 600, color: COLORS.navy, textAlign: 'center', margin: 0, letterSpacing: '1px' },
  loginTag:     { fontSize: '13px', color: COLORS.stone, textAlign: 'center', marginBottom: '32px', marginTop: '4px' },

  // Shared
  page:         { fontFamily: 'DM Sans, sans-serif', background: COLORS.cream, minHeight: '100vh', maxWidth: '480px', margin: '0 auto' },
  formGroup:    { marginBottom: '12px' },
  label:        { display: 'block', fontSize: '11px', fontWeight: 600, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' },
  input:        { width: '100%', padding: '11px 14px', border: `1.5px solid ${COLORS.border}`, borderRadius: '10px', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', color: COLORS.navy, outline: 'none', background: '#fff', boxSizing: 'border-box' },
  primaryBtn:   { width: '100%', padding: '15px', background: COLORS.saffron, color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginTop: '8px', transition: 'all 0.2s' },
  ghostBtn:     { width: '100%', padding: '10px', background: 'transparent', border: 'none', color: COLORS.stone, fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginTop: '4px' },
  errorTxt:     { color: '#D32F2F', fontSize: '12px', marginBottom: '10px', textAlign: 'center' },
  card:         { background: '#fff', borderRadius: '16px', border: `1px solid ${COLORS.border}`, padding: '16px', marginBottom: '12px' },
  cardTitle:    { fontSize: '14px', fontWeight: 700, color: COLORS.navy, marginBottom: '12px' },
  screenHeader: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: '#fff', borderBottom: `1px solid ${COLORS.border}`, position: 'sticky', top: 0, zIndex: 10 },
  backBtn:      { width: '34px', height: '34px', borderRadius: '50%', border: `1px solid ${COLORS.border}`, background: '#fff', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  screenTitle:  { fontSize: '16px', fontWeight: 700, color: COLORS.navy },

  // Home
  homeHeader:   { background: COLORS.navy, padding: '16px 16px 20px' },
  homeHeaderTop:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' },
  brandRow:     { display: 'flex', alignItems: 'center', gap: '10px' },
  brandIcon:    { width: '34px', height: '34px', background: COLORS.saffron, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' },
  brandName:    { fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: '#fff', fontWeight: 600, letterSpacing: '0.5px', lineHeight: 1 },
  brandSub:     { fontSize: '9px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' },
  locationChip: { display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '20px', padding: '5px 10px', fontSize: '11px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 },
  greeting:     { fontSize: '16px', color: '#fff', fontWeight: 500 },

  // Active orders
  activeStrip:  { padding: '12px 16px 0' },
  activeOrderChip: { background: '#fff', borderRadius: '12px', border: `1px solid ${COLORS.border}`, padding: '12px 14px', marginBottom: '8px', cursor: 'pointer' },
  activeOrderId:{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: COLORS.stone },
  urgentBadge:  { fontSize: '10px', background: '#FFF3E0', color: COLORS.saffron, padding: '2px 8px', borderRadius: '10px', fontWeight: 700 },
  statusDot:    { fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center' },
  etaChip:      { fontSize: '10px', color: COLORS.stone },

  // Pickup section
  pickupSection:{ padding: '16px 16px 80px' },
  pickupCard:   { background: COLORS.navy, borderRadius: '20px', padding: '24px', marginBottom: '16px' },
  pickupCardTop:{ marginBottom: '20px' },
  pickupTitle:  { fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: '#fff', fontWeight: 600, marginBottom: '4px' },
  pickupSub:    { fontSize: '12px', color: 'rgba(255,255,255,0.55)' },
  pickupTypeRow:{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  pickupTypeBtn:{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 12px', borderRadius: '14px', border: 'none', cursor: 'pointer', transition: 'transform 0.15s', fontFamily: 'DM Sans, sans-serif' },
  pickupTypeBtnStd: { background: '#fff', color: COLORS.navy },
  pickupTypeBtnUrgent: { background: COLORS.saffron, color: '#fff' },
  pickupTypeBadge: { borderRadius: '10px', padding: '12px 14px', fontSize: '13px', fontWeight: 600, marginBottom: '14px', textAlign: 'center' },
  stdPickupBadge: { background: '#E5F0FF', color: '#1A5FBF' },
  urgentPickupBadge: { background: '#FFF3E0', color: COLORS.saffron },

  // How it works
  howItWorks:   { background: '#fff', borderRadius: '16px', border: `1px solid ${COLORS.border}`, padding: '16px', marginBottom: '16px' },
  howTitle:     { fontSize: '14px', fontWeight: 700, color: COLORS.navy, marginBottom: '14px' },
  howSteps:     { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' },
  howStep:      { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  howStepIcon:  { fontSize: '20px', marginBottom: '2px' },
  howStepNum:   { width: '18px', height: '18px', borderRadius: '50%', background: COLORS.saffron, color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  howStepText:  { fontSize: '10px', color: COLORS.stone, textAlign: 'center', lineHeight: 1.3 },

  // Services preview
  servicesPreview: { background: '#fff', borderRadius: '16px', border: `1px solid ${COLORS.border}`, padding: '16px', marginBottom: '16px' },
  sectionTitle: { fontSize: '14px', fontWeight: 700, color: COLORS.navy, marginBottom: '12px' },
  serviceChips: { display: 'flex', flexDirection: 'column', gap: '8px' },
  serviceChip:  { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: `1px solid ${COLORS.linen}` },
  serviceChipName: { flex: 1, fontSize: '13px', fontWeight: 500, color: COLORS.navy },
  serviceChipTat: { fontSize: '11px', color: COLORS.stone, background: COLORS.linen, padding: '3px 8px', borderRadius: '8px' },

  // Address options
  addrOption:   { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', borderRadius: '10px', border: `1.5px solid ${COLORS.border}`, cursor: 'pointer', marginBottom: '8px', background: '#fff' },
  addrOptionSelected: { borderColor: COLORS.saffron, background: '#FFF8F5' },
  addrOptionDot: (selected) => ({ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${selected ? COLORS.saffron : COLORS.border}`, background: selected ? COLORS.saffron : '#fff', flexShrink: 0, marginTop: '2px' }),

  // ETA countdown
  etaCountdown: { background: COLORS.navy, borderRadius: '20px', padding: '24px 32px', marginBottom: '24px', textAlign: 'center', width: '100%' },

  // Orders
  orderCard:    { background: '#fff', borderRadius: '16px', border: `1px solid ${COLORS.border}`, padding: '16px', marginBottom: '12px' },
  orderCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' },
  orderNum:     { fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: COLORS.stone, marginBottom: '3px' },
  orderAddr:    { fontSize: '12px', color: COLORS.stone },
  statusBadge:  { display: 'inline-block', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', marginBottom: '4px' },
  orderTotal:   { fontSize: '15px', fontWeight: 700, color: COLORS.saffron },
  urgentTag:    { fontSize: '10px', color: COLORS.saffron, fontWeight: 700 },
  progressTrack:{ position: 'relative', height: '2px', background: COLORS.border, margin: '0 10px', borderRadius: '2px', marginBottom: '0' },
  progressFill: { position: 'absolute', top: 0, left: 0, height: '2px', background: COLORS.saffron, borderRadius: '2px', transition: 'width 0.5s' },
  stepsRow:     { display: 'flex', margin: '0 0 10px' },
  stepItem:     { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginTop: '-10px' },
  stepDot:      { width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  stepLabel:    { fontSize: '9px', color: COLORS.stone, textAlign: 'center', lineHeight: 1.3 },
  etaRow:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: COLORS.stone, background: COLORS.linen, padding: '8px 10px', borderRadius: '8px', marginBottom: '10px' },
  itemsSection: { borderTop: `1px solid ${COLORS.linen}`, paddingTop: '10px', marginTop: '4px' },
  itemsSectionTitle: { fontSize: '11px', fontWeight: 700, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' },
  itemRow:      { display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' },
  itemName:     { color: COLORS.navy },
  itemPrice:    { fontWeight: 700, color: COLORS.saffron },
  tagsSection:  { marginTop: '10px' },
  tagsGrid:     { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' },
  tagChip:      { border: `1px solid ${COLORS.border}`, borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px' },
  tagCode:      { fontSize: '9px', fontFamily: 'monospace', background: COLORS.navy, color: '#fff', padding: '1px 5px', borderRadius: '3px', alignSelf: 'flex-start' },
  tagName:      { fontSize: '11px', color: COLORS.navy, fontWeight: 500 },
  tagStatus:    { fontSize: '10px', fontWeight: 600 },
  codNote:      { fontSize: '11px', color: COLORS.stone, textAlign: 'center', marginTop: '10px', padding: '8px', background: COLORS.linen, borderRadius: '8px' },

  // Bottom nav
  bottomNav:    { position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: '480px', margin: '0 auto', background: '#fff', borderTop: `1px solid ${COLORS.border}`, display: 'flex', zIndex: 100, boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' },
  bnavItem:     { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '10px 0 8px', cursor: 'pointer', color: COLORS.stone, border: 'none', background: 'none', fontFamily: 'DM Sans, sans-serif', position: 'relative' },
  bnavLabel:    { fontSize: '10px', fontWeight: 500 },
  bnavBadge:    { position: 'absolute', top: '6px', right: 'calc(50% - 18px)', background: COLORS.saffron, color: '#fff', fontSize: '9px', fontWeight: 700, width: '15px', height: '15px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};
