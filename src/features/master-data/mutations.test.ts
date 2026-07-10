import { describe, it, expect, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { useEntityMutations } from './mutations';
import { renderHookWithProviders } from '@/test/renderWithProviders';
import { resetDb, getDb } from '@/test/mswServer';

beforeEach(() => resetDb());

describe('useEntityMutations', () => {
  it('creates, updates and removes for each resource label', async () => {
    const { result } = renderHookWithProviders(() => useEntityMutations('drivers'));

    result.current.create.mutate({ name: 'New', license: 'DL-9', phone: '+9', status: 'available' });
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));

    result.current.update.mutate({ id: 'driver-1', body: { name: 'Renamed' } });
    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));

    result.current.remove.mutate('driver-1');
    await waitFor(() => expect(result.current.remove.isSuccess).toBe(true));
    expect(getDb().drivers.find((d) => d.id === 'driver-1')).toBeUndefined();
  });

  it('works for the hubs (locations) resource', async () => {
    const { result } = renderHookWithProviders(() => useEntityMutations('hubs'));
    result.current.create.mutate({ name: 'Depot', locationType: 'hub', address: 'a', coordinates: { lat: 1, lng: 2 }, inventory: {} });
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
  });

  it('reports an error when updating a missing record', async () => {
    const { result } = renderHookWithProviders(() => useEntityMutations('vehicles'));
    result.current.update.mutate({ id: 'nope', body: { type: 'x' } });
    await waitFor(() => expect(result.current.update.isError).toBe(true));
  });
});
