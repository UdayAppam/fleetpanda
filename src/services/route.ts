import { distanceKm, type LatLng } from '@/utils/geo';

// A deterministic curved path between two points — a *pseudo* road route (offline, no routing
// API). Quadratic Bézier with a perpendicular mid-offset so the line curves like a real road
// instead of cutting dead-straight. (Real road geometry would need an external routing service;
// see docs/DECISIONS.md ADR-25.)
export function routePath(from: LatLng, to: LatLng, samples = 16): LatLng[] {
  const mid = { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 };
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  const len = Math.hypot(dLat, dLng) || 1;
  const perp = { lat: -dLng / len, lng: dLat / len }; // unit perpendicular
  // deterministic offset (magnitude ∝ distance; stable sign from the endpoints)
  const sign = Math.sin((from.lat + to.lng) * 7) >= 0 ? 1 : -1;
  const offset = len * 0.16 * sign;
  const ctrl = { lat: mid.lat + perp.lat * offset, lng: mid.lng + perp.lng * offset };

  const pts: LatLng[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const mt = 1 - t;
    // round to 5dp to match seed.js exactly (keeps the seeded truck pixel-perfect on the curve)
    pts.push({
      lat: +(mt * mt * from.lat + 2 * mt * t * ctrl.lat + t * t * to.lat).toFixed(5),
      lng: +(mt * mt * from.lng + 2 * mt * t * ctrl.lng + t * t * to.lng).toFixed(5),
    });
  }
  return pts;
}

export function nearestIndex(path: LatLng[], p: LatLng): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  path.forEach((q, i) => {
    const d = distanceKm(p, q);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  });
  return bestIdx;
}

// Advance `stepSamples` waypoints along the route from the current position (GPS simulation).
export function nextAlongRoute(path: LatLng[], current: LatLng, stepSamples = 2): LatLng {
  if (path.length === 0) return current;
  const idx = nearestIndex(path, current);
  return path[Math.min(idx + stepSamples, path.length - 1)];
}
