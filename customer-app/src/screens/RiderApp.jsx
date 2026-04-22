import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { C, CATALOG, fmt } from '../lib/constants';

const ALL_SVCS = Object.entries(CATALOG).map(([cat, items]) => ({ cat, items }));

// ── ITEM ENTRY ─────────────────────────────────────────────
function ItemEntry({ order, onDone, onBack }) {
  const [cart,   setCart]   = useState({});
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function add(svc) {
    setCart(p => ({ ...p, [svc.id]: { ...svc, qty: (p[svc.id]?.qty || 0) + 1 } }));
  }
  function change(id, d) {
    setCart(p => {
      const qty = (p[id]?.qty || 0) + d;
      if (qty <= 0) { const n = { ...p }; delete n[id]; return n; }
      return { ...p, [id]: { ...p[id], qty } };
    });
  }

  const items      = Object.values(cart);
  const totalQty   = items.reduce((s, i) => s + i.qty, 0);
  const totalPaise = items.reduce((s, i) => s + i.price_paise * i.qty, 0);
  const maxTat     = items.length > 0 ? Math.max(...items.map(i => i.tat_days)) : 0;
  const etaDate    = maxTat > 0 ? new Date(Date.now() + maxTat * 86400000) : null;

  async function save() {
    if (items.length === 0) { setError('Add at least one item'); return; }
    setSaving(true); setError('');
    try {
      // 1. Insert order items
      const { error: ie } = await supabase.from('order_items').insert(
        items.map(i => ({
          order_id:     order.id,
          service_id:   null,
          service_name: i.name,
          quantity:     i.qty,
          price_paise:  i.price_paise,
        }))
      );
      if (ie) throw ie;

      // 2. Generate garment tags directly in Supabase
      const allItems = [];
      items.forEach(item => {
        for (let i = 0; i < item.qty; i++) allItems.push(item.name);
      });
      const tags = allItems.map((name, i) => ({
        order_id:  order.id,
        tag_code:  `${order.order_number}-${String(i + 1).padStart(2, '0')}`,
        item_name: name,
        status:    'received',
      }));
      const { error: te } = await supabase.from('garment_tags').insert(tags);
      if (te) throw te;

      // 3. Update order — total (minus discount), ETA, status
      const finalTotal = Math.max(0, totalPaise - (order.discount_paise || 0));
      const { error: oe } = await supabase.from('orders').update({
        total_paise:        finalTotal,
        estimated_delivery: etaDate?.toISOString().split('T')[0],
        items_confirmed:    true,
        status:             'in_cleaning',
      }).eq('id', order.id);
      if (oe) throw oe;

      // 4. Notify customer
      await supabase.from('notifications').insert({
        user_id:  order.customer_id,
        order_id: order.id,
        type:     'items_confirmed',
        title:    '🧺 Your items have been picked up!',
        message:  `${allItems.length} item${allItems.length > 1 ? 's' : ''} collected: ${items.map(i => `${i.qty}× ${i.name}`).join(', ')} · Total ₹${(totalPaise / 100).toFixed(0)} · Est. delivery ${etaDate?.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) || 'TBD'}`,
        is_read:  false,
      });

      onDone();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ background: C.cream, minHeight: '100vh', position: 'relative' }}>
      {/* Header */}
      <div style={{ background: C.navy, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={onBack} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>←</button>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Enter items — {order.order_number}</div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{order.customer?.full_name} · {[order.address?.flat_no, order.address?.area].filter(Boolean).join(', ') || 'Pune'}</div>
        </div>
      </div>

      <div style={{ padding: '10px 12px 110px' }}>
        {/* Special instructions from customer */}
        {order.special_notes && (
          <div style={{ background: '#FFF0E8', borderRadius: '10px', padding: '10px', marginBottom: '10px', borderLeft: `3px solid ${C.saffron}` }}>
            <div style={{ fontSize: '10px', color: C.saffron, fontWeight: 700, marginBottom: '4px' }}>📝 Customer's special instructions:</div>
            <div style={{ fontSize: '12px', color: C.navy }}>{order.special_notes}</div>
          </div>
        )}

        {/* Promo code applied */}
        {order.promo_code && (
          <div style={{ background: '#E8F5EE', borderRadius: '10px', padding: '10px', marginBottom: '10px', borderLeft: `3px solid ${C.success}` }}>
            <div style={{ fontSize: '10px', color: C.success, fontWeight: 700, marginBottom: '4px' }}>🎁 Promo code applied: {order.promo_code}</div>
            <div style={{ fontSize: '12px', color: C.navy }}>Discount: {fmt.rupees(order.discount_paise || 0)}</div>
          </div>
        )}

        {/* Selected summary */}
        {items.length > 0 && (
          <div style={{ background: '#fff', borderRadius: '12px', border: `1px solid ${C.border}`, padding: '12px', marginBottom: '10px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Selected items</div>
            {items.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: C.navy }}>{item.emoji} {item.name}</div>
                  <div style={{ fontSize: '10px', color: C.stone }}>{fmt.rupees(item.price_paise)} {item.unit} · {item.tat_days}d TAT</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <button onClick={() => change(item.id, -1)} style={qtyBtn}>−</button>
                  <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '18px', textAlign: 'center' }}>{item.qty}</span>
                  <button onClick={() => change(item.id,  1)} style={qtyBtn}>+</button>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: `1px solid ${C.border}`, fontSize: '14px', fontWeight: 700, marginTop: '4px' }}>
              <span>Subtotal</span>
              <span style={{ color: C.saffron }}>{fmt.rupees(totalPaise)}</span>
            </div>
            {order.discount_paise > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', fontSize: '12px', fontWeight: 600, color: C.success }}>
                <span>Discount ({order.promo_code})</span>
                <span>−{fmt.rupees(order.discount_paise)}</span>
              </div>
            )}
            {order.discount_paise > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: `1px solid ${C.border}`, fontSize: '14px', fontWeight: 700, color: C.navy }}>
                <span>Final Total</span>
                <span style={{ color: C.saffron }}>{fmt.rupees(Math.max(0, totalPaise - order.discount_paise))}</span>
              </div>
            )}
            {etaDate && (
              <div style={{ background: '#E5EEFF', borderRadius: '8px', padding: '7px 10px', marginTop: '8px', fontSize: '10px', color: '#1A5FBF', fontWeight: 600 }}>
                📅 Est. delivery: {etaDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            )}
          </div>
        )}

        {/* Service catalogue */}
        {ALL_SVCS.map(({ cat, items: svcs }) => (
          <div key={cat} style={{ background: '#fff', borderRadius: '12px', border: `1px solid ${C.border}`, padding: '12px', marginBottom: '8px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{cat}</div>
            {svcs.map((svc, i) => {
              const inCart = cart[svc.id];
              return (
                <div key={svc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < svcs.length - 1 ? `1px solid ${C.linen}` : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: C.navy }}>{svc.emoji} {svc.name}</div>
                    <div style={{ fontSize: '10px', color: C.stone }}>{fmt.rupees(svc.price_paise)} {svc.unit} · {svc.tat_days}d</div>
                  </div>
                  {inCart ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <button onClick={() => change(svc.id, -1)} style={qtyBtn}>−</button>
                      <span style={{ fontSize: '12px', fontWeight: 700, minWidth: '16px', textAlign: 'center' }}>{inCart.qty}</span>
                      <button onClick={() => change(svc.id,  1)} style={qtyBtn}>+</button>
                    </div>
                  ) : (
                    <button onClick={() => add(svc)} style={{ width: '26px', height: '26px', borderRadius: '50%', background: C.saffron, border: 'none', color: '#fff', fontSize: '17px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

 {/* Bottom confirm bar */}
<div style={{ position:'fixed', bottom:0, left:0, right:0, maxWidth:'480px', margin:'0 auto', background:'#fff', borderTop:`1px solid ${C.border}`, padding:'10px 14px 12px', boxShadow:'0 -4px 20px rgba(0,0,0,0.08)' }}>
  {error && <p style={{ color:'#D32F2F', fontSize:'11px', marginBottom:'6px', textAlign:'center' }}>{error}</p>}
  {items.length > 0 && (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px', padding:'6px 10px', background:C.linen, borderRadius:'8px' }}>
      <span style={{ fontSize:'11px', color:C.stone }}>{totalQty} item{totalQty>1?'s':''} · {etaDate ? `Est. ${etaDate.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}` : ''}</span>
      <span style={{ fontSize:'13px', fontWeight:700, color:C.navy }}>{fmt.rupees(totalPaise)}</span>
    </div>
  )}
  <button onClick={save} disabled={saving || items.length===0}
    style={{ width:'100%', padding:'13px', background:items.length===0?'#E0E0E0':saving?C.stone:C.saffron, color:items.length===0?C.stone:'#fff', border:'none', borderRadius:'10px', fontSize:'13px', fontWeight:700, cursor:items.length===0?'not-allowed':'pointer', fontFamily:'DM Sans, sans-serif' }}>
    {saving ? '⏳ Saving...' : items.length===0 ? 'Add items above' : `✅ Confirm ${totalQty} item${totalQty>1?'s':''} · ${fmt.rupees(totalPaise)}`}
  </button>
  <p style={{ textAlign:'center', fontSize:'9px', color:C.stone, marginTop:'5px' }}>Customer notified with item list + delivery date</p>
</div>
    </div>
  );
}

// ── RIDER DASHBOARD ─────────────────────────────────────────
export default function RiderApp() {
  const { user, profile, signOut } = useAuth();
  const [orders,    setOrders]    = useState([]);
  const [tab,       setTab]       = useState('active');
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState('');
  const [itemEntry, setItemEntry] = useState(null);

  useEffect(() => {
    fetchOrders();
    const ch = supabase.channel('rider_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    const gps = setInterval(updateGPS, 30000);
    updateGPS();
    return () => { supabase.removeChannel(ch); clearInterval(gps); };
  }, [tab]);

  async function fetchOrders() {
    setLoading(true);
    const statuses = tab === 'active'
      ? ['pending_pickup', 'rider_assigned', 'picked_up', 'in_cleaning', 'out_for_delivery']
      : ['delivered', 'cancelled'];

    let q = supabase.from('orders')
      .select('*, customer_id, special_notes, address:addresses(flat_no,area,city,landmark), items:order_items(service_name,quantity,price_paise), customer:profiles!orders_customer_id_fkey(full_name,phone)')
      .in('status', statuses)
      .order('created_at', { ascending: false });

    if (tab === 'active') q = q.or(`rider_id.eq.${user.id},rider_id.is.null`);
    else q = q.eq('rider_id', user.id);

    const { data } = await q;
    setOrders(data || []);
    setLoading(false);
  }

  function updateGPS() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      supabase.from('rider_locations')
        .upsert({ rider_id: user.id, lat: pos.coords.latitude, lng: pos.coords.longitude, updated_at: new Date().toISOString() })
        .then(() => {});
    });
  }

  async function updateStatus(orderId, status, assignSelf) {
    const update = { status };
    if (assignSelf) update.rider_id = profile.id;
    if (status === 'picked_up') update.picked_up_at = new Date().toISOString();
    if (status === 'delivered') update.delivered_at = new Date().toISOString();

    const { error } = await supabase.from('orders').update(update).eq('id', orderId);
    if (error) showToast('Error: ' + error.message);
    else { showToast('Status updated ✓'); fetchOrders(); }
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  if (itemEntry) return (
    <ItemEntry
      order={itemEntry}
      onDone={() => { setItemEntry(null); fetchOrders(); showToast('Items saved — customer notified ✓'); }}
      onBack={() => setItemEntry(null)}
    />
  );

  const NEXT = {
    pending_pickup:   { label: '✅ Accept & assign to me', next: 'rider_assigned', assignSelf: true },
    rider_assigned:   { label: '📦 Mark as picked up',    next: 'picked_up' },
    // picked_up intentionally omitted — ItemEntry handles the picked_up → in_cleaning transition
    // after rider enters items. Showing "Hand to facility" here would let the rider skip item entry.
    out_for_delivery: { label: '✅ Mark delivered',       next: 'delivered' },
  };

  const STATUS_LABEL = {
    pending_pickup:   { text: 'New pickup',  color: C.saffron,  bg: '#FFF0E8' },
    rider_assigned:   { text: 'Go pickup',   color: C.saffron,  bg: '#FFF0E8' },
    picked_up:        { text: 'Picked up',   color: '#1A5FBF',  bg: '#E5EEFF' },
    in_cleaning:      { text: 'At facility', color: '#1A5FBF',  bg: '#E5EEFF' },
    out_for_delivery: { text: 'Delivering',  color: C.saffron,  bg: '#FFF0E8' },
    delivered:        { text: 'Done ✓',     color: '#0A6B3E',  bg: '#E8F5EE' },
  };

  const stats = [
    { val: orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length, lbl: 'Active' },
    { val: orders.filter(o => ['pending_pickup', 'rider_assigned'].includes(o.status)).length, lbl: 'Pending' },
    { val: orders.filter(o => o.status === 'delivered').length, lbl: 'Done today' },
  ];

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', background: '#111827', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: C.navy, padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: '#fff', letterSpacing: '2px', fontWeight: 400 }}>KAIR</span>
              <span style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>RIDER</span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginTop: '1px' }}>🏍️ {profile?.full_name || 'Rider'}</div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)' }}>Pune · Online</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ background: '#065F46', borderRadius: '20px', padding: '3px 9px', fontSize: '9px', fontWeight: 700, color: '#6EE7B7' }}>● Online</div>
            <button onClick={signOut} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '7px', padding: '5px 10px', color: 'rgba(255,255,255,0.6)', fontSize: '11px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Sign out</button>
          </div>
        </div>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', overflow: 'hidden' }}>
          {stats.map((s, i) => (
            <div key={s.lbl} style={{ flex: 1, padding: '8px 4px', textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: C.saffron }}>{s.val}</div>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#1F2937', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {[['active', 'Active pickups'], ['done', 'Completed']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ flex: 1, padding: '11px', border: 'none', background: 'transparent', fontFamily: 'DM Sans, sans-serif', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: tab === id ? C.saffron : 'rgba(255,255,255,0.4)', borderBottom: `2px solid ${tab === id ? C.saffron : 'transparent'}` }}>
            {label}
          </button>
        ))}
      </div>

      {/* Orders */}
      <div style={{ padding: '10px 12px 20px' }}>
        {loading && <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>}
        {!loading && orders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>🎉</div>
            <p>No {tab === 'active' ? 'active' : 'completed'} orders</p>
          </div>
        )}

        {orders.map(order => {
          const sl = STATUS_LABEL[order.status] || { text: order.status, color: C.stone, bg: C.linen };
          const nextAction = NEXT[order.status];
          const totalRs = order.total_paise > 0 ? fmt.rupees(order.total_paise) : 'TBD';
          const addr = [order.address?.flat_no, order.address?.area, order.address?.city].filter(Boolean).join(', ');

          return (
            <div key={order.id} style={{ background: '#1F2937', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '10px', overflow: 'hidden' }}>
              {/* Card header */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '2px 7px', borderRadius: '4px' }}>{order.order_number}</span>
                  <span style={{ fontSize: '9px', fontWeight: 700, padding: '3px 9px', borderRadius: '10px', background: sl.bg, color: sl.color }}>{sl.text}</span>
                  {order.pickup_type === 'urgent' && <span style={{ fontSize: '9px', background: '#FFF0E8', color: C.saffron, padding: '2px 7px', borderRadius: '8px', fontWeight: 700 }}>⚡ URGENT</span>}
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: C.saffron }}>{totalRs}</span>
              </div>

              {/* Card body */}
              <div style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: C.navy, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
                    {(order.customer?.full_name || 'C')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{order.customer?.full_name || 'Customer'}</div>
                    <a href={`tel:${order.customer?.phone}`} style={{ fontSize: '11px', color: C.saffron, textDecoration: 'none', fontWeight: 600 }}>{order.customer?.phone || '—'}</a>
                  </div>
                </div>
                <a href={`https://maps.google.com/?q=${encodeURIComponent(addr || 'Pune')}`} target="_blank" rel="noreferrer"
                  style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.04)', borderRadius: '7px', padding: '7px 9px', marginBottom: '8px', textDecoration: 'none' }}>
                  <div>📍 {order.address?.flat_no || order.address?.area || '—'}</div>
                  {order.address?.flat_no && order.address?.area && <div style={{ paddingLeft: '17px', marginTop: '2px' }}>{order.address.area}</div>}
                  {order.address?.landmark && <div style={{ paddingLeft: '17px', marginTop: '2px', opacity: 0.7 }}>Near {order.address.landmark}</div>}
                  <div style={{ paddingLeft: '17px', marginTop: '2px', opacity: 0.6 }}>{order.address?.city || 'Pune'}</div>
                  <div style={{ paddingLeft: '17px', marginTop: '4px', fontSize: '9px', opacity: 0.35 }}>↗ Open in Maps</div>
                </a>

                {/* Special instructions */}
                {order.special_notes && (
                  <div style={{ fontSize: '10px', color: '#fff', background: 'rgba(255,255,255,0.08)', padding: '8px', borderRadius: '7px', marginBottom: '8px', borderLeft: `3px solid ${C.saffron}` }}>
                    <div style={{ fontSize: '9px', opacity: 0.5, marginBottom: '3px' }}>📝 Special instructions:</div>
                    <div style={{ opacity: 0.9 }}>{order.special_notes}</div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {nextAction && (
                    <button onClick={() => updateStatus(order.id, nextAction.next, nextAction.assignSelf)}
                      style={{ flex: 1, padding: '10px', background: C.saffron, color: '#fff', border: 'none', borderRadius: '9px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                      {nextAction.label}
                    </button>
                  )}
                  {order.status === 'picked_up' && !order.items_confirmed && (
                    <button onClick={() => setItemEntry({ ...order })}
                      style={{ flex: 1, padding: '10px', background: C.saffron, color: '#fff', border: 'none', borderRadius: '9px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                      📋 Enter items & confirm
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: C.navy, color: '#fff', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 500, zIndex: 200, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

const qtyBtn = {
  width: '26px', height: '26px', borderRadius: '50%',
  border: `1.5px solid ${C.saffron}`, background: '#fff',
  color: C.saffron, fontSize: '15px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
};
