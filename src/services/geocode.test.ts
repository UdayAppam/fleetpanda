import { describe, it, expect, afterEach, vi } from 'vitest';
import { searchAddress, reverseGeocode } from './geocode';

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as Response;

afterEach(() => vi.unstubAllGlobals());

describe('searchAddress', () => {
  it('short-circuits (no network) for queries under 3 chars', async () => {
    expect(await searchAddress('')).toEqual([]);
    expect(await searchAddress('ab')).toEqual([]);
  });

  it('maps Nominatim results to GeoResult objects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([{ display_name: 'Main St', lat: '41.1', lon: '-73.2' }]),
    );
    vi.stubGlobal('fetch', fetchMock);
    const results = await searchAddress('Main Street');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(results).toEqual([{ label: 'Main St', lat: 41.1, lng: -73.2 }]);
  });

  it('throws on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false, 429)));
    await expect(searchAddress('rate limited')).rejects.toThrow(/geocode 429/);
  });
});

describe('reverseGeocode', () => {
  it('returns the display name for coordinates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ display_name: '1 Test St' })));
    expect(await reverseGeocode(40, -74)).toBe('1 Test St');
  });

  it('returns an empty string when no name is available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
    expect(await reverseGeocode(40, -74)).toBe('');
  });
});
