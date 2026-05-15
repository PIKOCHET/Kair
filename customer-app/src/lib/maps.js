/**
 * Google Maps Integration for Kair v2.0
 * Provides route optimization, direction generation, and distance calculation
 */

// Note: Set VITE_GOOGLE_MAPS_API_KEY in .env.local
const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/**
 * Calculate route distance and duration between two points
 */
export const getRouteInfo = async (startLat, startLng, endLat, endLng) => {
  try {
    if (!MAPS_API_KEY) {
      console.warn('Google Maps API key not configured');
      return null;
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?` +
      `origins=${startLat},${startLng}&` +
      `destinations=${endLat},${endLng}&` +
      `key=${MAPS_API_KEY}`
    );

    const data = await response.json();

    if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
      const element = data.rows[0].elements[0];
      return {
        distanceMeters: element.distance.value,
        distanceKm: (element.distance.value / 1000).toFixed(1),
        durationSeconds: element.duration.value,
        durationMinutes: Math.round(element.duration.value / 60),
        humanDistance: element.distance.text,
        humanDuration: element.duration.text
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting route info:', error);
    return null;
  }
};

/**
 * Optimize batch rider route using Traveling Salesman Problem (TSP) approximation
 * Uses nearest neighbor heuristic for fast calculation
 * Returns ordered list of partners for most efficient route
 */
export const optimizeRoute = async (startPoint, partners) => {
  try {
    // Use nearest neighbor algorithm for route optimization
    const optimized = [];
    const remaining = [...partners];
    let current = startPoint;

    while (remaining.length > 0) {
      // Find nearest unvisited partner
      let nearest = remaining[0];
      let minDistance = await calculateDistance(
        current.lat,
        current.lng,
        nearest.lat,
        nearest.lng
      );

      for (let i = 1; i < remaining.length; i++) {
        const dist = await calculateDistance(
          current.lat,
          current.lng,
          remaining[i].lat,
          remaining[i].lng
        );

        if (dist < minDistance) {
          minDistance = dist;
          nearest = remaining[i];
        }
      }

      optimized.push({ ...nearest, distanceFromPrevious: minDistance });
      current = nearest;

      // Remove from remaining
      remaining.splice(remaining.indexOf(nearest), 1);
    }

    return optimized;
  } catch (error) {
    console.error('Error optimizing route:', error);
    return partners; // Return original order if optimization fails
  }
};

/**
 * Calculate straight-line distance (Haversine) between two coordinates
 * Used for quick estimates before calling Google Maps API
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
  return R * c; // Distance in km
};

/**
 * Get Google Maps URL for a location (useful for opening in maps app)
 */
export const getMapsUrl = (lat, lng, label = '') => {
  return `https://maps.google.com/?q=${lat},${lng}`;
};

/**
 * Get embedded maps iframe URL for displaying route
 */
export const getEmbedMapsUrl = (lat, lng, zoom = 15) => {
  if (!MAPS_API_KEY) return null;
  return `https://www.google.com/maps/embed/v1/place?q=${lat},${lng}&key=${MAPS_API_KEY}&zoom=${zoom}`;
};

/**
 * Calculate total route distance and time
 */
export const calculateRouteSummary = async (partners) => {
  let totalDistance = 0;
  let totalTime = 0;

  if (partners.length === 0) return { totalDistance: 0, totalTime: 0, avgPerStop: 0 };

  for (let i = 0; i < partners.length - 1; i++) {
    const route = await getRouteInfo(
      partners[i].lat,
      partners[i].lng,
      partners[i + 1].lat,
      partners[i + 1].lng
    );

    if (route) {
      totalDistance += route.distanceMeters;
      totalTime += route.durationSeconds;
    }
  }

  return {
    totalDistance: (totalDistance / 1000).toFixed(1),
    totalTime: Math.round(totalTime / 60),
    avgPerStop: (totalDistance / 1000 / partners.length).toFixed(1)
  };
};

/**
 * Generate directions text for route
 */
export const generateDirections = (orderedPartners) => {
  let directions = '';
  orderedPartners.forEach((partner, index) => {
    directions += `${index + 1}. ${partner.name} (${partner.area})\n`;
    if (partner.distanceFromPrevious) {
      directions += `   Distance: ${partner.distanceFromPrevious.toFixed(1)} km\n`;
    }
  });
  return directions;
};
