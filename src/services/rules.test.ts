import { describe, it, expect } from 'vitest';
import {
  stockLevel,
  gaugeFill,
  hasAllocationConflict,
  vehicleMapStatus,
  startShiftReadiness,
  orderStockCheck,
  orderReadiness,
} from './rules';
import type { Allocation, Order } from '@/types';

describe('stockLevel', () => {
  it('is crit below threshold', () => expect(stockLevel(4000, 5000)).toBe('crit'));
  it('is warn below 1.5x threshold', () => expect(stockLevel(6000, 5000)).toBe('warn'));
  it('is ok at/above 1.5x threshold', () => expect(stockLevel(7500, 5000)).toBe('ok'));
});

describe('gaugeFill', () => {
  it('is qty / capacity clamped to [0,1]', () => {
    expect(gaugeFill(5000, { tankCapacity: 20000 })).toBe(0.25);
    expect(gaugeFill(30000, { tankCapacity: 20000 })).toBe(1);
  });
  it('is 0 when the product has no tank capacity', () => {
    expect(gaugeFill(5000, { tankCapacity: 0 })).toBe(0);
  });
});

describe('hasAllocationConflict', () => {
  const allocs: Allocation[] = [{ id: 'a', vehicleId: 'v1', driverId: 'd1', date: '2025-11-24' }];
  it('detects same vehicle+date', () => expect(hasAllocationConflict(allocs, 'v1', '2025-11-24')).toBe(true));
  it('allows different date', () => expect(hasAllocationConflict(allocs, 'v1', '2025-11-25')).toBe(false));
});

describe('vehicleMapStatus', () => {
  const mk = (status: Order['status']): Order => ({
    id: 'o', sourceId: 's', destinationId: 'd', product: 'diesel', quantity: 1,
    deliveryDate: '2025-11-24', assignedDriverId: 'd1', status,
  });
  it('in_transit wins', () => expect(vehicleMapStatus([mk('assigned'), mk('in_transit')])).toBe('in_transit'));
  it('assigned → loading', () => expect(vehicleMapStatus([mk('assigned')])).toBe('loading'));
  it('none → idle', () => expect(vehicleMapStatus([mk('delivered')])).toBe('idle'));
});

describe('startShiftReadiness', () => {
  const order: Order = {
    id: 'o1', sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel',
    quantity: 5000, deliveryDate: '2025-11-24', assignedDriverId: 'd1', status: 'assigned',
  };
  const name = () => 'Downtown';
  it('blocks without allocation', () =>
    expect(startShiftReadiness(false, [order], { 'hub-1': { diesel: 9999 } }, name).ready).toBe(false));
  it('blocks with no orders', () =>
    expect(startShiftReadiness(true, [], {}, name).ready).toBe(false));
  it('blocks on insufficient stock with a reason', () => {
    const r = startShiftReadiness(true, [order], { 'hub-1': { diesel: 3000 } }, name);
    expect(r.ready).toBe(false);
    expect(r.reason).toMatch(/needs/);
  });
  it('is ready when stock covers orders', () =>
    expect(startShiftReadiness(true, [order], { 'hub-1': { diesel: 8000 } }, name).ready).toBe(true));
  it('treats a missing source hub as zero stock', () => {
    const r = startShiftReadiness(true, [order], {}, name);
    expect(r.ready).toBe(false);
    expect(r.reason).toMatch(/has 0/);
  });
});

describe('orderStockCheck', () => {
  it('flags insufficient source stock with a shortfall', () => {
    const r = orderStockCheck(3000, 5000);
    expect(r.sufficient).toBe(false);
    expect(r.shortBy).toBe(2000);
  });
  it('passes when source covers the order', () => {
    const r = orderStockCheck(9000, 5000);
    expect(r.sufficient).toBe(true);
    expect(r.shortBy).toBe(0);
  });
  it('derives the post-order level when a threshold is supplied', () => {
    // available - quantity = 1000, below the 5000 threshold → crit
    expect(orderStockCheck(6000, 5000, 5000).level).toBe('crit');
    // plenty left over → ok
    expect(orderStockCheck(30000, 5000, 5000).level).toBe('ok');
  });
});

describe('orderReadiness', () => {
  const base: Order = {
    id: 'order-1', sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel',
    quantity: 5000, deliveryDate: '2025-11-24', assignedDriverId: 'driver-1', status: 'assigned',
  };
  const ok = { vehicleCapacity: 8000, driverDayLoad: 5000, sourceStock: 9000 };

  it('is done for terminal orders', () => {
    expect(orderReadiness({ ...base, status: 'delivered' }, ok).state).toBe('done');
    expect(orderReadiness({ ...base, status: 'failed' }, ok).tone).toBe('crit');
  });
  it('is in_transit while dispatched', () =>
    expect(orderReadiness({ ...base, status: 'in_transit' }, ok).state).toBe('in_transit'));
  it('needs a driver when unassigned', () =>
    expect(orderReadiness({ ...base, assignedDriverId: null }, ok).state).toBe('needs_driver'));
  it('needs a vehicle when none allocated', () =>
    expect(orderReadiness(base, { ...ok, vehicleCapacity: null }).state).toBe('needs_vehicle'));
  it('is blocked_capacity when day load exceeds the vehicle', () =>
    expect(orderReadiness(base, { ...ok, driverDayLoad: 9000 }).state).toBe('blocked_capacity'));
  it('is blocked_stock when source cannot cover the order', () =>
    expect(orderReadiness(base, { ...ok, sourceStock: 3000 }).state).toBe('blocked_stock'));
  it('is ready when driver, vehicle, capacity and stock all check out', () =>
    expect(orderReadiness(base, ok).state).toBe('ready'));
  it('prioritises capacity/stock blocks over needs when both could apply', () => {
    // has driver + vehicle but overloaded → blocked, not "needs"
    const r = orderReadiness(base, { vehicleCapacity: 4000, driverDayLoad: 5000, sourceStock: 9000 });
    expect(r.state).toBe('blocked_capacity');
    expect(r.actionable).toBe(true);
  });
});
