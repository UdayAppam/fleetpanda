import type { LatLng } from '@/utils/geo';

// {lat,lng}[] → Leaflet [lat,lng][] tuples (shared by the fleet & driver maps).
export const toLatLngs = (pts: LatLng[]): [number, number][] => pts.map((p) => [p.lat, p.lng]);
