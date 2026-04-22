import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { C, CATALOG, fmt } from '../lib/constants';
import { uploadOrderImage } from '../lib/imageUpload';
import { Camera, Gift, AlertCircle, Zap, MapPin, Bike, Check, Loader, ChevronLeft, Clock, ClipboardList } from 'lucide-react';

const ALL_SVCS = Object.entries(CATALOG).map(([cat, items]) => ({ cat, items }));

// ── ITEM ENTRY ─────────────────────────────────────────────
function ItemEntry({ order, onDone, onBack }) {
  const { user } = useAuth();
  const [cart,           setCart]           = useState({});
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState('');
  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploading,      setUploading]      = useState(false);
  const [uploadError,    setUploadError]    = useState('');

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

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const result = await uploadOrderImage(order.id, user.id, file, 'damage', 'Rider uploaded during pickup');
      setUploadedImages([...uploadedImages, result]);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function removeImage(index) {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index));
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
        <button onClick={onBack} style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Enter items — {order.order_number}</div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{order.customer?.full_name} · {[order.address?.flat_no, order.address?.area].filter(Boolean).join(', ') || 'Pune'}</div>
        </div>
      </div>

      <div style={{ padding: '10px 12px 110px' }}>
        {/* Special instructions from customer */}
        {order.special_notes && (
          <div style={{ background: '#FFF0E8', borderRadius: '10px', padding: '12px', marginBottom: '10px', borderLeft: `3px solid ${C.saffron}` }}>
            <div style={{ fontSize: '11px', color: C.saffron, fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>📝</span>
              Customer's special instructions:
            </div>
            <div style={{ fontSize: '13px', color: C.navy }}>{order.special_notes}</div>
          </div>
        )}

        {/* Promo code applied */}
        {order.promo_code && (
          <div style={{ background: '#E8F5EE', borderRadius: '10px', padding: '12px', marginBottom: '10px', borderLeft: `3px solid ${C.success}` }}>
            <div style={{ fontSize: '11px', color: C.success, fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Gift size={14} strokeWidth={2.5} />
              Promo code applied: {order.promo_code}
            </div>
            <div style={{ fontSize: '13px', color: C.navy }}>Discount: {fmt.rupees(order.discount_paise || 0)}</div>
          </div>
        )}

        {/* Image upload for damage documentation */}
        <div style={{ background: '#fff', borderRadius: '14px', border: `1px solid ${C.border}`, padding: '14px', marginBottom: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: C.navy, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={16} strokeWidth={2.5} color={C.saffron} />
            Upload damage photos (optional)
          </div>
          <label style={{ display: 'block', padding: '16px', border: `2px dashed ${C.border}`, borderRadius: '10px', textAlign: 'center', cursor: 'pointer', background: C.linen, marginBottom: '8px' }}>
            <input type='file' accept='image/*' onChange={handleImageUpload} disabled={uploading} style={{ display: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
              <Camera size={28} strokeWidth={2} color={C.saffron} />
            </div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: C.navy }}>
              {uploading ? 'Uploading...' : 'Tap to upload'}
            </div>
          </label>
          {uploadError && <div style={{ fontSize: '10px', color: C.danger, padding: '8px', background: C.dangerBg, borderRadius: '8px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={14} strokeWidth={2.5} />
            {uploadError}
          </div>}
          {uploadedImages.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
              {uploadedImages.map((img, i) => (
                <div key={i} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: `2px solid ${C.saffron}`, background: C.linen, aspectRatio: '1/1' }}>
                  <img src={img.url} alt='damage' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => removeImage(i)}
                    style={{ position: 'absolute', top: '6px', right: '6px', width: '28px', height: '28px', borderRadius: '50%', background: C.danger, color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronLeft size={16} strokeWidth={2.5} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

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
<div style={{ position:'fixed', bottom:0, left:0, right:0, maxWidth:'480px', margin:'0 auto', background:'#fff', borderTop:`1px solid ${C.border}`, padding:'12px 14px 14px', boxShadow:'0 -4px 20px rgba(0,0,0,0.08)' }}>
  {error && <p style={{ color:'#D32F2F', fontSize:'11px', marginBottom:'8px', textAlign:'center' }}>{error}</p>}
  {items.length > 0 && (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px', padding:'8px 12px', background:C.linen, borderRadius:'10px' }}>
      <span style={{ fontSize:'12px', color:C.stone, fontWeight:500 }}>{totalQty} item{totalQty>1?'s':''} · {etaDate ? `Est. ${etaDate.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}` : ''}</span>
      <span style={{ fontSize:'14px', fontWeight:700, color:C.navy }}>{fmt.rupees(totalPaise)}</span>
    </div>
  )}
  <button onClick={save} disabled={saving || items.length===0}
    style={{ width:'100%', padding:'14px', background:items.length===0?'#E0E0E0':saving?C.stone:C.saffron, color:items.length===0?C.stone:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:700, cursor:items.length===0?'not-allowed':'pointer', fontFamily:'DM Sans, sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
    {saving ? (
      <>
        <Loader size={16} strokeWidth={2.5} />
        Saving...
      </>
    ) : items.length===0 ? (
      'Add items above'
    ) : (
      <>
        <Check size={16} strokeWidth={2.5} />
        Confirm {totalQty} item{totalQty>1?'s':''} · {fmt.rupees(totalPaise)}
      </>
    )}
  </button>
  <p style={{ textAlign:'center', fontSize:'10px', color:C.stone, marginTop:'6px', fontWeight:500 }}>Customer notified with item list + delivery date</p>
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
      <div style={{ background: `linear-gradient(135deg, ${C.navy} 0%, #152447 100%)`, padding: '16px 18px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', color: '#fff', letterSpacing: '2px', fontWeight: 400 }}>KAIR</span>
              <span style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', fontSize: '9px', padding: '3px 7px', borderRadius: '5px', fontWeight: 600 }}>RIDER</span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bike size={18} strokeWidth={2.5} color='#fff' />
              {profile?.full_name || 'Rider'}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>Pune · Online</div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ background: '#065F46', borderRadius: '20px', padding: '5px 11px', fontSize: '10px', fontWeight: 700, color: '#6EE7B7' }}>● Online</div>
            <button onClick={signOut} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '6px 12px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>Sign out</button>
          </div>
        </div>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden' }}>
          {stats.map((s, i) => (
            <div key={s.lbl} style={{ flex: 1, padding: '10px 6px', textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '26px', fontWeight: 700, color: C.saffron }}>{s.val}</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{s.lbl}</div>
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
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
              <Check size={48} strokeWidth={1.5} color='rgba(255,255,255,0.3)' />
            </div>
            <p style={{ fontSize: '14px', fontWeight: 500 }}>No {tab === 'active' ? 'active' : 'completed'} orders</p>
          </div>
        )}

        {orders.map(order => {
          const sl = STATUS_LABEL[order.status] || { text: order.status, color: C.stone, bg: C.linen };
          const nextAction = NEXT[order.status];
          const totalRs = order.total_paise > 0 ? fmt.rupees(order.total_paise) : 'TBD';
          const addr = [order.address?.flat_no, order.address?.area, order.address?.city].filter(Boolean).join(', ');

          return (
            <div key={order.id} style={{ background: '#1F2937', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
              {/* Card header */}
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, background: 'rgba(255,255,255,0.12)', color: '#fff', padding: '4px 8px', borderRadius: '5px' }}>{order.order_number}</span>
                  <span style={{ fontSize: '10px', fontWeight: 600, padding: '4px 10px', borderRadius: '12px', background: sl.bg, color: sl.color }}>{sl.text}</span>
                  {order.pickup_type === 'urgent' && <span style={{ fontSize: '10px', background: '#FFF0E8', color: C.saffron, padding: '4px 8px', borderRadius: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Zap size={12} strokeWidth={2.5} />
                    URGENT
                  </span>}
                </div>
                <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', fontWeight: 700, color: C.saffron }}>{totalRs}</span>
              </div>

              {/* Card body */}
              <div style={{ padding: '12px 14px' }}>
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
                  style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '9px 11px', marginBottom: '8px', textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <MapPin size={14} strokeWidth={2.5} />
                    {order.address?.flat_no || order.address?.area || '—'}
                  </div>
                  {order.address?.flat_no && order.address?.area && <div style={{ paddingLeft: '17px', marginTop: '2px' }}>{order.address.area}</div>}
                  {order.address?.landmark && <div style={{ paddingLeft: '17px', marginTop: '2px', opacity: 0.7 }}>Near {order.address.landmark}</div>}
                  <div style={{ paddingLeft: '17px', marginTop: '2px', opacity: 0.6 }}>{order.address?.city || 'Pune'}</div>
                  <div style={{ paddingLeft: '17px', marginTop: '4px', fontSize: '9px', opacity: 0.35 }}>↗ Open in Maps</div>
                </a>

                {/* Special instructions */}
                {order.special_notes && (
                  <div style={{ fontSize: '10px', color: '#fff', background: 'rgba(255,255,255,0.08)', padding: '10px', borderRadius: '8px', marginBottom: '10px', borderLeft: `3px solid ${C.saffron}` }}>
                    <div style={{ fontSize: '10px', opacity: 0.6, marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px' }}>📝</span>
                      Special instructions:
                    </div>
                    <div style={{ opacity: 0.9 }}>{order.special_notes}</div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                  {nextAction && (
                    <button onClick={() => updateStatus(order.id, nextAction.next, nextAction.assignSelf)}
                      style={{ flex: 1, padding: '12px 10px', minHeight: '44px', background: C.saffron, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {nextAction.label}
                    </button>
                  )}
                  {order.status === 'picked_up' && !order.items_confirmed && (
                    <button onClick={() => setItemEntry({ ...order })}
                      style={{ flex: 1, padding: '12px 10px', minHeight: '44px', background: C.saffron, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <ClipboardList size={16} strokeWidth={2.5} />
                      Enter items & confirm
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
