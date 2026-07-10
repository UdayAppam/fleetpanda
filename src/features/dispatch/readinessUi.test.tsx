import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readinessGroup, ReadinessPill, ctaFor } from './readinessUi';
import type { Readiness } from '@/services/rules';
import type { Order } from '@/types';

const order: Order = {
  id: 'order-1',
  sourceId: 'hub-1',
  destinationId: 'hub-2',
  product: 'diesel',
  quantity: 5000,
  deliveryDate: '2025-11-24',
  assignedDriverId: 'driver-1',
  status: 'assigned',
};

describe('readinessGroup', () => {
  it('maps each readiness state to its display group', () => {
    expect(readinessGroup('ready')).toBe('ready');
    expect(readinessGroup('in_transit')).toBe('in_transit');
    expect(readinessGroup('blocked_stock')).toBe('blocked');
    expect(readinessGroup('blocked_capacity')).toBe('blocked');
    expect(readinessGroup('needs_driver')).toBe('needs');
    expect(readinessGroup('needs_vehicle')).toBe('needs');
    expect(readinessGroup('done')).toBe('done');
  });
});

describe('ReadinessPill', () => {
  it('renders the label for an actionable readiness', () => {
    const readiness: Readiness = {
      state: 'needs_driver',
      label: 'Needs driver',
      tone: 'warn',
      actionable: true,
      action: 'assign_driver',
    };
    render(<ReadinessPill readiness={readiness} />);
    expect(screen.getByText('Needs driver')).toBeInTheDocument();
  });

  it('renders nothing for a done readiness', () => {
    const readiness: Readiness = {
      state: 'done',
      label: 'Delivered',
      tone: 'ok',
      actionable: false,
      action: 'monitor',
    };
    const { container } = render(<ReadinessPill readiness={readiness} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ctaFor', () => {
  it('links assign_driver to the pending orders view', () => {
    expect(ctaFor(order, 'assign_driver')).toEqual({
      label: 'Assign driver',
      to: '/admin/orders?status=pending',
    });
  });

  it('carries driver/date state for allocation actions', () => {
    expect(ctaFor(order, 'allocate_vehicle')).toEqual({
      label: 'Allocate vehicle',
      to: '/admin/allocation',
      state: { driverId: 'driver-1', date: '2025-11-24' },
    });
    expect(ctaFor(order, 'reallocate')?.label).toBe('Reallocate');
  });

  it('links review_stock and monitor to their views', () => {
    expect(ctaFor(order, 'review_stock')).toEqual({ label: 'Review stock', to: '/admin/inventory' });
    expect(ctaFor(order, 'monitor')).toEqual({ label: 'View on map', to: '/admin/map' });
  });
});
