import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth }  from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

export function useOrders() {
  const { user } = useAuth();
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch customer's orders
  async function fetchMyOrders() {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        address:addresses(flat_no, area, city),
        items:order_items(service_name, quantity, price_paise),
        tags:garment_tags(tag_code, item_name, status)
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) setOrders(data);
    setLoading(false);
  }

  // Subscribe to realtime order updates
  useEffect(() => {
    if (!user) return;

    fetchMyOrders();

    const channel = supabase
      .channel('customer_orders')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `customer_id=eq.${user.id}` },
        (payload) => {
          setOrders(prev =>
            prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o)
          );
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  // Create a new order
  async function createOrder({ addressId, items, pickupDate, pickupSlot, notes, paymentMethod, language }) {
    if (!user) throw new Error('Not logged in');

    // 1. Calculate total
    const totalPaise = items.reduce((sum, item) => sum + (item.price_paise * item.quantity), 0);

    // 2. Insert order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id:    user.id,
        address_id:     addressId,
        status:         'pending_pickup',
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'cod' ? 'pending' : 'pending',
        total_paise:    totalPaise,
        pickup_date:    pickupDate,
        pickup_slot:    pickupSlot,
        special_notes:  notes,
        language,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // 3. Insert order items
    const orderItems = items.map(item => ({
      order_id:     order.id,
      service_id:   item.service_id,
      service_name: item.name_en,
      quantity:     item.quantity,
      price_paise:  item.price_paise,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    await fetchMyOrders();
    return order;
  }

  // Save or update an address
  async function saveAddress({ label, flatNo, building, area, landmark, city, pincode }) {
    if (!user) throw new Error('Not logged in');

    const { data, error } = await supabase
      .from('addresses')
      .insert({
        user_id:  user.id,
        label,
        flat_no:  flatNo,
        building,
        area,
        landmark,
        city,
        pincode,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Fetch customer's saved addresses
  async function getAddresses() {
    if (!user) return [];

    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false });

    return data || [];
  }

  return {
    orders, loading,
    fetchMyOrders,
    createOrder,
    saveAddress,
    getAddresses,
  };
}
