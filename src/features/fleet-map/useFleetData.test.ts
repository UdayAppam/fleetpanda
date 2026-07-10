import { describe, it, expect, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { API_URL } from '@/config/env';
import { useFleetData } from './useFleetData';
import { renderHookWithProviders, makeStore } from '@/test/renderWithProviders';
import { resetDb, getDb, server } from '@/test/mswServer';
import { setMapFilter } from '@/store/slices/mapFiltersSlice';

function seedInTransit() {
  const db = getDb();
  db.orders = [
    { id: 'order-1', sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 5000, deliveryDate: '2025-11-24', assignedDriverId: 'driver-1', status: 'in_transit' },
  ];
  db.vehiclePositions = [
    { id: 'pos-1', vehicleId: 'vehicle-1', driverId: 'driver-1', lat: 40, lng: -74, updatedAt: '', status: 'in_transit' },
  ];
}

beforeEach(() => resetDb());

describe('useFleetData', () => {
  it('joins positions with orders and lookups', async () => {
    seedInTransit();
    const { result } = renderHookWithProviders(() => useFleetData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.all).toHaveLength(1);
    const v = result.current.all[0];
    expect(v.vehicleReg).toBe('TRK-101');
    expect(v.driverName).toBe('John');
    expect(v.status).toBe('in_transit');
    expect(v.destName).toBe('Northgate'); // current in-transit order resolves dest/src
    expect(v.sourceName).toBe('Downtown');
  });

  it('falls back to raw ids when lookups are missing and derives loading status', async () => {
    const db = getDb();
    db.vehiclePositions = [
      { id: 'pos-x', vehicleId: 'ghost-v', driverId: 'ghost-d', lat: 1, lng: 2, updatedAt: '', status: 'idle' },
    ];
    db.orders = [];
    const { result } = renderHookWithProviders(() => useFleetData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.all[0].vehicleReg).toBe('ghost-v');
    expect(result.current.all[0].driverName).toBe('ghost-d');
    expect(result.current.all[0].status).toBe('idle');
  });

  it('treats an undefined orders result as no orders', async () => {
    server.use(http.get(`${API_URL}/orders`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    const db = getDb();
    db.vehiclePositions = [
      { id: 'pos-1', vehicleId: 'vehicle-1', driverId: 'driver-1', lat: 40, lng: -74, updatedAt: '', status: 'idle' },
    ];
    const { result } = renderHookWithProviders(() => useFleetData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.all).toHaveLength(1);
    expect(result.current.all[0].status).toBe('idle'); // no orders → idle
  });

  it('applies the redux map filters', async () => {
    seedInTransit();
    const store = makeStore();
    store.dispatch(setMapFilter({ driverId: 'someone-else' }));
    const { result } = renderHookWithProviders(() => useFleetData(), { store });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.all).toHaveLength(1);
    expect(result.current.filtered).toHaveLength(0); // filtered out by driver mismatch
  });
});
