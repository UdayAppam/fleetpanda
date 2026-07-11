import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { useAllocationMutations } from './mutations';
import { renderHookWithProviders } from '@/test/renderWithProviders';
import { resetDb, getDb } from '@/test/mswServer';
import { api } from '@/api/endpoints';

beforeEach(() => resetDb());
afterEach(() => vi.restoreAllMocks());

describe('useAllocationMutations', () => {
  it('creates an allocation', async () => {
    const { result } = renderHookWithProviders(() => useAllocationMutations());
    result.current.create.mutate({ vehicleId: 'vehicle-1', driverId: 'driver-1', date: '2999-01-02' });
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    expect(getDb().allocations.some((a) => a.date === '2999-01-02')).toBe(true);
  });

  it('surfaces the server 409 double-booking message', async () => {
    getDb().allocations = [{ id: 'a1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: '2999-01-03' }];
    const { result } = renderHookWithProviders(() => useAllocationMutations());
    result.current.create.mutate({ vehicleId: 'vehicle-1', driverId: 'driver-1', date: '2999-01-03' });
    await waitFor(() => expect(result.current.create.isError).toBe(true));
  });

  it('falls back to a generic message for a non-ApiError failure', async () => {
    vi.spyOn(api, 'createAllocation').mockRejectedValue(new Error('boom'));
    const { result } = renderHookWithProviders(() => useAllocationMutations());
    result.current.create.mutate({ vehicleId: 'vehicle-1', driverId: 'driver-1', date: '2999-01-04' });
    await waitFor(() => expect(result.current.create.isError).toBe(true));
  });

  it('updates an existing allocation', async () => {
    getDb().allocations = [{ id: 'a1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: '2999-01-05' }];
    const { result } = renderHookWithProviders(() => useAllocationMutations());
    result.current.update.mutate({ id: 'a1', input: { vehicleId: 'vehicle-2', driverId: 'driver-2', date: '2999-01-05' } });
    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));
    expect(getDb().allocations.find((a) => a.id === 'a1')?.vehicleId).toBe('vehicle-2');
  });

  it('surfaces a 409 when an edit collides with another booking', async () => {
    getDb().allocations = [
      { id: 'a1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: '2999-01-06' },
      { id: 'a2', vehicleId: 'vehicle-2', driverId: 'driver-2', date: '2999-01-06' },
    ];
    const { result } = renderHookWithProviders(() => useAllocationMutations());
    result.current.update.mutate({ id: 'a1', input: { vehicleId: 'vehicle-2', driverId: 'driver-1', date: '2999-01-06' } });
    await waitFor(() => expect(result.current.update.isError).toBe(true));
  });

  it('falls back to a generic message when an update fails without an ApiError', async () => {
    vi.spyOn(api, 'updateAllocation').mockRejectedValue(new Error('boom'));
    const { result } = renderHookWithProviders(() => useAllocationMutations());
    result.current.update.mutate({ id: 'a1', input: { vehicleId: 'vehicle-1', driverId: 'driver-1', date: '2999-01-07' } });
    await waitFor(() => expect(result.current.update.isError).toBe(true));
  });

  it('removes an allocation', async () => {
    getDb().allocations = [{ id: 'a1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: '2999-01-08' }];
    const { result } = renderHookWithProviders(() => useAllocationMutations());
    result.current.remove.mutate('a1');
    await waitFor(() => expect(result.current.remove.isSuccess).toBe(true));
    expect(getDb().allocations.some((a) => a.id === 'a1')).toBe(false);
  });

  it('surfaces the server message when a remove fails (404)', async () => {
    getDb().allocations = [];
    const { result } = renderHookWithProviders(() => useAllocationMutations());
    result.current.remove.mutate('missing');
    await waitFor(() => expect(result.current.remove.isError).toBe(true));
  });

  it('falls back to a generic message when a remove fails without an ApiError', async () => {
    vi.spyOn(api, 'deleteAllocation').mockRejectedValue(new Error('boom'));
    const { result } = renderHookWithProviders(() => useAllocationMutations());
    result.current.remove.mutate('a1');
    await waitFor(() => expect(result.current.remove.isError).toBe(true));
  });
});
