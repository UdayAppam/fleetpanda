// Geocoding via OpenStreetMap Nominatim (free). Online + rate-limited (~1 req/s); every caller
// handles failure gracefully so the form still works offline (manual address entry). See ADR-27.
const NOMINATIM = 'https://nominatim.openstreetmap.org';

async function get(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' }, signal });
  if (!res.ok) throw new Error(`geocode ${res.status}`);
  return res.json();
}

// coordinates → human address
export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string> {
  const data = (await get(`${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, signal)) as {
    display_name?: string;
  };
  return data.display_name ?? '';
}

export interface GeoResult {
  label: string;
  lat: number;
  lng: number;
}

// address text → candidate locations (for the search box)
export async function searchAddress(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  if (query.trim().length < 3) return [];
  const data = (await get(
    `${NOMINATIM}/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`,
    signal,
  )) as Array<{ display_name: string; lat: string; lon: string }>;
  return data.map((d) => ({ label: d.display_name, lat: +d.lat, lng: +d.lon }));
}
