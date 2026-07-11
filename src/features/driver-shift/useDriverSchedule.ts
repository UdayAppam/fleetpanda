import { useMemo } from 'react';
import { useOrders, useAllocations } from '@/hooks/queries';
import { useLookups } from '@/hooks/useLookups';
import { useAuth } from '@/contexts/AuthContext';
import type { Hub, Order, Vehicle } from '@/types';

export interface ScheduleDay {
  date: string; // YYYY-MM-DD
  vehicle?: Vehicle; // truck allocated to the driver that day (if any)
  orders: Order[]; // deliveries assigned that day (may be empty on a truck-only day)
  totalQty: number;
  delivered: number;
  failed: number;
}

/** The signed-in driver's day-by-day schedule for a given month (YYYY-MM): each day's
 *  assigned orders plus the truck allocated for that day. */
export function useDriverSchedule(month: string) {
  const { user } = useAuth();
  const driverId = user?.driverId ?? '';
  const orders = useOrders();
  const allocations = useAllocations();
  const { vehicle, hub } = useLookups();

  const days = useMemo<ScheduleDay[]>(() => {
    const inMonth = (d: string) => d.slice(0, 7) === month;
    const byDate = new Map<string, Order[]>();
    (orders.data ?? [])
      .filter((o) => o.assignedDriverId === driverId && inMonth(o.deliveryDate))
      .forEach((o) => {
        const arr = byDate.get(o.deliveryDate) ?? [];
        arr.push(o);
        byDate.set(o.deliveryDate, arr);
      });

    const truckByDate = new Map<string, string>();
    (allocations.data ?? [])
      .filter((a) => a.driverId === driverId && inMonth(a.date))
      .forEach((a) => truckByDate.set(a.date, a.vehicleId));

    // Any day with orders and/or a truck allocation is part of the schedule.
    const dates = new Set<string>([...byDate.keys(), ...truckByDate.keys()]);
    return [...dates]
      .sort((a, b) => a.localeCompare(b))
      .map((date) => {
        const dayOrders = byDate.get(date) ?? [];
        const vId = truckByDate.get(date);
        return {
          date,
          vehicle: vId ? vehicle.get(vId) : undefined,
          orders: dayOrders,
          totalQty: dayOrders.reduce((n, o) => n + o.quantity, 0),
          delivered: dayOrders.filter((o) => o.status === 'delivered').length,
          failed: dayOrders.filter((o) => o.status === 'failed').length,
        };
      });
  }, [orders.data, allocations.data, driverId, month, vehicle]);

  return {
    days,
    hub: hub as Map<string, Hub>,
    isLoading: orders.isLoading || allocations.isLoading,
    error: orders.error ?? allocations.error,
    refetch: () => {
      orders.refetch();
      allocations.refetch();
    },
  };
}
