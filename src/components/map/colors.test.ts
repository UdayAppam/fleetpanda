import { describe, it, expect } from 'vitest';
import { statusColor, productColor, STATUS_COLOR, PRODUCT_COLOR, HUB_COLOR } from './colors';
import { toLatLngs } from './mapUtils';

describe('statusColor', () => {
  it('maps known statuses and falls back to grey', () => {
    expect(statusColor('in_transit')).toBe(STATUS_COLOR.in_transit);
    expect(statusColor('idle')).toBe(STATUS_COLOR.idle);
    expect(statusColor('mystery')).toBe('#7c8b90');
  });
});

describe('productColor', () => {
  it('maps known products, and falls back to the hub colour', () => {
    expect(productColor('diesel')).toBe(PRODUCT_COLOR.diesel);
    expect(productColor('unknown')).toBe(HUB_COLOR);
    expect(productColor(undefined)).toBe(HUB_COLOR);
  });
});

describe('toLatLngs', () => {
  it('converts {lat,lng} objects to [lat,lng] tuples', () => {
    expect(toLatLngs([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }])).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});
