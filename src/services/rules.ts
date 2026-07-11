import type { Allocation, Order, Product, StockLevel, VehicleMapStatus } from '@/types';

// Single stock-level rule — used by gauge, badge, and inventory row stripe.
export function stockLevel(qty: number, threshold: number): StockLevel {
  if (qty < threshold) return 'crit';
  if (qty < threshold * 1.5) return 'warn';
  return 'ok';
}

export function gaugeFill(qty: number, product: Pick<Product, 'tankCapacity'>): number {
  if (!product.tankCapacity) return 0;
  return Math.max(0, Math.min(1, qty / product.tankCapacity));
}

// Client-side double-booking pre-check (server enforces the authoritative 409).
export function hasAllocationConflict(
  allocations: Allocation[],
  vehicleId: string,
  date: string,
  excludeId?: string, // ignore this allocation (when editing it)
): boolean {
  return allocations.some((a) => a.id !== excludeId && a.vehicleId === vehicleId && a.date === date);
}

// Derive a vehicle's map status from its driver's orders (tooltip + filter agree).
export function vehicleMapStatus(driverOrders: Order[]): VehicleMapStatus {
  if (driverOrders.some((o) => o.status === 'in_transit')) return 'in_transit';
  if (driverOrders.some((o) => o.status === 'assigned')) return 'loading';
  return 'idle';
}

// --- Operational checks that surface realistic problems to the dispatcher ----------

export interface OrderStockCheck {
  available: number;
  sufficient: boolean;
  shortBy: number;
  level: StockLevel;
}

/** Does the SOURCE hub currently hold enough product for this order quantity? */
export function orderStockCheck(available: number, quantity: number, threshold = 0): OrderStockCheck {
  return {
    available,
    sufficient: available >= quantity,
    shortBy: Math.max(0, quantity - available),
    level: threshold ? stockLevel(available - quantity, threshold) : available >= quantity ? 'ok' : 'crit',
  };
}

// --- Dispatch readiness: the single "what needs doing" classifier -----------------
// One order → exactly one state. The dashboard, the orders table, and the allocation
// step all read this, so they can never disagree.

export type ReadinessState =
  | 'done'
  | 'in_transit'
  | 'ready'
  | 'needs_driver'
  | 'needs_vehicle'
  | 'blocked_capacity'
  | 'blocked_stock';

export type ReadinessAction =
  | 'assign_driver'
  | 'allocate_vehicle'
  | 'reallocate'
  | 'review_stock'
  | 'monitor';

export interface Readiness {
  state: ReadinessState;
  label: string;
  tone: 'ok' | 'warn' | 'crit' | 'info' | 'neutral';
  actionable: boolean;
  action: ReadinessAction;
  detail?: string;
}

export interface ReadinessCtx {
  /** Capacity of the vehicle allocated to this order's driver on the delivery date; null = none allocated. */
  vehicleCapacity: number | null;
  /** Total live load (L) of that driver's active orders on the date, including this one. */
  driverDayLoad: number;
  /** Current stock of this order's product at its source hub. */
  sourceStock: number;
}

export function orderReadiness(order: Order, ctx: ReadinessCtx): Readiness {
  if (order.status === 'delivered')
    return { state: 'done', label: 'Delivered', tone: 'ok', actionable: false, action: 'monitor' };
  if (order.status === 'failed')
    return { state: 'done', label: 'Failed', tone: 'crit', actionable: false, action: 'monitor' };
  if (order.status === 'in_transit')
    return { state: 'in_transit', label: 'In transit', tone: 'info', actionable: false, action: 'monitor' };

  if (!order.assignedDriverId)
    return { state: 'needs_driver', label: 'Needs driver', tone: 'warn', actionable: true, action: 'assign_driver' };
  if (ctx.vehicleCapacity == null)
    return { state: 'needs_vehicle', label: 'Needs vehicle', tone: 'warn', actionable: true, action: 'allocate_vehicle' };
  if (ctx.driverDayLoad > ctx.vehicleCapacity)
    return {
      state: 'blocked_capacity',
      label: 'Over capacity',
      tone: 'crit',
      actionable: true,
      action: 'reallocate',
      detail: `Day load ${ctx.driverDayLoad.toLocaleString()} L exceeds vehicle ${ctx.vehicleCapacity.toLocaleString()} L`,
    };
  if (ctx.sourceStock < order.quantity)
    return {
      state: 'blocked_stock',
      label: 'Stock short',
      tone: 'crit',
      actionable: true,
      action: 'review_stock',
      detail: `Source short by ${(order.quantity - ctx.sourceStock).toLocaleString()} L`,
    };
  return { state: 'ready', label: 'Ready', tone: 'ok', actionable: false, action: 'monitor' };
}

// Priority for the dashboard "what needs you" list (higher = more urgent).
export const READINESS_PRIORITY: Record<ReadinessState, number> = {
  blocked_stock: 5,
  blocked_capacity: 5,
  needs_driver: 3,
  needs_vehicle: 3,
  ready: 1,
  in_transit: 0,
  done: 0,
};

export interface StartShiftReadiness {
  ready: boolean;
  reason?: string;
}

// Can a driver start today's shift? (allocation exists + no source hub goes negative)
export function startShiftReadiness(
  hasAllocation: boolean,
  orders: Order[],
  hubInventory: Record<string, Record<string, number>>,
  hubName: (id: string) => string,
): StartShiftReadiness {
  if (!hasAllocation) return { ready: false, reason: 'No vehicle allocated for today' };
  if (orders.length === 0) return { ready: false, reason: 'No deliveries assigned for today' };
  for (const o of orders) {
    const have = hubInventory[o.sourceId]?.[o.product] ?? 0;
    if (have < o.quantity) {
      return {
        ready: false,
        reason: `${hubName(o.sourceId)} has ${have.toLocaleString()} ${o.product}, order needs ${o.quantity.toLocaleString()}`,
      };
    }
  }
  return { ready: true };
}
