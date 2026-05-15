import { supabase } from './supabase';

/**
 * Centralized notification system for all Kair events
 * Handles 11 different notification types across all roles
 */

/**
 * CUSTOMER NOTIFICATIONS
 */

// 1. Order placed - Sent to customer
export const notifyOrderPlaced = async (orderId, customerId, orderNumber) => {
  try {
    await supabase.from('notifications').insert({
      user_id: customerId,
      order_id: orderId,
      type: 'order_placed',
      title: '🧺 Order Confirmed',
      message: `${orderNumber} confirmed! Rider on the way.`,
      is_read: false
    });
  } catch (error) {
    console.error('Error notifying order placed:', error);
  }
};

// 2. Items confirmed - Sent to customer
export const notifyItemsConfirmed = async (orderId, customerId, orderNumber, itemCount, totalPaise, partnerName, eta) => {
  try {
    await supabase.from('notifications').insert({
      user_id: customerId,
      order_id: orderId,
      type: 'items_confirmed',
      title: '✓ Items Picked Up',
      message: `${itemCount} items collected · ₹${(totalPaise / 100).toFixed(0)} · Safely at ${partnerName} · Est. delivery ${eta}`,
      is_read: false
    });
  } catch (error) {
    console.error('Error notifying items confirmed:', error);
  }
};

// 3. At channel partner - Sent to customer
export const notifyAtChannelPartner = async (orderId, customerId, orderNumber, partnerName) => {
  try {
    await supabase.from('notifications').insert({
      user_id: customerId,
      order_id: orderId,
      type: 'at_channel_partner',
      title: '📍 Dropped at Collection Point',
      message: `Your items are safely at ${partnerName}. Will be cleaned overnight.`,
      is_read: false
    });
  } catch (error) {
    console.error('Error notifying at partner:', error);
  }
};

// 4. In cleaning - Sent to customer
export const notifyInCleaning = async (orderId, customerId, orderNumber) => {
  try {
    await supabase.from('notifications').insert({
      user_id: customerId,
      order_id: orderId,
      type: 'in_cleaning',
      title: '🧼 Being Professionally Cleaned',
      message: 'Your items are being cleaned and processed.',
      is_read: false
    });
  } catch (error) {
    console.error('Error notifying in cleaning:', error);
  }
};

// 5. Ready - Sent to customer
export const notifyReady = async (orderId, customerId, orderNumber) => {
  try {
    await supabase.from('notifications').insert({
      user_id: customerId,
      order_id: orderId,
      type: 'ready',
      title: '✨ Fresh and Ready',
      message: 'Your items are cleaned, packed, and ready for delivery today!',
      is_read: false
    });
  } catch (error) {
    console.error('Error notifying ready:', error);
  }
};

// 6. Out for delivery - Sent to customer
export const notifyOutForDelivery = async (orderId, customerId, orderNumber, riderName) => {
  try {
    await supabase.from('notifications').insert({
      user_id: customerId,
      order_id: orderId,
      type: 'out_for_delivery',
      title: '🚴 On the Way',
      message: `${riderName} is on the way with your items! See you soon.`,
      is_read: false
    });
  } catch (error) {
    console.error('Error notifying out for delivery:', error);
  }
};

// 7. Delivered - Sent to customer
export const notifyDelivered = async (orderId, customerId, orderNumber) => {
  try {
    await supabase.from('notifications').insert({
      user_id: customerId,
      order_id: orderId,
      type: 'delivered',
      title: '🎉 Delivered',
      message: `${orderNumber} delivered! Please rate your experience.`,
      is_read: false
    });
  } catch (error) {
    console.error('Error notifying delivered:', error);
  }
};

/**
 * CHANNEL PARTNER NOTIFICATIONS
 */

// 8. New order drop - Sent to channel partner
export const notifyPartnerNewDrop = async (partnerId, orderId, orderNumber, customerName, itemCount, commission) => {
  try {
    await supabase.from('notifications').insert({
      user_id: partnerId,
      order_id: orderId,
      type: 'order_drop',
      title: '📦 New Order Received',
      message: `${orderNumber} from ${customerName} · ${itemCount} items · ₹${(commission / 100).toFixed(0)} commission`,
      is_read: false
    });
  } catch (error) {
    console.error('Error notifying partner new drop:', error);
  }
};

// 9. Batch pickup confirmation - Sent to channel partner
export const notifyPartnerBatchPickup = async (partnerId, orderCount) => {
  try {
    await supabase.from('notifications').insert({
      user_id: partnerId,
      order_id: null,
      type: 'batch_pickup',
      title: '🚐 Batch Rider Collected',
      message: `${orderCount} orders have been picked up for the workshop.`,
      is_read: false
    });
  } catch (error) {
    console.error('Error notifying batch pickup:', error);
  }
};

// 10. Batch dispatch (morning) - Sent to channel partner
export const notifyPartnerBatchDispatch = async (partnerId, orderCount) => {
  try {
    await supabase.from('notifications').insert({
      user_id: partnerId,
      order_id: null,
      type: 'batch_dispatch',
      title: '📦 Orders Ready for Local Delivery',
      message: `${orderCount} cleaned orders have been dropped for local delivery.`,
      is_read: false
    });
  } catch (error) {
    console.error('Error notifying batch dispatch:', error);
  }
};

/**
 * BATCH RIDER NOTIFICATIONS
 */

// 11. Route ready - Sent to batch rider
export const notifyBatchRiderRouteReady = async (batchRiderId, partnerCount, orderCount) => {
  try {
    await supabase.from('notifications').insert({
      user_id: batchRiderId,
      order_id: null,
      type: 'route_ready',
      title: '🚐 Collection Route Ready',
      message: `Route ready: ${partnerCount} partners, ${orderCount} orders. Start?`,
      is_read: false
    });
  } catch (error) {
    console.error('Error notifying route ready:', error);
  }
};

// 12. Ready for morning dispatch - Sent to batch rider
export const notifyBatchRiderMorningReady = async (batchRiderId, orderCount) => {
  try {
    await supabase.from('notifications').insert({
      user_id: batchRiderId,
      order_id: null,
      type: 'morning_ready',
      title: '🌅 Ready for Morning Delivery',
      message: `Workshop ready. ${orderCount} orders for morning dispatch.`,
      is_read: false
    });
  } catch (error) {
    console.error('Error notifying morning ready:', error);
  }
};

/**
 * Get unread notifications for a user
 */
export const getUnreadNotifications = async (userId) => {
  try {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });
    return data || [];
  } catch (error) {
    console.error('Error fetching unread notifications:', error);
    return [];
  }
};

/**
 * Mark notification as read
 */
export const markAsRead = async (notificationId) => {
  try {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

/**
 * Get all notifications for a user
 */
export const getUserNotifications = async (userId, limit = 50) => {
  try {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    return [];
  }
};

/**
 * Subscribe to real-time notifications for a user
 */
export const subscribeToNotifications = (userId, callback) => {
  try {
    const subscription = supabase
      .channel(`notifications:user_id=eq.${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();

    return subscription;
  } catch (error) {
    console.error('Error subscribing to notifications:', error);
    return null;
  }
};

/**
 * Notification types summary
 */
export const NOTIFICATION_TYPES = {
  // Customer notifications (7)
  order_placed: 'Order placed',
  items_confirmed: 'Items picked up',
  at_channel_partner: 'At collection point',
  in_cleaning: 'Being cleaned',
  ready: 'Ready for delivery',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',

  // Channel partner notifications (2)
  order_drop: 'New order received',
  batch_pickup: 'Batch pickup confirmation',
  batch_dispatch: 'Ready for local delivery',

  // Batch rider notifications (2)
  route_ready: 'Collection route ready',
  morning_ready: 'Ready for morning dispatch',
};
