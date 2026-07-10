import { useMemo } from 'react';
import { usePositions, useOrders } from '@/hooks/queries';
import { useLookups } from '@/hooks/useLookups';
import { useAppSelector } from '@/app/store';
import { selectMapFilters } from '@/store/slices/mapFiltersSlice';
import { vehicleMapStatus } from '@/services/rules';
import type { VehicleMapStatus, VehiclePosition } from '@/types';

export interface FleetVehicle {
  position: VehiclePosition;
  vehicleReg: string;
  driverName: string;
  status: VehicleMapStatus;
  currentOrderId?: string;
  destName?: string;
  destCoord?: { lat: number; lng: number };
  sourceName?: string;
  sourceCoord?: { lat: number; lng: number };
  product?: string;
  quantity?: number;
}

export function useFleetData() {
  const positions = usePositions();
  const orders = useOrders();
  const { vehicle, driver, hub } = useLookups();
  const filters = useAppSelector(selectMapFilters);

  const all = useMemo<FleetVehicle[]>(() => {
    return (positions.data ?? []).map((p) => {
      const driverOrders = (orders.data ?? []).filter((o) => o.assignedDriverId === p.driverId);
      const status = vehicleMapStatus(driverOrders);
      const current = driverOrders.find((o) => o.status === 'in_transit');
      const dest = current ? hub.get(current.destinationId) : undefined;
      const src = current ? hub.get(current.sourceId) : undefined;
      return {
        position: p,
        vehicleReg: vehicle.get(p.vehicleId)?.registration ?? p.vehicleId,
        driverName: driver.get(p.driverId)?.name ?? p.driverId,
        status,
        currentOrderId: current?.id,
        destName: dest?.name,
        destCoord: dest?.coordinates,
        sourceName: src?.name,
        sourceCoord: src?.coordinates,
        product: current?.product,
        quantity: current?.quantity,
      };
    });
  }, [positions.data, orders.data, vehicle, driver, hub]);

  const filtered = all.filter((v) => {
    if (filters.driverId && v.position.driverId !== filters.driverId) return false;
    if (filters.vehicleId && v.position.vehicleId !== filters.vehicleId) return false;
    if (filters.status && v.status !== filters.status) return false;
    return true;
  });

  return {
    all,
    filtered,
    isLoading: positions.isLoading || orders.isLoading,
    error: positions.error,
    refetch: positions.refetch,
    isFetching: positions.isFetching,
    dataUpdatedAt: positions.dataUpdatedAt,
  };
}
