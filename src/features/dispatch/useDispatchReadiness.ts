import { useCallback, useMemo } from 'react';
import { useOrders, useAllocations } from '@/hooks/queries';
import { useLookups } from '@/hooks/useLookups';
import { orderReadiness, READINESS_PRIORITY, type Readiness } from '@/services/rules';
import type { Order } from '@/types';

export interface ReadyItem {
  order: Order;
  readiness: Readiness;
}

const ACTIVE = (o: Order) => o.status !== 'delivered' && o.status !== 'failed';

/** Returns a pure `(order) => Readiness` resolver valid for any date (used by the orders table). */
export function useReadinessResolver() {
  const orders = useOrders();
  const allocations = useAllocations();
  const { hub, vehicle } = useLookups();
  const all = orders.data;
  const allocs = allocations.data;

  const resolve = useCallback(
    (order: Order): Readiness => {
      const list = all ?? [];
      const alloc = order.assignedDriverId
        ? (allocs ?? []).find((a) => a.driverId === order.assignedDriverId && a.date === order.deliveryDate)
        : undefined;
      const vehicleCapacity = alloc ? vehicle.get(alloc.vehicleId)?.capacity ?? 0 : null;
      const driverDayLoad = order.assignedDriverId
        ? list
            .filter((o) => o.assignedDriverId === order.assignedDriverId && o.deliveryDate === order.deliveryDate && ACTIVE(o))
            .reduce((n, o) => n + o.quantity, 0)
        : order.quantity;
      const sourceStock = hub.get(order.sourceId)?.inventory[order.product] ?? 0;
      return orderReadiness(order, { vehicleCapacity, driverDayLoad, sourceStock });
    },
    [all, allocs, hub, vehicle],
  );

  return { resolve, isLoading: orders.isLoading || allocations.isLoading };
}

/** Classifies every order on `date` and buckets them — the dashboard action center. */
export function useDispatchReadiness(date: string) {
  const orders = useOrders();
  const { resolve, isLoading } = useReadinessResolver();

  const items = useMemo<ReadyItem[]>(
    () =>
      (orders.data ?? [])
        .filter((o) => o.deliveryDate === date)
        .map((order) => ({ order, readiness: resolve(order) })),
    [orders.data, date, resolve],
  );

  const counts = useMemo(() => {
    const c = { ready: 0, in_transit: 0, needs: 0, blocked: 0, done: 0 };
    items.forEach(({ readiness }) => {
      if (readiness.state === 'ready') c.ready++;
      else if (readiness.state === 'in_transit') c.in_transit++;
      else if (readiness.state === 'done') c.done++;
      else if (readiness.state.startsWith('blocked')) c.blocked++;
      else c.needs++;
    });
    return c;
  }, [items]);

  const actionable = useMemo(
    () =>
      items
        .filter((i) => i.readiness.actionable)
        .sort((a, b) => READINESS_PRIORITY[b.readiness.state] - READINESS_PRIORITY[a.readiness.state]),
    [items],
  );

  return { items, counts, actionable, isLoading, total: items.length };
}
