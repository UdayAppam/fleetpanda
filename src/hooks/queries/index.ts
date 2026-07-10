import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { POSITION_REFRESH_MS } from '@/config/env';
import { useAppSelector } from '@/app/store';
import { selectMapFilters } from '@/store/slices/mapFiltersSlice';
import { qk } from './keys';

export const useHubs = () => useQuery({ queryKey: qk.hubs, queryFn: api.hubs.list });
export const useProducts = () => useQuery({ queryKey: qk.products, queryFn: api.products.list });
export const useDrivers = () => useQuery({ queryKey: qk.drivers, queryFn: api.drivers.list });
export const useVehicles = () => useQuery({ queryKey: qk.vehicles, queryFn: api.vehicles.list });
export const useOrders = () => useQuery({ queryKey: qk.orders, queryFn: api.orders.list });
export const useAllocations = () =>
  useQuery({ queryKey: qk.allocations, queryFn: api.allocations });
export const useShifts = () => useQuery({ queryKey: qk.shifts, queryFn: api.shifts });

// The 30s auto-refresh is scoped ONLY to positions, and only when enabled.
export const usePositions = () => {
  const { autoRefresh } = useAppSelector(selectMapFilters);
  return useQuery({
    queryKey: qk.positions,
    queryFn: api.positions,
    refetchInterval: autoRefresh ? POSITION_REFRESH_MS : false,
  });
};
