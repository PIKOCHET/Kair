import { useState, useEffect } from 'react';
import { useAuth }     from '../context/AuthContext';
import { useOrders }   from '../hooks/useOrders';
import { useRazorpay } from '../hooks/useRazorpay';

export default function CheckoutPage({ cart, onSuccess, onBack }) {
  const { user, profile } = useAuth();
  const { createOrder, saveAddress } = useOrders();
  const { initiatePayment, loading: payLoading } = useRazorpay();

  const [name,        setName]        = useState(profile?.full_name || '');
  const [phone,       setPhone]       = useState(profile?.phone?.replace('+91','') || '');
  const [flatNo,      setFlatNo]      = useState('');
  const [area,        setArea]        = useState('');
  const [landmark,    setLandmark]    = useState('');
  const [pickupDate,  setPickupDate]  = useState('');
  const [pickupSlot,  setPickupSlot]  = useState('12pm – 2pm');
  const [notes,       setNotes]       = useState('');
  const [payMethod,   setPayMethod]   = useState('upi');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');

  // Cart items as array
  const cartItems = Object.values(cart);
  const totalPaise = cartItems.reduce((s, i) => s + i.price_paise * i.quantity, 0);
  const totalRupees = (totalPaise / 100).toFixed(0);

  // Default pickup date = tomorrow
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setPickupDate(d.toISOString().split('T')[0]);
  }, []);

  async function handlePlaceOrder() {
    if (!name.trim() || !area.trim()) { setError('Please fill your name and area'); return; }
    setError('');
    setSubmitting(true);

    try {
      // 1. Save address and get addressId
      const address = await saveAddress({ flatNo, area, landmark, city: 'Pune' });

      // 2. Create order in Supabase
      const order = await createOrder({
        addressId:     address.id,
        items:         cartItems,
        pickupDate,
        pickupSlot,
        notes,
        paymentMethod: payMethod,
        language:      profile?.language_pref || 'en',
      });

      // 3. If COD — skip Razorpay, done
      if (payMethod === 'cod') {
        onSuccess?.(order);
        return;
      }

      // 4. Razorpay payment for UPI / card / netbanking
      await initiatePayment({
        orderId:       order.id,
        amountPaise:   totalPaise,
        customerName:  name,
        customerPhone: `+91${phone}`,
        onSuccess: () => onSuccess?.(order),
        onFailure: (msg) => setError(`Payment failed: ${msg}`),
      });

    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const PAY_METHODS = [
    { id: 'upi',      icon: '📱', label: 'UPI',          sub: 'GPay · PhonePe · Paytm' },
    { id: 'cod',      icon: '💵', label: 'Cash on delivery', sub: 'Pay when rider arrives' },
    { id: 'card',     icon: '💳', label: 'Card',          sub: 'Debit or credit card' },
    { id: 'netbanking', icon: '🏦', label: 'Net Banking', sub: 'All major banks' },
  ];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}>←</button>
        <span style={styles.headerTitle}>Your order</span>
      </div>

      {/* Order summary */}
      <section style={styles.card}>
        <h3 style={styles.cardTitle}>📋 Order summary</h3>
        {cartItems.map(item => (
          <div key={item.service_id} style={styles.itemRow}>
            <div>
              <div style={styles.itemName}>{item.emoji} {item.name_en}</div>
              <div style={styles.itemSub}>{item.quantity} × ₹{(item.price_paise / 100).toFixed(0)} {item.unit}</div>
            </div>
            <div style={styles.itemPrice}>₹{((item.price_paise * item.quantity) / 100).toFixed(0)}</div>
          </div>
        ))}
        <div style={styles.totalRow}>
          <span>Total</span>
          <span style={{ color: '#FF6B00' }}>₹{totalRupees}</span>
        </div>
      </section>

      {/* Address */}
      <section style={styles.card}>
        <h3 style={styles.cardTitle}>📍 Pickup address</h3>
        <div style={styles.formRow2}>
          <FormField label="Name" value={name} onChange={setName} placeholder="Rahul Deshmukh" />
          <FormField label="Phone" value={phone} onChange={setPhone} placeholder="98765 43210" type="tel" />
        </div>
        <FormField label="Flat / Floor" value={flatNo} onChange={setFlatNo} placeholder="B-204, Sunrise Apts" />
        <FormField label="Area / Locality *" value={area} onChange={setArea} placeholder="Koregaon Park, Pune" />
        <FormField label="Landmark" value={landmark} onChange={setLandmark} placeholder="Near D-Mart" />
      </section>

      {/* Pickup slot */}
      <section style={styles.card}>
        <h3 style={styles.cardTitle}>🕐 Pickup slot</h3>
        <div style={styles.formRow2}>
          <FormField label="Date" value={pickupDate} onChange={setPickupDate} type="date" />
          <div>
            <label style={styles.label}>Time slot</label>
            <select value={pickupSlot} onChange={e => setPickupSlot(e.target.value)} style={styles.input}>
              {['8am – 10am','10am – 12pm','12pm – 2pm','2pm – 4pm','4pm – 6pm','6pm – 8pm'].map(s =>
                <option key={s}>{s}</option>
              )}
            </select>
          </div>
        </div>
        <FormField label="Special instructions" value={notes} onChange={setNotes}
          placeholder="e.g. Gate code 1234, delicate care for silk saree..." textarea />
      </section>

      {/* Payment */}
      <section style={styles.card}>
        <h3 style={styles.cardTitle}>💳 Payment method</h3>
        <div style={styles.payGrid}>
          {PAY_METHODS.map(pm => (
            <div key={pm.id} onClick={() => setPayMethod(pm.id)}
              style={{ ...styles.payOpt, ...(payMethod === pm.id ? styles.payOptSelected : {}) }}>
              <div style={{ fontSize: '22px', marginBottom: '4px' }}>{pm.icon}</div>
              <div style={{ fontSize: '12px', fontWeight: 700 }}>{pm.label}</div>
              <div style={{ fontSize: '10px', color: '#6B6B6B', marginTop: '2px' }}>{pm.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {error && <p style={styles.error}>{error}</p>}

      <button
        onClick={handlePlaceOrder}
        disabled={submitting || payLoading}
        style={{ ...styles.placeBtn, opacity: (submitting || payLoading) ? 0.7 : 1 }}
      >
        {submitting || payLoading ? 'Processing...' : `✅ Place order · ₹${totalRupees}`}
      </button>
      <p style={{ textAlign: 'center', fontSize: '11px', color: '#6B6B6B', marginBottom: '24px' }}>
        🔒 Payments secured by Razorpay · PCI DSS compliant
      </p>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = 'text', textarea }) {
  const El = textarea ? 'textarea' : 'input';
  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={styles.label}>{label}</label>
      <El type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} rows={textarea ? 3 : undefined}
        style={{ ...styles.input, ...(textarea ? { minHeight: '70px', resize: 'vertical' } : {}) }} />
    </div>
  );
}

const styles = {
  page:       { padding: '0 16px 80px', maxWidth: '480px', margin: '0 auto' },
  header:     { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 0', marginBottom: '4px' },
  backBtn:    { width: '34px', height: '34px', borderRadius: '50%', border: '1px solid #E8E8E8', background: '#fff', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ fontSize: '17px', fontWeight: 700, color: '#0D1B3E' },
  card:       { background: '#fff', borderRadius: '14px', border: '1px solid #E8E8E8', padding: '16px', marginBottom: '12px' },
  cardTitle:  { fontSize: '14px', fontWeight: 700, marginBottom: '14px', color: '#0D1B3E' },
  itemRow:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid #F5F4F1' },
  itemName:   { fontSize: '13px', fontWeight: 600 },
  itemSub:    { fontSize: '11px', color: '#6B6B6B', marginTop: '2px' },
  itemPrice:  { fontSize: '13px', fontWeight: 700, color: '#FF6B00' },
  totalRow:   { display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 700, paddingTop: '8px', borderTop: '2px solid #E8E8E8', marginTop: '4px' },
  formRow2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  label:      { display: 'block', fontSize: '11px', fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '5px' },
  input:      { width: '100%', padding: '10px 12px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', fontFamily: 'Poppins, sans-serif', color: '#0D1B3E', outline: 'none', boxSizing: 'border-box' },
  payGrid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  payOpt:     { border: '2px solid #E8E8E8', borderRadius: '10px', padding: '12px 8px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' },
  payOptSelected: { borderColor: '#FF6B00', background: '#FFF0E5' },
  error:      { color: '#D32F2F', fontSize: '13px', marginBottom: '10px', textAlign: 'center' },
  placeBtn:   { width: '100%', padding: '15px', background: '#FF6B00', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', marginBottom: '8px' },
};
