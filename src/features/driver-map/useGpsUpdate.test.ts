import { describe, it, expect, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { useGpsUpdate } from './useGpsUpdate';
import { renderHookWithProviders } from '@/test/renderWithProviders';
import { resetDb, getDb } from '@/test/mswServer';
import type { VehiclePosition } from '@/types';

beforeEach(() => resetDb());

const position: VehiclePosition = {
  id: 'pos-1', vehicleId: 'vehicle-1', driverId: 'driver-1', lat: 40, lng: -74, updatedAt: '', status: 'idle', trail: [],
};

describe('useGpsUpdate', () => {
  it('advances the position along the route and appends to the trail', async () => {
    const { result } = renderHookWithProviders(() => useGpsUpdate());
    result.current.mutate({
      position,
      source: { lat: 40, lng: -74 },
      dest: { lat: 40.7, lng: -73.9 },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const saved = getDb().vehiclePositions.find((p) => p.id === 'pos-1');
    expect(saved?.status).toBe('in_transit');
    expect(saved?.trail?.length).toBe(1); // the previous point becomes a breadcrumb
  });

  it('starts a fresh trail when the position has none', async () => {
    const { trail: _drop, ...noTrail } = position;
    const { result } = renderHookWithProviders(() => useGpsUpdate());
    result.current.mutate({
      position: noTrail,
      source: { lat: 40, lng: -74 },
      dest: { lat: 40.7, lng: -73.9 },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const saved = getDb().vehiclePositions.find((p) => p.id === 'pos-1');
    expect(saved?.trail?.length).toBe(1); // seeded from an undefined trail
  });

  it('reports an error when the position does not exist', async () => {
    const { result } = renderHookWithProviders(() => useGpsUpdate());
    result.current.mutate({
      position: { ...position, id: 'ghost' },
      source: { lat: 40, lng: -74 },
      dest: { lat: 41, lng: -73 },
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
