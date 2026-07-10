import { describe, it, expect, beforeEach } from 'vitest';
import { api } from './endpoints';
import { ApiError } from './httpClient';
import { resetDb } from '@/test/mswServer';

// Integration tests for the critical business flows, against MSW handlers that mirror
// the real server's rules (single-writer side-effects, idempotency, guards).
beforeEach(() => resetDb());

describe('auth', () => {
  it('logs in with valid credentials', async () => {
    const { user } = await api.login('driver@fleetpanda.com', 'driver123');
    expect(user.role).toBe('driver');
    expect(user.driverId).toBe('driver-1');
  });
  it('rejects bad credentials with 401', async () => {
    await expect(api.login('driver@fleetpanda.com', 'nope')).rejects.toMatchObject({ status: 401 });
  });
});

describe('allocation double-booking', () => {
  it('blocks a second allocation of the same vehicle+date with 409', async () => {
    // a first (future-dated) allocation succeeds…
    await api.createAllocation({ vehicleId: 'vehicle-1', driverId: 'driver-1', date: '2999-11-24' });
    // …the same vehicle+date again is rejected (past-date guard is checked separately below)
    await expect(
      api.createAllocation({ vehicleId: 'vehicle-1', driverId: 'driver-1', date: '2999-11-24' }),
    ).rejects.toSatisfy((e: unknown) => e instanceof ApiError && e.status === 409);
  });
  it('allows a different date', async () => {
    const a = await api.createAllocation({ vehicleId: 'vehicle-1', driverId: 'driver-1', date: '2999-11-30' });
    expect(a.id).toBeTruthy();
  });
  it('rejects an allocation in the past with 422', async () => {
    await expect(
      api.createAllocation({ vehicleId: 'vehicle-1', driverId: 'driver-1', date: '2000-01-01' }),
    ).rejects.toSatisfy((e: unknown) => e instanceof ApiError && e.status === 422);
  });
});

describe('order edit / delete (reusable order flow)', () => {
  it('updates an editable order', async () => {
    const updated = await api.orders.update('order-1', { quantity: 6500, status: 'assigned' });
    expect(updated.quantity).toBe(6500);
    const list = await api.orders.list();
    expect(list.find((o) => o.id === 'order-1')?.quantity).toBe(6500);
  });
  it('deletes an order', async () => {
    await api.orders.remove('order-1');
    const list = await api.orders.list();
    expect(list.find((o) => o.id === 'order-1')).toBeUndefined();
  });
});

describe('shift + delivery lifecycle', () => {
  it('start decrements source, complete increments destination, double-complete 409', async () => {
    const before = await api.hubs.get('hub-1');
    expect(before.inventory.diesel).toBe(15000);

    const shift = await api.startShift('driver-1', '2025-11-24');
    expect(shift.status).toBe('active');
    expect(shift.orderIds).toContain('order-1');

    const afterStart = await api.hubs.get('hub-1');
    expect(afterStart.inventory.diesel).toBe(10000); // -5000 dispatched

    const res = await api.completeOrder('order-1');
    expect(res.order.status).toBe('delivered');
    expect(res.inventory.delta).toBe(5000);
    expect(res.inventory.total).toBe(14800); // 9800 + 5000

    await expect(api.completeOrder('order-1')).rejects.toMatchObject({ status: 409 });
  });

  it('fail requires a reason (422) then records it', async () => {
    await api.startShift('driver-1', '2025-11-24');
    await expect(api.failOrder('order-1', '')).rejects.toMatchObject({ status: 422 });
    const res = await api.failOrder('order-1', 'Site closed');
    expect(res.order.status).toBe('failed');
    expect(res.order.failureReason).toBe('Site closed');
  });
});
