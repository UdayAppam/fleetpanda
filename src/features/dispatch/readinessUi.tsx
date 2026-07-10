import { Badge } from '@/components/ui/Badge';
import type { Order } from '@/types';
import type { Readiness, ReadinessAction, ReadinessState } from '@/services/rules';

export type ReadinessGroup = 'ready' | 'in_transit' | 'needs' | 'blocked' | 'done';
export const READINESS_GROUP_LABEL: Record<Exclude<ReadinessGroup, 'done'>, string> = {
  ready: 'Ready',
  in_transit: 'In transit',
  needs: 'Need action',
  blocked: 'Blocked',
};

export function readinessGroup(state: ReadinessState): ReadinessGroup {
  if (state === 'ready') return 'ready';
  if (state === 'in_transit') return 'in_transit';
  if (state.startsWith('blocked')) return 'blocked';
  if (state === 'needs_driver' || state === 'needs_vehicle') return 'needs';
  return 'done';
}

export function ReadinessPill({ readiness }: { readiness: Readiness }) {
  if (readiness.state === 'done') return null;
  return (
    <Badge tone={readiness.tone} title={readiness.detail}>
      {readiness.label}
    </Badge>
  );
}

export interface Cta {
  label: string;
  to: string;
  state?: { driverId?: string | null; date?: string };
}

// Maps a readiness action to a deep link that pre-loads the fix.
export function ctaFor(order: Order, action: ReadinessAction): Cta | null {
  switch (action) {
    case 'assign_driver':
      return { label: 'Assign driver', to: '/admin/orders?status=pending' };
    case 'allocate_vehicle':
    case 'reallocate':
      return {
        label: action === 'reallocate' ? 'Reallocate' : 'Allocate vehicle',
        to: '/admin/allocation',
        state: { driverId: order.assignedDriverId, date: order.deliveryDate },
      };
    case 'review_stock':
      return { label: 'Review stock', to: '/admin/inventory' };
    case 'monitor':
      return { label: 'View on map', to: '/admin/map' };
    default:
      return null;
  }
}
