import { describe, it, expect } from 'vitest';
import reducer, {
  setMapFilter,
  resetMapFilters,
  toggleAutoRefresh,
} from './mapFiltersSlice';

const initial = reducer(undefined, { type: '@@INIT' });

describe('mapFiltersSlice', () => {
  it('sets a partial filter', () => {
    const s = reducer(initial, setMapFilter({ driverId: 'd1', status: 'in_transit' }));
    expect(s.driverId).toBe('d1');
    expect(s.status).toBe('in_transit');
  });
  it('resets selections but keeps autoRefresh', () => {
    const dirty = reducer(initial, setMapFilter({ driverId: 'd1', vehicleId: 'v1' }));
    const s = reducer(dirty, resetMapFilters());
    expect(s.driverId).toBeNull();
    expect(s.vehicleId).toBeNull();
    expect(s.autoRefresh).toBe(true);
  });
  it('toggles autoRefresh', () => {
    const s = reducer(initial, toggleAutoRefresh());
    expect(s.autoRefresh).toBe(false);
  });
});
