import { describe, it, expect, beforeAll } from 'vitest';
import { orderSchema, allocationSchema, productSchema, makeHubSchema } from './schemas';
import { __setToday } from '@/utils/clock';

beforeAll(() => __setToday('2026-07-10'));

describe('past-date validation', () => {
  const baseOrder = {
    sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 5000,
    assignedDriverId: null,
  };

  it('rejects an order with a past delivery date', () => {
    const r = orderSchema.safeParse({ ...baseOrder, deliveryDate: '2026-07-09' });
    expect(r.success).toBe(false);
  });
  it('accepts today and future delivery dates', () => {
    expect(orderSchema.safeParse({ ...baseOrder, deliveryDate: '2026-07-10' }).success).toBe(true);
    expect(orderSchema.safeParse({ ...baseOrder, deliveryDate: '2026-08-01' }).success).toBe(true);
  });

  it('rejects an allocation for a past date', () => {
    const r = allocationSchema.safeParse({ vehicleId: 'v1', driverId: 'd1', date: '2026-07-01' });
    expect(r.success).toBe(false);
  });
  it('accepts an allocation for today', () => {
    expect(allocationSchema.safeParse({ vehicleId: 'v1', driverId: 'd1', date: '2026-07-10' }).success).toBe(true);
  });
});

describe('inventory / capacity validation', () => {
  const hubBase = {
    name: 'Hamilton Hub', locationType: 'hub' as const, address: '1 Test St',
    coordinates: { lat: 40, lng: -74 },
  };
  const caps = { petrol: 20000, diesel: 20000 };

  it('rejects hub inventory above a product tank capacity', () => {
    const schema = makeHubSchema(caps);
    const r = schema.safeParse({ ...hubBase, inventory: { petrol: 800000 } });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/capacity/i);
  });
  it('accepts inventory within capacity', () => {
    expect(makeHubSchema(caps).safeParse({ ...hubBase, inventory: { petrol: 12000 } }).success).toBe(true);
  });
  it('ignores inventory keys that have no known product capacity', () => {
    // 'kerosene' isn't in caps → the per-key capacity check is skipped, so it validates.
    expect(makeHubSchema(caps).safeParse({ ...hubBase, inventory: { kerosene: 999999 } }).success).toBe(true);
  });

  it('rejects a product whose low-stock threshold exceeds tank capacity', () => {
    const r = productSchema.safeParse({ key: 'diesel', name: 'Diesel', unit: 'L', lowStockThreshold: 25000, tankCapacity: 20000 });
    expect(r.success).toBe(false);
  });
  it('accepts a sensible product', () => {
    expect(productSchema.safeParse({ key: 'diesel', name: 'Diesel', unit: 'L', lowStockThreshold: 5000, tankCapacity: 20000 }).success).toBe(true);
  });
});
