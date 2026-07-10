import { useMemo } from 'react';
import { useOrders, useAllocations } from '@/hooks/queries';
import { useLookups } from '@/hooks/useLookups';
import { driverDayPlan, type DayPlan } from '@/services/logistics';
import type { Order } from '@/types';

const ACTIVE = (o: Order) => o.status !== 'delivered' && o.status !== 'failed';

export interface ShiftAdvisory {
  driverId: string;
  driverName: string;
  vehicleReg: string;
  date: string;
  plan: DayPlan;
  kind: 'overbooked' | 'underutilised';
}

/**
 * Driver-DAY feasibility advisories (not per-order): a driver whose day of deliveries won't
 * fit the shift window (overbooked) or wastes the tanker (under-utilised). Warn-level.
 */
export function useShiftAdvisories(date: string) {
  const orders = useOrders();
  const allocations = useAllocations();
  const { hub, vehicle, driver } = useLookups();

  return useMemo(() => {
    const coordOf = (id: string) => hub.get(id)?.coordinates;
    const advisories: ShiftAdvisory[] = [];

    (allocations.data ?? [])
      .filter((a) => a.date === date)
      .forEach((a) => {
        const dOrders = (orders.data ?? []).filter(
          (o) => o.assignedDriverId === a.driverId && o.deliveryDate === date && ACTIVE(o),
        );
        if (dOrders.length === 0) return;
        const v = vehicle.get(a.vehicleId);
        const plan = driverDayPlan(dOrders, coordOf, v?.capacity ?? null);
        const meta = {
          driverId: a.driverId,
          driverName: driver.get(a.driverId)?.name ?? a.driverId,
          vehicleReg: v?.registration ?? a.vehicleId,
          date,
          plan,
        };
        if (!plan.feasible) advisories.push({ ...meta, kind: 'overbooked' });
        else if (plan.underutilised) advisories.push({ ...meta, kind: 'underutilised' });
      });

    return { advisories };
  }, [orders.data, allocations.data, date, hub, vehicle, driver]);
}
