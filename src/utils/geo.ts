export interface LatLng {
  lat: number;
  lng: number;
}

// Haversine distance in km.
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Compass bearing (0=N, 90=E) from one point to another — used to point the truck marker.
export function bearing(from: LatLng, to: LatLng): number {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

// Pure GPS simulation step: move `pos` toward `dest` by ~stepKm; snaps when close.
export function stepToward(pos: LatLng, dest: LatLng, stepKm = 1.5): LatLng {
  const dist = distanceKm(pos, dest);
  if (dist <= stepKm || dist === 0) return { ...dest };
  const frac = stepKm / dist;
  return {
    lat: pos.lat + (dest.lat - pos.lat) * frac,
    lng: pos.lng + (dest.lng - pos.lng) * frac,
  };
}
