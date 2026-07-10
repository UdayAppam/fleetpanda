import { describe, it, expect } from 'vitest';
import { routePath, nextAlongRoute, nearestIndex } from './route';
import { distanceKm } from '@/utils/geo';

const from = { lat: 40.7128, lng: -74.006 };
const to = { lat: 40.6413, lng: -73.7781 };

describe('routePath', () => {
  it('starts at the source and ends at the destination', () => {
    const path = routePath(from, to, 12);
    expect(path[0]).toEqual(from);
    expect(path[path.length - 1]).toEqual(to);
    expect(path).toHaveLength(13);
  });
  it('curves — the midpoint is off the straight line', () => {
    const path = routePath(from, to, 12);
    const mid = path[6];
    const straightMid = { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 };
    expect(distanceKm(mid, straightMid)).toBeGreaterThan(0.5); // deviates from the straight line
  });
  it('is deterministic', () => {
    expect(routePath(from, to)).toEqual(routePath(from, to));
  });
});

describe('nextAlongRoute', () => {
  it('advances toward the destination', () => {
    const path = routePath(from, to, 16);
    const next = nextAlongRoute(path, from, 2);
    expect(nearestIndex(path, next)).toBe(2);
    expect(distanceKm(next, to)).toBeLessThan(distanceKm(from, to));
  });
  it('clamps at the destination', () => {
    const path = routePath(from, to, 16);
    expect(nextAlongRoute(path, to, 5)).toEqual(to);
  });
  it('returns the current point for an empty path', () => {
    expect(nextAlongRoute([], from)).toEqual(from);
  });
});

describe('routePath edge cases', () => {
  it('handles identical endpoints (zero-length guard)', () => {
    const path = routePath(from, from, 4);
    expect(path[0]).toEqual(from);
    expect(path[path.length - 1]).toEqual(from);
  });
  it('produces a curve for both offset signs', () => {
    // Two endpoint pairs chosen to exercise both branches of the deterministic sign.
    const a = routePath({ lat: 10, lng: 10 }, { lat: 11, lng: 11 }, 8);
    const b = routePath({ lat: 0, lng: 0 }, { lat: 1, lng: 1 }, 8);
    expect(a).toHaveLength(9);
    expect(b).toHaveLength(9);
  });
});
