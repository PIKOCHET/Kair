import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const COLORS = {
  navy:    '#0D1B3E',
  saffron: '#FF6B00',
  cream:   '#FAF8F4',
  stone:   '#6B6860',
  border:  '#E4E0D9',
  success: '#0A7A4B',
  successLight: '#E5F5EE',
};

// ── SERVICES LIST (fetched from Supabase) ─────────────────
// Grouped by category for easy rider selection

// ── LOGIN ─────────────────────────────────────────────────
function RiderLogin({ onLogin }) {
  const [email,   setEmail]   = useState('');
  const [pass,    setPass]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function login() {
    setLoading(true); setError('');
    const { data, error: e } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (e) { setError(e.message); setLoading(false); return; }
    // Check rider role
    const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', data.user.id).single();
    if (!profile || !['rider', 'admin'].includes(profile.role)) {
      setError('This account is not registered as a rider.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }
    onLogin(data.user, profile);
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', background: COLORS.navy }}>
      <div style={{ fontSize: '48px', marginBottom: '8px' }}>🏍️</div>
      <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 700, marginBottom: '4px', fontFamily: 'DM Sans, sans-serif' }}>Kair Rider</h1>
      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginBottom: '32px' }}>Pickup & delivery app · Pune</p>

      <div style={{ width: '100%', maxWidth: '320px', background: 'rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px' }}>
        <div style={{ marginBottom: '12px' }}>
          <label style={lbl}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="rider@kair.in"
            style={riderInput}
            onKeyDown={e => e.key === 'Enter' && login()} />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={lbl}>Password</label>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)}
            placeholder="••••••••"
            style={riderInput}
            onKeyDown={e => e.key === 'Enter' && login()} />
        </div>
        {error && <p style={{ color: '#FF6B6B', fontSize: '12px', marginBottom: '10px' }}>{error}</p>}
        <button onClick={login} disabled={loading} style={orangeBtn}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────
function RiderDashboard({ user, riderProfile, onSignOut }) {
  const [orders,   setOrders]   = useState([]);
  const [tab,      setTab]      = useState('active');
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState('');
  const [itemEntry, setItemEntry] = useState(null); // order being item-entered
  const [services, setServices] = useState([]);

  // Load services catalogue
  useEffect(() => {
    supabase.from('services')
      .select('*, category:service_categories(name_en, slug)')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setServices(data || []));
  }, []);

  useEffect(() => {
    fetchOrders();
    const ch = supabase.channel('rider_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();

    // GPS update every 30s
    const gpsInterval = setInterval(() => updateGPS(), 30000);
    updateGPS();

    return () => { supabase.removeChannel(ch); clearInterval(gpsInterval); };
  }, [tab]);

  async function fetchOrders() {
    setLoading(true);
    const statuses = tab === 'active'
      ? ['pending_pickup', 'rider_assigned', 'picked_up', 'in_cleaning', 'out_for_delivery']
      : ['delivered', 'cancelled'];

    let query = supabase.from('orders')
      .select(`*, address:addresses(flat_no, area, city, landmark), items:order_items(*, service:services(name_en, emoji, tat_days)), customer:profiles!orders_customer_id_fkey(full_name, phone)`)
      .in('status', statuses)
      .order('created_at', { ascending: false });

    if (tab === 'active') {
      query = query.or(`rider_id.eq.${user.id},rider_id.is.null`);
    } else {
      query = query.eq('rider_id', user.id);
    }

    const { data } = await query;
    setOrders(data || []);
    setLoading(false);
  }

  function updateGPS() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      fetch(`${API}/api/riders/${user.id}/location`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      }).catch(() => {});
    });
  }

  async function updateStatus(orderId, status, riderId) {
    const body = { status };
    if (riderId) body.rider_id = riderId;
    if (status === 'picked_up') body.picked_up_at = new Date().toISOString();
    if (status === 'delivered') body.delivered_at = new Date().toISOString();

    const res = await fetch(`${API}/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) { showToast('Status updated ✓'); fetchOrders(); }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const todayDelivered = orders.filter(o => o.status === 'delivered').length;
  const activeCount = orders.filter(o => ['pending_pickup', 'rider_assigned'].includes(o.status)).length;

  if (itemEntry) return (
    <ItemEntryScreen
      order={itemEntry}
      services={services}
      riderId={user.id}
      onDone={() => { setItemEntry(null); fetchOrders(); showToast('Items saved — customer notified ✓'); }}
      onBack={() => setItemEntry(null)}
    />
  );

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', background: '#F5F4F1', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: COLORS.navy, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ color: '#fff', fontSize: '15px', fontWeight: 700 }}>🏍️ {riderProfile?.full_name || 'Rider'}</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px' }}>Pune · Online</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ background: COLORS.success, borderRadius: '20px', padding: '4px 12px', fontSize: '11px', fontWeight: 700, color: '#fff' }}>● Online</div>
            <button onClick={onSignOut} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '6px 12px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              Sign out
            </button>
          </div>
        </div>
        {/* Stats */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', overflow: 'hidden' }}>
          {[
            { val: orders.filter(o => !['delivered','cancelled'].includes(o.status)).length, lbl: 'Active' },
            { val: activeCount, lbl: 'Pending' },
            { val: todayDelivered, lbl: 'Delivered' },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: '10px 6px', textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: COLORS.saffron }}>{s.val}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: `1px solid ${COLORS.border}` }}>
        {[['active', 'Active pickups'], ['done', 'Completed']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ flex: 1, padding: '12px', border: 'none', background: 'transparent', fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: tab === id ? COLORS.saffron : COLORS.stone, borderBottom: tab === id ? `2px solid ${COLORS.saffron}` : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Orders */}
      <div style={{ padding: '12px 12px 80px' }}>
        {loading && <div style={{ textAlign: 'center', padding: '40px', color: COLORS.stone }}>Loading...</div>}
        {!loading && orders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎉</div>
            <p style={{ color: COLORS.stone, fontSize: '14px' }}>No {tab === 'active' ? 'active' : 'completed'} orders</p>
          </div>
        )}

        {orders.map(order => (
          <RiderOrderCard
            key={order.id}
            order={order}
            riderId={user.id}
            onUpdateStatus={updateStatus}
            onEnterItems={() => setItemEntry(order)}
          />
        ))}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: COLORS.navy, color: '#fff', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 500, zIndex: 200, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── RIDER ORDER CARD ──────────────────────────────────────
function RiderOrderCard({ order, riderId, onUpdateStatus, onEnterItems }) {
  const STATUS_NEXT = {
    pending_pickup:   { action: '✅ Accept & assign to me', nextStatus: 'rider_assigned', assignSelf: true },
    rider_assigned:   { action: '📦 Mark as picked up',    nextStatus: 'picked_up' },
    picked_up:        { action: '🏭 Hand to facility',     nextStatus: 'in_cleaning' },
    in_cleaning:      null,
    out_for_delivery: { action: '✅ Mark delivered',       nextStatus: 'delivered' },
  };

  const STATUS_LABEL = {
    pending_pickup:    { text: 'New pickup request', color: COLORS.saffron, bg: '#FFF3E0' },
    rider_assigned:    { text: 'Go to customer',     color: COLORS.saffron, bg: '#FFF3E0' },
    picked_up:         { text: 'Picked up',          color: '#1A5FBF',      bg: '#E5F0FF' },
    in_cleaning:       { text: 'At facility',        color: '#1A5FBF',      bg: '#E5F0FF' },
    out_for_delivery:  { text: 'For delivery',       color: COLORS.saffron, bg: '#FFF3E0' },
    delivered:         { text: 'Delivered ✓',        color: COLORS.success, bg: COLORS.successLight },
  };

  const sl = STATUS_LABEL[order.status] || { text: order.status, color: COLORS.stone, bg: '#F5F4F1' };
  const nextAction = STATUS_NEXT[order.status];
  const totalRs = order.total_paise > 0 ? `₹${(order.total_paise / 100).toFixed(0)}` : 'TBD';
  const addr = [order.address?.flat_no, order.address?.area, order.address?.city].filter(Boolean).join(', ');
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(addr)}`;

  return (
    <div style={{ background: '#fff', borderRadius: '14px', border: `1px solid ${COLORS.border}`, marginBottom: '12px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: '#F5F4F1', padding: '10px 14px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, background: COLORS.navy, color: '#fff', padding: '3px 8px', borderRadius: '5px' }}>{order.order_number}</span>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: sl.bg, color: sl.color }}>{sl.text}</span>
          {order.pickup_type === 'urgent' && <span style={{ fontSize: '10px', background: '#FFF3E0', color: COLORS.saffron, padding: '2px 7px', borderRadius: '8px', fontWeight: 700 }}>⚡ URGENT</span>}
        </div>
        <span style={{ fontSize: '14px', fontWeight: 700, color: COLORS.saffron }}>{totalRs}</span>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        {/* Customer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: COLORS.navy, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, flexShrink: 0 }}>
            {(order.customer?.full_name || 'C')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: COLORS.navy }}>{order.customer?.full_name || 'Customer'}</div>
            <a href={`tel:${order.customer?.phone}`} style={{ fontSize: '12px', color: COLORS.saffron, textDecoration: 'none', fontWeight: 600 }}>{order.customer?.phone || '—'}</a>
          </div>
        </div>

        {/* Address */}
        <div style={{ fontSize: '12px', color: COLORS.navy, background: '#F5F4F1', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px' }}>
          📍 {addr}
          {order.address?.landmark && <span style={{ color: COLORS.stone }}> · Near {order.address.landmark}</span>}
        </div>

        {/* Payment */}
        <div style={{ fontSize: '11px', color: COLORS.stone, marginBottom: '10px' }}>
          💳 {order.payment_method?.toUpperCase() || 'COD'} · No upfront payment from customer
        </div>

        {/* Items (if entered) */}
        {order.items_confirmed && order.items?.length > 0 && (
          <div style={{ background: '#F5F4F1', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px', fontSize: '12px' }}>
            {order.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span>{item.quantity}× {item.service_name}</span>
                <span style={{ color: COLORS.saffron, fontWeight: 700 }}>₹{((item.price_paise * item.quantity) / 100).toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {nextAction && (
            <button
              onClick={() => onUpdateStatus(order.id, nextAction.nextStatus, nextAction.assignSelf ? riderId : undefined)}
              style={{ flex: 1, padding: '11px', background: COLORS.saffron, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              {nextAction.action}
            </button>
          )}

          {/* Enter items button — shown after pickup */}
          {order.status === 'picked_up' && !order.items_confirmed && (
            <button
              onClick={onEnterItems}
              style={{ flex: 1, padding: '11px', background: COLORS.navy, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              📋 Enter items
            </button>
          )}

          <a href={mapsUrl} target="_blank" rel="noreferrer"
            style={{ padding: '11px 14px', background: '#E5F0FF', color: '#1A5FBF', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            🗺️
          </a>
        </div>
      </div>
    </div>
  );
}

// ── ITEM ENTRY SCREEN ─────────────────────────────────────
function ItemEntryScreen({ order, services, riderId, onDone, onBack }) {
  const [items,   setItems]   = useState([]); // { service_id, name, price_paise, tat_days, qty }
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  // Group services by category
  const grouped = services.reduce((acc, svc) => {
    const cat = svc.category?.name_en || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(svc);
    return acc;
  }, {});

  function addItem(svc) {
    setItems(prev => {
      const ex = prev.find(i => i.service_id === svc.id);
      if (ex) return prev.map(i => i.service_id === svc.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { service_id: svc.id, name: svc.name_en, price_paise: svc.price_paise, tat_days: svc.tat_days || 2, qty: 1 }];
    });
  }

  function changeQty(serviceId, delta) {
    setItems(prev => {
      const updated = prev.map(i => i.service_id === serviceId ? { ...i, qty: i.qty + delta } : i);
      return updated.filter(i => i.qty > 0);
    });
  }

  const totalPaise = items.reduce((s, i) => s + i.price_paise * i.qty, 0);
  const maxTat = items.length > 0 ? Math.max(...items.map(i => i.tat_days)) : 0;
  const etaDate = maxTat > 0 ? new Date(Date.now() + maxTat * 86400000) : null;

  async function saveItems() {
    if (items.length === 0) { setError('Please add at least one item'); return; }
    setSaving(true); setError('');

    try {
      // Insert order items
      const orderItems = items.map(i => ({
        order_id:     order.id,
        service_id:   i.service_id,
        service_name: i.name,
        quantity:     i.qty,
        price_paise:  i.price_paise,
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
      if (itemsErr) throw itemsErr;

      // Generate garment tags
      await fetch(`${API}/api/orders/${order.id}/generate-tags`, { method: 'POST' });

      // Update order: total, ETA, items_confirmed, status → in_cleaning
      await supabase.from('orders').update({
        total_paise:        totalPaise,
        estimated_delivery: etaDate?.toISOString().split('T')[0],
        items_confirmed:    true,
        status:             'in_cleaning',
      }).eq('id', order.id);

      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', background: '#F5F4F1', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: COLORS.navy, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={onBack} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>←</button>
        <div>
          <div style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>Enter items — {order.order_number}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>
            {order.customer?.full_name} · {order.address?.area}
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 12px 120px' }}>
        {/* Selected items summary */}
        {items.length > 0 && (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '14px', marginBottom: '12px', border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Selected items</div>
            {items.map(item => (
              <div key={item.service_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: COLORS.navy }}>{item.name}</div>
                  <div style={{ fontSize: '11px', color: COLORS.stone }}>₹{(item.price_paise / 100).toFixed(0)} · {item.tat_days} day TAT</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => changeQty(item.service_id, -1)} style={qtyBtn}>−</button>
                  <span style={{ fontSize: '14px', fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{item.qty}</span>
                  <button onClick={() => changeQty(item.service_id, 1)} style={qtyBtn}>+</button>
                </div>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: '10px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700 }}>
              <span>Total</span>
              <span style={{ color: COLORS.saffron }}>₹{(totalPaise / 100).toFixed(0)}</span>
            </div>
            {etaDate && (
              <div style={{ background: '#E5F0FF', borderRadius: '8px', padding: '8px 10px', marginTop: '10px', fontSize: '12px', color: '#1A5FBF', fontWeight: 600 }}>
                📅 Estimated delivery: {etaDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            )}
          </div>
        )}

        {/* Service catalogue */}
        {Object.entries(grouped).map(([category, svcs]) => (
          <div key={category} style={{ background: '#fff', borderRadius: '12px', padding: '14px', marginBottom: '10px', border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>{category}</div>
            {svcs.map(svc => {
              const inCart = items.find(i => i.service_id === svc.id);
              return (
                <div key={svc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: COLORS.navy }}>{svc.emoji} {svc.name_en}</div>
                    <div style={{ fontSize: '11px', color: COLORS.stone }}>₹{(svc.price_paise / 100).toFixed(0)} {svc.unit} · {svc.tat_days}d TAT</div>
                  </div>
                  {inCart ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button onClick={() => changeQty(svc.id, -1)} style={qtyBtn}>−</button>
                      <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '18px', textAlign: 'center' }}>{inCart.qty}</span>
                      <button onClick={() => changeQty(svc.id, 1)} style={qtyBtn}>+</button>
                    </div>
                  ) : (
                    <button onClick={() => addItem(svc)} style={{ width: '28px', height: '28px', borderRadius: '50%', background: COLORS.saffron, border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Fixed bottom bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', padding: '12px 16px', borderTop: `1px solid ${COLORS.border}`, boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' }}>
        {error && <p style={{ color: '#D32F2F', fontSize: '12px', marginBottom: '8px', textAlign: 'center' }}>{error}</p>}
        <button onClick={saveItems} disabled={saving || items.length === 0}
          style={{ width: '100%', padding: '14px', background: items.length > 0 ? COLORS.saffron : '#ccc', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 700, cursor: items.length > 0 ? 'pointer' : 'default', fontFamily: 'DM Sans, sans-serif' }}>
          {saving ? 'Saving...' : `Confirm ${items.length > 0 ? `${items.reduce((s,i)=>s+i.qty,0)} items · ₹${(totalPaise/100).toFixed(0)}` : '— add items above'}`}
        </button>
        <p style={{ textAlign: 'center', fontSize: '11px', color: COLORS.stone, marginTop: '6px' }}>
          Customer will be notified with item list + ETA
        </p>
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────
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

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null); setProfile(null);
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: COLORS.navy, fontSize: '40px' }}>🏍️</div>;
  if (!user)   return <RiderLogin onLogin={(u, p) => { setUser(u); setProfile(p); }} />;
  return <RiderDashboard user={user} riderProfile={profile} onSignOut={signOut} />;
}

// ── SHARED STYLES ─────────────────────────────────────────
const lbl = { display: 'block', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '5px' };
const riderInput = { width: '100%', background: 'rgba(255,255,255,0.1)', border: 'none', outline: 'none', padding: '11px 14px', borderRadius: '10px', color: '#fff', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', marginBottom: '12px', boxSizing: 'border-box' };
const orangeBtn = { width: '100%', padding: '13px', background: COLORS.saffron, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' };
const qtyBtn = { width: '28px', height: '28px', borderRadius: '50%', border: `1.5px solid ${COLORS.saffron}`, background: '#fff', color: COLORS.saffron, fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 };
