import { useMemo } from 'react';
import { useOrders, useAllocations, useShifts } from '@/hooks/queries';
import { useLookups } from '@/hooks/useLookups';
import { useAuth } from '@/contexts/AuthContext';
import { startShiftReadiness } from '@/services/rules';
import { today } from '@/utils/clock';
import type { Order, Shift } from '@/types';

export function useDriverDay() {
  const { user } = useAuth();
  const driverId = user?.driverId ?? '';
  const orders = useOrders();
  const allocations = useAllocations();
  const shifts = useShifts();
  const { hub, vehicle } = useLookups();
  const iso = today();

  const allocation = (allocations.data ?? []).find((a) => a.driverId === driverId && a.date === iso);
  const todaysOrders = useMemo<Order[]>(
    () => (orders.data ?? []).filter((o) => o.assignedDriverId === driverId && o.deliveryDate === iso),
    [orders.data, driverId, iso],
  );
  const activeShift = (shifts.data ?? []).find(
    (s: Shift) => s.driverId === driverId && s.date === iso && s.status === 'active',
  );

  const hubInventory = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    hub.forEach((h) => (map[h.id] = h.inventory));
    return map;
  }, [hub]);

  const readiness = startShiftReadiness(
    Boolean(allocation),
    todaysOrders.filter((o) => o.status === 'assigned'),
    hubInventory,
    (id) => hub.get(id)?.name ?? id,
  );

  return {
    driverId,
    allocation,
    allocatedVehicle: allocation ? vehicle.get(allocation.vehicleId) : undefined,
    orders: todaysOrders,
    activeShift,
    readiness,
    hub,
    isLoading: orders.isLoading || allocations.isLoading || shifts.isLoading,
    error: orders.error ?? allocations.error ?? shifts.error,
    refetch: () => {
      orders.refetch();
      shifts.refetch();
    },
  };
}
