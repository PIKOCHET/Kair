import { useEffect } from 'react';
import { useOrders } from '../hooks/useOrders';

const STATUS_STEPS = ['pending_pickup', 'rider_assigned', 'picked_up', 'in_cleaning', 'quality_check', 'ready', 'out_for_delivery', 'delivered'];
const STEP_LABELS  = ['Order placed', 'Rider assigned', 'Picked up', 'Cleaning', 'Quality check', 'Ready', 'Out for delivery', 'Delivered'];

// Simplified 4-step display for the progress bar
const DISPLAY_STEPS  = ['Pickup', 'Cleaning', 'Ready', 'Delivered'];
const DISPLAY_STATUS = {
  pending_pickup:    0, rider_assigned:    0,
  picked_up:         1, in_cleaning:       1,
  quality_check:     2, ready:             2,
  out_for_delivery:  3, delivered:         3,
};

const STATUS_BADGE = {
  pending_pickup:    { label: '⏳ Rider coming',       bg: '#FFF3E0', color: '#E65100' },
  rider_assigned:    { label: '🏍️ Rider on the way',  bg: '#FFF3E0', color: '#E65100' },
  picked_up:         { label: '✅ Picked up',           bg: '#E5F0FF', color: '#1A5FBF' },
  in_cleaning:       { label: '🧼 In cleaning',         bg: '#E5F0FF', color: '#1A5FBF' },
  quality_check:     { label: '🔍 Quality check',       bg: '#E5F5EE', color: '#0A7A4B' },
  ready:             { label: '✨ Ready!',              bg: '#E5F5EE', color: '#0A7A4B' },
  out_for_delivery:  { label: '🏍️ Out for delivery',   bg: '#FFF3E0', color: '#E65100' },
  delivered:         { label: '🎉 Delivered',           bg: '#E5F5EE', color: '#0A7A4B' },
  cancelled:         { label: '❌ Cancelled',           bg: '#FDEAEA', color: '#D32F2F' },
};

export default function OrdersPage() {
  const { orders, loading, fetchMyOrders } = useOrders();

  useEffect(() => { fetchMyOrders(); }, []);

  if (loading) return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#6B6B6B' }}>
      Loading your orders...
    </div>
  );

  if (!orders.length) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
      <p style={{ color: '#6B6B6B', fontSize: '14px' }}>No orders yet. Book your first pickup!</p>
    </div>
  );

  return (
    <div style={{ padding: '16px 16px 80px' }}>
      <h2 style={styles.pageTitle}>My Orders</h2>

      {orders.map(order => {
        const badge    = STATUS_BADGE[order.status] || STATUS_BADGE['pending_pickup'];
        const stepIdx  = DISPLAY_STATUS[order.status] ?? 0;
        const pct      = Math.min((stepIdx / 3) * 100, 100);
        const totalRs  = ((order.total_paise || 0) / 100).toFixed(0);

        return (
          <div key={order.id} style={styles.card}>
            {/* Header */}
            <div style={styles.cardHeader}>
              <div>
                <div style={styles.orderId}>{order.order_number}</div>
                <div style={styles.orderService}>
                  {order.items?.map(i => `${i.quantity}× ${i.service_name}`).join(' · ')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...styles.badge, background: badge.bg, color: badge.color }}>{badge.label}</div>
                <div style={styles.orderTotal}>₹{totalRs}</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={styles.progressWrap}>
              <div style={styles.progressTrack}>
                <div style={{ ...styles.progressFill, width: `${pct}%` }} />
              </div>
              <div style={styles.stepsRow}>
                {DISPLAY_STEPS.map((s, i) => (
                  <div key={s} style={styles.step}>
                    <div style={{
                      ...styles.stepDot,
                      background: i < stepIdx ? '#FF6B00' : i === stepIdx ? '#fff' : '#F5F4F1',
                      border:     i <= stepIdx ? '2px solid #FF6B00' : '2px solid #E8E8E8',
                    }}>
                      {i < stepIdx && <span style={{ fontSize: '9px', color: '#fff' }}>✓</span>}
                      {i === stepIdx && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF6B00', display: 'block', margin: '3px' }} />}
                    </div>
                    <div style={styles.stepLabel}>{s}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Details */}
            <div style={styles.cardFooter}>
              <span>📍 {order.address?.area || '—'}</span>
              <span>🕐 {order.pickup_slot || '—'}</span>
              <span>💳 {order.payment_method?.toUpperCase()}</span>
            </div>

            {/* Garment tags if available */}
            {order.tags?.length > 0 && (
              <div style={styles.tagsSection}>
                <div style={styles.tagsTitle}>Item tracking</div>
                <div style={styles.tagsGrid}>
                  {order.tags.map(tag => (
                    <div key={tag.tag_code} style={styles.tagChip}>
                      <span style={styles.tagCode}>{tag.tag_code}</span>
                      <span style={{ fontSize: '11px', color: '#0D1B3E', marginTop: '2px' }}>{tag.item_name}</span>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, marginTop: '3px',
                        color: tag.status === 'ready' || tag.status === 'packed' ? '#0A7A4B' : '#E65100',
                      }}>
                        {tag.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  pageTitle:    { fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: '#0D1B3E' },
  card:         { background: '#fff', borderRadius: '14px', border: '1px solid #E8E8E8', padding: '16px', marginBottom: '12px' },
  cardHeader:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' },
  orderId:      { fontSize: '11px', color: '#6B6B6B', fontFamily: 'monospace', fontWeight: 700, marginBottom: '3px' },
  orderService: { fontSize: '13px', fontWeight: 600, color: '#0D1B3E', maxWidth: '200px' },
  badge:        { display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, marginBottom: '4px' },
  orderTotal:   { fontSize: '15px', fontWeight: 700, color: '#FF6B00' },
  progressWrap: { marginBottom: '12px' },
  progressTrack:{ position: 'relative', height: '2px', background: '#E8E8E8', margin: '10px 12px', borderRadius: '2px' },
  progressFill: { position: 'absolute', top: 0, left: 0, height: '2px', background: '#FF6B00', transition: 'width 0.5s', borderRadius: '2px' },
  stepsRow:     { display: 'flex', marginTop: '-11px' },
  step:         { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  stepDot:      { width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  stepLabel:    { fontSize: '9px', color: '#6B6B6B', textAlign: 'center', lineHeight: 1.3, maxWidth: '50px' },
  cardFooter:   { display: 'flex', gap: '12px', fontSize: '11px', color: '#6B6B6B', flexWrap: 'wrap', borderTop: '1px solid #F5F4F1', paddingTop: '10px', marginTop: '4px' },
  tagsSection:  { marginTop: '12px', background: '#FAFAF8', borderRadius: '8px', padding: '10px' },
  tagsTitle:    { fontSize: '11px', fontWeight: 700, color: '#6B6B6B', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' },
  tagsGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px,1fr))', gap: '6px' },
  tagChip:      { background: '#fff', border: '1px solid #E8E8E8', borderRadius: '6px', padding: '6px 8px', display: 'flex', flexDirection: 'column' },
  tagCode:      { fontSize: '9px', fontFamily: 'monospace', background: '#0D1B3E', color: '#fff', padding: '1px 5px', borderRadius: '3px', alignSelf: 'flex-start', marginBottom: '2px' },
};
