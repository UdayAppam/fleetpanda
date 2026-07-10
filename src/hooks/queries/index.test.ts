import { describe, it, expect, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import {
  useHubs,
  useProducts,
  useDrivers,
  useVehicles,
  useOrders,
  useAllocations,
  useShifts,
  usePositions,
} from './index';
import { renderHookWithProviders, makeStore } from '@/test/renderWithProviders';
import { resetDb } from '@/test/mswServer';
import { toggleAutoRefresh } from '@/store/slices/mapFiltersSlice';

beforeEach(() => resetDb());

describe('query hooks', () => {
  it('each list hook fetches its resource', async () => {
    const cases: [string, () => { data?: unknown[] }][] = [
      ['hubs', useHubs],
      ['products', useProducts],
      ['drivers', useDrivers],
      ['vehicles', useVehicles],
      ['orders', useOrders],
      ['allocations', useAllocations],
      ['shifts', useShifts],
    ];
    for (const [, hook] of cases) {
      const { result } = renderHookWithProviders(() => hook());
      await waitFor(() => expect(result.current.data).toBeDefined());
      expect(Array.isArray(result.current.data)).toBe(true);
    }
  });

  it('usePositions polls when auto-refresh is on', async () => {
    const { result } = renderHookWithProviders(() => usePositions());
    await waitFor(() => expect(result.current.data).toBeDefined());
  });

  it('usePositions disables polling when auto-refresh is off', async () => {
    const store = makeStore();
    store.dispatch(toggleAutoRefresh());
    const { result } = renderHookWithProviders(() => usePositions(), { store });
    await waitFor(() => expect(result.current.data).toBeDefined());
  });
});
