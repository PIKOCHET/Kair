/**
 * Click & Collect Feature for Kair v2.0
 * Allows customers to pick up orders from nearby collection points instead of home delivery
 */

import { supabase } from './supabase';

/**
 * Get nearby collection points for a customer address
 * Returns partners within coverage_radius_m of the address
 */
export const getNearbyCollectionPoints = async (customerLat, customerLng, radiusKm = 2) => {
  try {
    // Fetch all active channel partners
    const { data: partners } = await supabase
      .from('channel_partners')
      .select('*')
      .eq('is_active', true);

    if (!partners) return [];

    // Filter partners within radius
    const nearby = partners.filter(partner => {
      const distance = haversineDistance(
        customerLat,
        customerLng,
        partner.lat,
        partner.lng
      );
      return distance <= radiusKm;
    });

    // Sort by distance (nearest first)
    return nearby.sort((a, b) => {
      const distA = haversineDistance(customerLat, customerLng, a.lat, a.lng);
      const distB = haversineDistance(customerLat, customerLng, b.lat, b.lng);
      return distA - distB;
    });
  } catch (error) {
    console.error('Error getting collection points:', error);
    return [];
  }
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Create Click & Collect order
 * Instead of home delivery, customer picks up from partner
 */
export const createClickAndCollectOrder = async (customerId, items, collectionPointId, address) => {
  try {
    // Create order with click_and_collect flag
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        customer_id: customerId,
        channel_partner_id: collectionPointId,
        status: 'pending_pickup',
        pickup_type: 'urgent',
        is_click_and_collect: true, // New flag
        delivery_address_id: address.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Add order items
    const itemsToInsert = items.map(item => ({
      order_id: order.id,
      service_id: null,
      service_name: item.name,
      quantity: item.qty,
      price_paise: item.price_paise
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    // Notify customer
    await supabase.from('notifications').insert({
      user_id: customerId,
      order_id: order.id,
      type: 'click_and_collect_created',
      title: '🏪 Click & Collect Order Created',
      message: `Your Click & Collect order ${order.order_number} is ready. Pick it up from the collection point after cleaning.`,
      is_read: false
    });

    return order;
  } catch (error) {
    console.error('Error creating Click & Collect order:', error);
    throw error;
  }
};

/**
 * Update Click & Collect order to "ready for pickup"
 * Called when order cleaning is complete
 */
export const markReadyForPickup = async (orderId, collectionPointId) => {
  try {
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'ready_for_pickup', // New status
        ready_for_pickup_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) throw error;

    // Notify customer
    const { data: order } = await supabase
      .from('orders')
      .select('*, customer:profiles(full_name)')
      .eq('id', orderId)
      .single();

    if (order) {
      await supabase.from('notifications').insert({
        user_id: order.customer_id,
        order_id: orderId,
        type: 'ready_for_pickup',
        title: '🎉 Ready for Pickup!',
        message: `Your order ${order.order_number} is ready! Pick it up from your collection point.`,
        is_read: false
      });
    }

    return true;
  } catch (error) {
    console.error('Error marking as ready for pickup:', error);
    throw error;
  }
};

/**
 * Customer pickup order from collection point
 * Changes status to collected (instead of delivered)
 */
export const customerPickupOrder = async (orderId, customerId) => {
  try {
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'collected_by_customer', // New status
        collected_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('customer_id', customerId);

    if (error) throw error;

    // Notify customer
    await supabase.from('notifications').insert({
      user_id: customerId,
      order_id: orderId,
      type: 'collected',
      title: '✓ Order Collected',
      message: 'You have successfully collected your order. Thank you for using Kair!',
      is_read: false
    });

    return true;
  } catch (error) {
    console.error('Error recording customer pickup:', error);
    throw error;
  }
};

/**
 * Get collection point details with operating hours
 */
export const getCollectionPointDetails = async (partnerId) => {
  try {
    const { data: partner } = await supabase
      .from('channel_partners')
      .select('*')
      .eq('id', partnerId)
      .single();

    if (!partner) return null;

    return {
      ...partner,
      operatingHours: {
        open: '10:00 AM',
        close: '10:00 PM', // Default hours, can be customized per partner
        days: 'Daily (7 days/week)'
      },
      directions: `https://maps.google.com/?q=${partner.lat},${partner.lng}`,
      contact: 'Call the collection point for queries'
    };
  } catch (error) {
    console.error('Error getting collection point details:', error);
    return null;
  }
};

/**
 * Track Click & Collect order
 */
export const trackClickAndCollectOrder = async (orderId) => {
  try {
    const { data: order } = await supabase
      .from('orders')
      .select(`
        *,
        partner:channel_partners(name, address, lat, lng),
        items:order_items(service_name, quantity)
      `)
      .eq('id', orderId)
      .single();

    if (!order) return null;

    return {
      orderNumber: order.order_number,
      status: order.status,
      collectionPoint: order.partner?.name,
      address: order.partner?.address,
      items: order.items,
      readyAt: order.ready_for_pickup_at,
      collectedAt: order.collected_at,
      total: order.total_paise,
      mapLink: `https://maps.google.com/?q=${order.partner?.lat},${order.partner?.lng}`,
      timeline: getOrderTimeline(order)
    };
  } catch (error) {
    console.error('Error tracking order:', error);
    return null;
  }
};

/**
 * Get order timeline for Click & Collect
 */
const getOrderTimeline = (order) => {
  const timeline = [];

  timeline.push({
    status: 'Order Placed',
    time: new Date(order.created_at).toLocaleString(),
    completed: true
  });

  if (order.rider_id) {
    timeline.push({
      status: 'Picked Up',
      time: new Date(order.picked_up_at).toLocaleString(),
      completed: !!order.picked_up_at
    });
  }

  timeline.push({
    status: 'At Collection Point',
    time: order.at_partner_at ? new Date(order.at_partner_at).toLocaleString() : '—',
    completed: !!order.at_partner_at
  });

  timeline.push({
    status: 'In Cleaning',
    time: order.status === 'in_cleaning' || order.status === 'quality_check' || order.status === 'ready_for_pickup' ? 'In progress' : '—',
    completed: false
  });

  timeline.push({
    status: 'Ready for Pickup',
    time: order.ready_for_pickup_at ? new Date(order.ready_for_pickup_at).toLocaleString() : '—',
    completed: !!order.ready_for_pickup_at
  });

  timeline.push({
    status: 'Collected by You',
    time: order.collected_at ? new Date(order.collected_at).toLocaleString() : '—',
    completed: !!order.collected_at
  });

  return timeline;
};

/**
 * Get Click & Collect statistics for admin
 */
export const getClickAndCollectStats = async () => {
  try {
    const { data: orders } = await supabase
      .from('orders')
      .select('status, is_click_and_collect');

    if (!orders) return {};

    const cnc = orders.filter(o => o.is_click_and_collect);

    return {
      totalClickAndCollect: cnc.length,
      ready: cnc.filter(o => o.status === 'ready_for_pickup').length,
      collected: cnc.filter(o => o.status === 'collected_by_customer').length,
      pending: cnc.filter(o => o.status === 'pending_pickup' || o.status === 'rider_assigned').length,
      percentageOfTotal: ((cnc.length / orders.length) * 100).toFixed(1) + '%'
    };
  } catch (error) {
    console.error('Error getting C&C stats:', error);
    return {};
  }
};

/**
 * New order statuses for Click & Collect
 */
export const CNC_STATUSES = {
  ready_for_pickup: {
    label: '🏪 Ready for Pickup',
    color: '#0A6B3E',
    bg: '#E8F5EE'
  },
  collected_by_customer: {
    label: '✓ Collected',
    color: '#0A6B3E',
    bg: '#E8F5EE'
  }
};
