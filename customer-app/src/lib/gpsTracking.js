/**
 * GPS Tracking for Batch Riders
 * Real-time location updates during collection and delivery routes
 */

import { supabase } from './supabase';

/**
 * Start tracking batch rider location
 * Updates every 30 seconds or on significant movement
 */
export const startGPSTracking = (riderId, onLocationUpdate) => {
  let watchId;
  let lastUpdateTime = Date.now();
  const MIN_TIME_INTERVAL = 30000; // 30 seconds minimum
  const MIN_DISTANCE = 100; // 100 meters significant movement

  if (!navigator.geolocation) {
    console.error('Geolocation not supported');
    return null;
  }

  watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTime;

      // Only update if enough time has passed or significant distance moved
      if (timeSinceLastUpdate >= MIN_TIME_INTERVAL) {
        const location = {
          rider_id: riderId,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          speed: position.coords.speed,
          heading: position.coords.heading,
          timestamp: new Date().toISOString()
        };

        // Update in database
        try {
          await supabase.from('rider_locations').upsert(location);
          lastUpdateTime = now;

          // Notify listeners
          if (onLocationUpdate) {
            onLocationUpdate(location);
          }
        } catch (error) {
          console.error('Error updating location:', error);
        }
      }
    },
    (error) => {
      console.error('Geolocation error:', error);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0, // Always get fresh location
      timeout: 10000
    }
  );

  return watchId;
};

/**
 * Stop tracking batch rider
 */
export const stopGPSTracking = (watchId) => {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
  }
};

/**
 * Get real-time location of a batch rider
 */
export const getRiderLocation = async (riderId) => {
  try {
    const { data } = await supabase
      .from('rider_locations')
      .select('*')
      .eq('rider_id', riderId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    return data || null;
  } catch (error) {
    console.error('Error getting rider location:', error);
    return null;
  }
};

/**
 * Subscribe to real-time rider location updates
 */
export const subscribeToRiderLocation = (riderId, callback) => {
  try {
    const subscription = supabase
      .channel(`rider_location:rider_id=eq.${riderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rider_locations',
          filter: `rider_id=eq.${riderId}`
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();

    return subscription;
  } catch (error) {
    console.error('Error subscribing to location updates:', error);
    return null;
  }
};

/**
 * Calculate ETA based on current speed and distance
 */
export const calculateETA = (distanceKm, speedKmh = null, averageSpeedDefault = 30) => {
  const speed = speedKmh || averageSpeedDefault;
  const timeMinutes = (distanceKm / speed) * 60;
  return Math.ceil(timeMinutes);
};

/**
 * Get rider route history for a session
 */
export const getRiderRouteHistory = async (riderId, startTime, endTime) => {
  try {
    const { data } = await supabase
      .from('rider_locations')
      .select('*')
      .eq('rider_id', riderId)
      .gte('timestamp', startTime)
      .lte('timestamp', endTime)
      .order('timestamp', { ascending: true });

    return data || [];
  } catch (error) {
    console.error('Error getting route history:', error);
    return [];
  }
};

/**
 * Calculate total distance traveled
 */
export const calculateTravelledDistance = (locations) => {
  if (locations.length < 2) return 0;

  let totalDistance = 0;

  for (let i = 0; i < locations.length - 1; i++) {
    const d = haversineDistance(
      locations[i].lat,
      locations[i].lng,
      locations[i + 1].lat,
      locations[i + 1].lng
    );
    totalDistance += d;
  }

  return totalDistance.toFixed(1); // km
};

/**
 * Calculate average speed
 */
export const calculateAverageSpeed = (locations) => {
  if (locations.length < 2) return 0;

  const validSpeeds = locations
    .map(loc => loc.speed)
    .filter(speed => speed !== null && speed !== undefined && speed >= 0);

  if (validSpeeds.length === 0) return 0;

  const average = validSpeeds.reduce((sum, speed) => sum + speed, 0) / validSpeeds.length;
  return (average * 3.6).toFixed(1); // Convert m/s to km/h
};

/**
 * Haversine distance calculation
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
 * Track batch rider route in real-time
 * Updates customer with ETA
 */
export const trackBatchRiderRoute = async (riderId, ordersOnRoute, callback) => {
  try {
    // Start GPS tracking
    const watchId = startGPSTracking(riderId, async (location) => {
      // Calculate ETA for each order on route
      const etaUpdates = {};

      for (const order of ordersOnRoute) {
        const distanceKm = haversineDistance(
          location.lat,
          location.lng,
          order.partnerLat,
          order.partnerLng
        );

        const etaMinutes = calculateETA(distanceKm, location.speed);

        etaUpdates[order.id] = {
          distanceKm: distanceKm.toFixed(1),
          etaMinutes,
          lastUpdated: location.timestamp
        };

        // Notify customers
        await supabase.from('notifications').insert({
          user_id: order.customer_id,
          order_id: order.id,
          type: 'eta_update',
          title: '🚐 On the Way',
          message: `Rider is ${distanceKm.toFixed(1)}km away. ETA: ${etaMinutes} minutes`,
          is_read: false
        });
      }

      if (callback) {
        callback(etaUpdates);
      }
    });

    return watchId;
  } catch (error) {
    console.error('Error tracking batch rider route:', error);
    return null;
  }
};

/**
 * Log completed route session
 */
export const logRouteSession = async (riderId, sessionData) => {
  try {
    const { error } = await supabase.from('rider_route_sessions').insert({
      rider_id: riderId,
      session_date: new Date().toISOString().split('T')[0],
      start_time: sessionData.startTime,
      end_time: sessionData.endTime,
      total_distance_km: sessionData.totalDistance,
      total_time_minutes: sessionData.totalTime,
      average_speed_kmh: sessionData.averageSpeed,
      partners_visited: sessionData.partnersVisited,
      orders_collected: sessionData.ordersCollected,
      notes: sessionData.notes
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error logging route session:', error);
    return false;
  }
};

/**
 * Get batch rider performance statistics
 */
export const getBatchRiderStats = async (riderId, days = 30) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: sessions } = await supabase
      .from('rider_route_sessions')
      .select('*')
      .eq('rider_id', riderId)
      .gte('session_date', startDate.toISOString().split('T')[0]);

    if (!sessions || sessions.length === 0) {
      return { error: 'No data available' };
    }

    const stats = {
      totalSessions: sessions.length,
      totalDistance: sessions.reduce((sum, s) => sum + (s.total_distance_km || 0), 0).toFixed(1),
      totalTime: sessions.reduce((sum, s) => sum + (s.total_time_minutes || 0), 0),
      averageSpeed: (sessions.reduce((sum, s) => sum + (s.average_speed_kmh || 0), 0) / sessions.length).toFixed(1),
      totalPartnersVisited: sessions.reduce((sum, s) => sum + (s.partners_visited || 0), 0),
      totalOrdersCollected: sessions.reduce((sum, s) => sum + (s.orders_collected || 0), 0),
      averageOrdersPerSession: (sessions.reduce((sum, s) => sum + (s.orders_collected || 0), 0) / sessions.length).toFixed(1),
      distancePerOrder: (sessions.reduce((sum, s) => sum + (s.total_distance_km || 0), 0) / sessions.reduce((sum, s) => sum + (s.orders_collected || 0), 0)).toFixed(1)
    };

    return stats;
  } catch (error) {
    console.error('Error getting batch rider stats:', error);
    return { error: error.message };
  }
};
