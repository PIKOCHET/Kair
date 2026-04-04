import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

// Dynamically loads the Razorpay checkout script
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function useRazorpay() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // Main function — call this when customer taps "Place Order"
  async function initiatePayment({ orderId, amountPaise, customerName, customerPhone, onSuccess, onFailure }) {
    setLoading(true);
    setError(null);

    try {
      // 1. Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Razorpay SDK failed to load. Check your internet connection.');

      // 2. Create Razorpay order on our backend
      const res = await fetch(`${API_URL}/api/payments/create-order`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          order_id:       orderId,
          amount_paise:   amountPaise,
          customer_name:  customerName,
          customer_phone: customerPhone,
        }),
      });

      if (!res.ok) throw new Error('Failed to create payment order');
      const { razorpay_order_id, amount, currency, key_id } = await res.json();

      // 3. Open Razorpay checkout modal
      const rzpOptions = {
        key:         key_id,
        amount,
        currency,
        name:        import.meta.env.VITE_APP_NAME || 'Kair',
        description: 'Laundry & Dry Cleaning — Pune',
        order_id:    razorpay_order_id,
        prefill: {
          name:    customerName,
          contact: customerPhone,
        },
        theme:  { color: '#FF6B00' },   // saffron brand color
        modal:  { escape: false },

        handler: async (response) => {
          // 4. Verify payment on our backend (critical security step)
          const verifyRes = await fetch(`${API_URL}/api/payments/verify`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              order_id:            orderId,
            }),
          });

          const verifyData = await verifyRes.json();

          if (verifyRes.ok && verifyData.success) {
            onSuccess?.(response);
          } else {
            throw new Error('Payment verification failed');
          }
        },
      };

      const rzpInstance = new window.Razorpay(rzpOptions);

      rzpInstance.on('payment.failed', (response) => {
        const msg = response.error?.description || 'Payment failed';
        setError(msg);
        onFailure?.(msg);
      });

      rzpInstance.open();

    } catch (err) {
      setError(err.message);
      onFailure?.(err.message);
    } finally {
      setLoading(false);
    }
  }

  return { initiatePayment, loading, error };
}
