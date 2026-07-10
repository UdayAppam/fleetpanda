import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { VehicleMapStatus } from '@/types';

interface MapFiltersState {
  driverId: string | null;
  vehicleId: string | null;
  status: VehicleMapStatus | null;
  autoRefresh: boolean;
}
const initialState: MapFiltersState = {
  driverId: null,
  vehicleId: null,
  status: null,
  autoRefresh: true,
};

const mapFiltersSlice = createSlice({
  name: 'mapFilters',
  initialState,
  reducers: {
    setMapFilter: (state, action: PayloadAction<Partial<MapFiltersState>>) =>
      Object.assign(state, action.payload),
    resetMapFilters: (state) => {
      state.driverId = null;
      state.vehicleId = null;
      state.status = null;
    },
    toggleAutoRefresh: (state) => {
      state.autoRefresh = !state.autoRefresh;
    },
  },
});

export const { setMapFilter, resetMapFilters, toggleAutoRefresh } = mapFiltersSlice.actions;
export default mapFiltersSlice.reducer;
export const selectMapFilters = (s: { mapFilters: MapFiltersState }) => s.mapFilters;
