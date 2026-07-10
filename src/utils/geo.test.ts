import { describe, it, expect } from 'vitest';
import { distanceKm, stepToward, bearing } from './geo';

describe('distanceKm', () => {
  it('is 0 for same point', () => expect(distanceKm({ lat: 40, lng: -74 }, { lat: 40, lng: -74 })).toBe(0));
  it('is positive between different points', () =>
    expect(distanceKm({ lat: 40, lng: -74 }, { lat: 41, lng: -74 })).toBeGreaterThan(100));
});

describe('bearing', () => {
  it('points east (~90°) for a due-east destination', () => {
    const b = bearing({ lat: 40, lng: -74 }, { lat: 40, lng: -73 });
    expect(b).toBeGreaterThan(80);
    expect(b).toBeLessThan(100);
  });
  it('points north (~0°) for a due-north destination', () => {
    const b = bearing({ lat: 40, lng: -74 }, { lat: 41, lng: -74 });
    expect(Math.abs(b)).toBeLessThan(5);
  });
});

describe('stepToward', () => {
  it('snaps to destination when within a step', () => {
    const dest = { lat: 40.001, lng: -74.001 };
    expect(stepToward({ lat: 40, lng: -74 }, dest, 5)).toEqual(dest);
  });
  it('moves partway for a far destination', () => {
    const pos = { lat: 40, lng: -74 };
    const dest = { lat: 41, lng: -74 };
    const next = stepToward(pos, dest, 1.5);
    expect(next.lat).toBeGreaterThan(pos.lat);
    expect(next.lat).toBeLessThan(dest.lat);
  });
});
