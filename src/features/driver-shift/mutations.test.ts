import { describe, it, expect, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { useShiftMutations } from './mutations';
import { renderHookWithProviders } from '@/test/renderWithProviders';
import { resetDb, getDb } from '@/test/mswServer';

beforeEach(() => resetDb());

describe('useShiftMutations', () => {
  it('starts a shift and records the active shift id in redux', async () => {
    const { result, store } = renderHookWithProviders(() => useShiftMutations());
    result.current.start.mutate({ driverId: 'driver-1', date: '2025-11-24' });
    await waitFor(() => expect(result.current.start.isSuccess).toBe(true));
    expect(store.getState().shift.activeShiftId).toBe('shift-1');
  });

  it('ends a shift and clears the active shift id', async () => {
    getDb().shifts = [{ id: 'shift-1', driverId: 'driver-1', vehicleId: 'vehicle-1', date: '2025-11-24', status: 'active', startedAt: '', endedAt: null, orderIds: [] }];
    const { result, store } = renderHookWithProviders(() => useShiftMutations());
    result.current.end.mutate('shift-1');
    await waitFor(() => expect(result.current.end.isSuccess).toBe(true));
    expect(store.getState().shift.activeShiftId).toBeNull();
  });

  it('completes a delivery', async () => {
    getDb().orders = [{ id: 'order-1', sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 5000, deliveryDate: '2025-11-24', assignedDriverId: 'driver-1', status: 'in_transit' }];
    const { result } = renderHookWithProviders(() => useShiftMutations());
    result.current.complete.mutate('order-1');
    await waitFor(() => expect(result.current.complete.isSuccess).toBe(true));
  });

  it('marks a delivery failed', async () => {
    getDb().orders = [{ id: 'order-1', sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 5000, deliveryDate: '2025-11-24', assignedDriverId: 'driver-1', status: 'in_transit' }];
    const { result } = renderHookWithProviders(() => useShiftMutations());
    result.current.fail.mutate({ orderId: 'order-1', reason: 'Site closed' });
    await waitFor(() => expect(result.current.fail.isSuccess).toBe(true));
  });

  it('surfaces the server error when starting without an allocation', async () => {
    getDb().allocations = [];
    const { result } = renderHookWithProviders(() => useShiftMutations());
    result.current.start.mutate({ driverId: 'driver-1', date: '2025-11-24' });
    await waitFor(() => expect(result.current.start.isError).toBe(true));
  });
});
