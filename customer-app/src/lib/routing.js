import { supabase } from './supabase';

/**
 * Calculate distance between two points (Haversine formula)
 * Returns distance in kilometers
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
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
 * Find the best channel partner for an order
 * Uses proximity + load balancing
 */
export const assignOrderToPartner = async (orderId, customerAddressId) => {
  try {
    // 1. Get customer address
    const { data: addressData } = await supabase
      .from('addresses')
      .select('lat, lng, area')
      .eq('id', customerAddressId)
      .single();

    if (!addressData?.lat || !addressData?.lng) {
      console.error('Address has no coordinates');
      return null;
    }

    // 2. Get all active channel partners in same area
    const { data: partners } = await supabase
      .from('channel_partners')
      .select('*')
      .eq('is_active', true)
      .eq('area', addressData.area);

    if (!partners || partners.length === 0) {
      console.log('No partners in this area');
      return null;
    }

    // 3. For each partner, count current orders
    const partnersWithLoad = await Promise.all(
      partners.map(async (partner) => {
        const { count } = await supabase
          .from('orders')
          .select('id', { count: 'exact' })
          .eq('channel_partner_id', partner.id)
          .eq('status', 'at_channel_partner');

        // Calculate distance
        const distance = calculateDistance(
          addressData.lat,
          addressData.lng,
          partner.lat || 0,
          partner.lng || 0
        );

        return {
          ...partner,
          distance,
          currentLoad: count || 0,
          // Score: lower is better (closer + fewer orders)
          score: distance * 0.7 + (count || 0) * 0.3
        };
      })
    );

    // 4. Sort by score (closest + least loaded)
    partnersWithLoad.sort((a, b) => a.score - b.score);
    const bestPartner = partnersWithLoad[0];

    // 5. Update order with assigned partner
    const { error } = await supabase
      .from('orders')
      .update({
        channel_partner_id: bestPartner.id,
        status: 'at_channel_partner',
        at_partner_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) {
      console.error('Error updating order:', error);
      return null;
    }

    // 6. Create transaction record
    await supabase
      .from('partner_transactions')
      .insert({
        channel_partner_id: bestPartner.id,
        order_id: orderId,
        type: 'received',
        commission_paise: bestPartner.commission_paise
      });

    // 7. Send notification to partner
    const { data: order } = await supabase
      .from('orders')
      .select('order_number')
      .eq('id', orderId)
      .single();

    if (order) {
      await supabase
        .from('notifications')
        .insert({
          user_id: bestPartner.profile_id,
          order_id: orderId,
          type: 'order_drop',
          title: 'New Order Received',
          message: `Order ${order.order_number} dropped at your location. ${bestPartner.commission_paise / 100} commission.`,
          is_read: false
        });
    }

    return bestPartner;
  } catch (error) {
    console.error('Error in assignOrderToPartner:', error);
    return null;
  }
};

/**
 * Get all orders waiting to be assigned to a channel partner
 * These are orders that rider has picked up but not yet dropped at partner
 */
export const getUnassignedOrders = async () => {
  try {
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        profiles!customer_id(full_name),
        addresses!delivery_address_id(area, lat, lng)
      `)
      .eq('status', 'picked_up')
      .is('channel_partner_id', null)
      .order('created_at', { ascending: false });

    return data || [];
  } catch (error) {
    console.error('Error fetching unassigned orders:', error);
    return [];
  }
};
