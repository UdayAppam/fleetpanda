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
});
