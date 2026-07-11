import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeliveryManager } from './DeliveryManager';
import { buildTrips } from '@/services/logistics';
import { renderWithProviders } from '@/test/renderWithProviders';
import { resetDb, getDb } from '@/test/mswServer';
import type { Hub, Order } from '@/types';

beforeEach(() => resetDb());

const hub = new Map<string, Hub>([
  ['hub-1', { id: 'hub-1', name: 'Downtown', locationType: 'hub', address: 'x', coordinates: { lat: 40, lng: -74 }, inventory: {} }],
  ['hub-3', { id: 'hub-3', name: 'Northgate', locationType: 'terminal', address: 'y', coordinates: { lat: 40.7, lng: -73.9 }, inventory: {} }],
  ['hub-5', { id: 'hub-5', name: 'Westside', locationType: 'hub', address: 'z', coordinates: { lat: 40.8, lng: -73.8 }, inventory: {} }],
]);
const coordOf = (id: string) => hub.get(id)?.coordinates;
const toTrips = (orders: Order[]) => buildTrips(orders, coordOf);

const makeOrder = (over: Partial<Order> = {}): Order => ({
  id: 'order-1',
  sourceId: 'hub-1',
  destinationId: 'hub-3',
  product: 'diesel',
  quantity: 5000,
  deliveryDate: '2025-11-24',
  assignedDriverId: 'driver-1',
  status: 'in_transit',
  ...over,
});

describe('DeliveryManager', () => {

  it('shows an empty message when there are no orders', () => {
    renderWithProviders(<DeliveryManager trips={[]} hub={hub} active />);
    expect(screen.getByText(/no deliveries assigned/i)).toBeInTheDocument();
  });

  it('renders the load header, quantity and the current tag for the active in-transit order', () => {
    renderWithProviders(<DeliveryManager trips={toTrips([makeOrder()])} hub={hub} active capacity={12000} />);
    expect(screen.getByText(/load at/i)).toBeInTheDocument();
    expect(screen.getByText('Downtown')).toBeInTheDocument(); // pickup shown once, in the load header
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getAllByText('5,000 L').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /mark delivered/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /report failure/i })).toBeInTheDocument();
  });

  it('groups a shared-source milk-run under one load with a tank-fill and drop count', () => {
    const orders = [
      makeOrder({ id: 'order-1', destinationId: 'hub-3', quantity: 5000 }),
      makeOrder({ id: 'order-2', destinationId: 'hub-5', quantity: 4000, status: 'assigned' }),
    ];
    renderWithProviders(<DeliveryManager trips={toTrips(orders)} hub={hub} active capacity={18000} />);
    // one load banner (shared source) with two drops and 9,000 L loaded
    expect(screen.getAllByText(/load at/i)).toHaveLength(1);
    expect(screen.getByText('2 drops')).toBeInTheDocument();
    expect(screen.getByText('9,000 L')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument(); // 9,000 / 18,000 tank
  });

  it('shows one load per pickup source for a multi-source day', () => {
    const orders = [
      makeOrder({ id: 'order-1', sourceId: 'hub-1', destinationId: 'hub-3' }),
      makeOrder({ id: 'order-2', sourceId: 'hub-5', destinationId: 'hub-3', status: 'assigned' }),
    ];
    renderWithProviders(<DeliveryManager trips={toTrips(orders)} hub={hub} active capacity={12000} />);
    expect(screen.getAllByText(/load at/i)).toHaveLength(2);
    expect(screen.getAllByText('1 drop')).toHaveLength(2);
  });

  it('omits the tank-fill when no capacity is known', () => {
    renderWithProviders(<DeliveryManager trips={toTrips([makeOrder()])} hub={hub} active />);
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });

  it('does not show actions when the shift is not active', () => {
    renderWithProviders(<DeliveryManager trips={toTrips([makeOrder()])} hub={hub} active={false} />);
    expect(screen.queryByRole('button', { name: /mark delivered/i })).not.toBeInTheDocument();
  });

  it('shows the completion note for a delivered order', () => {
    renderWithProviders(<DeliveryManager trips={toTrips([makeOrder({ status: 'delivered' })])} hub={hub} active />);
    expect(screen.getByText(/inventory updated/i)).toBeInTheDocument();
  });

  it('shows the failure reason for a failed order', () => {
    renderWithProviders(
      <DeliveryManager trips={toTrips([makeOrder({ status: 'failed', failureReason: 'Road closed' })])} hub={hub} active />,
    );
    expect(screen.getByText(/road closed/i)).toBeInTheDocument();
  });

  it('opens the failure modal and requires a reason before submitting', async () => {
    renderWithProviders(<DeliveryManager trips={toTrips([makeOrder()])} hub={hub} active />);
    await userEvent.click(screen.getByRole('button', { name: /report failure/i }));

    const dialog = screen.getByRole('dialog', { name: /report a failed delivery/i });
    expect(within(dialog).getByRole('button', { name: /mark failed/i })).toBeDisabled();

    // Note: use fireEvent.change here — userEvent's pointer/focus sequence bubbles a
    // mousedown that the Modal overlay treats as an outside-click and closes the dialog.
    fireEvent.change(within(dialog).getByPlaceholderText(/customer site closed/i), {
      target: { value: 'Customer site closed' },
    });
    expect(within(dialog).getByRole('button', { name: /mark failed/i })).toBeEnabled();
  });

  it('submits the failure reason and closes the modal on success', async () => {
    renderWithProviders(<DeliveryManager trips={toTrips([makeOrder()])} hub={hub} active />);
    await userEvent.click(screen.getByRole('button', { name: /report failure/i }));
    const dialog = screen.getByRole('dialog', { name: /report a failed delivery/i });
    fireEvent.change(within(dialog).getByPlaceholderText(/customer site closed/i), {
      target: { value: 'Customer site closed' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /mark failed/i }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /report a failed delivery/i })).not.toBeInTheDocument(),
    );
    await waitFor(() => {
      const order = getDb().orders.find((o) => o.id === 'order-1');
      expect(order?.status).toBe('failed');
      expect(order?.failureReason).toBe('Customer site closed');
    });
  });

  it('marks an in-transit delivery as delivered', async () => {
    // The complete endpoint only accepts in_transit orders, so align the shared db row.
    getDb().orders.find((o) => o.id === 'order-1')!.status = 'in_transit';
    renderWithProviders(<DeliveryManager trips={toTrips([makeOrder()])} hub={hub} active />);
    fireEvent.click(screen.getByRole('button', { name: /mark delivered/i }));
    await waitFor(() => expect(getDb().orders.find((o) => o.id === 'order-1')?.status).toBe('delivered'));
  });

  it('renders em-dash fallbacks and default badges for unknown hubs', () => {
    renderWithProviders(
      <DeliveryManager
        trips={toTrips([makeOrder({ sourceId: 'ghost-src', destinationId: 'ghost-dst' })])}
        hub={hub}
        active
      />,
    );
    // Unknown source/destination -> "—" fallback names plus the default source/dest badges.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('source')).toBeInTheDocument();
    expect(screen.getByText('dest')).toBeInTheDocument();
  });

  it('shows the completion time when the delivered order has completedAt', () => {
    renderWithProviders(
      <DeliveryManager
        trips={toTrips([makeOrder({ status: 'delivered', completedAt: '2025-11-24T10:30:00.000Z' })])}
        hub={hub}
        active
      />,
    );
    expect(screen.getByText(/delivered at/i)).toBeInTheDocument();
  });

  it('closes the modal without submitting when cancelled', async () => {
    renderWithProviders(<DeliveryManager trips={toTrips([makeOrder()])} hub={hub} active />);
    await userEvent.click(screen.getByRole('button', { name: /report failure/i }));
    const dialog = screen.getByRole('dialog', { name: /report a failed delivery/i });
    await userEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /report a failed delivery/i })).not.toBeInTheDocument(),
    );
    expect(getDb().orders.find((o) => o.id === 'order-1')?.status).toBe('assigned');
  });

  it('closes the modal from the dialog close (X) control', async () => {
    renderWithProviders(<DeliveryManager trips={toTrips([makeOrder()])} hub={hub} active />);
    await userEvent.click(screen.getByRole('button', { name: /report failure/i }));
    const dialog = screen.getByRole('dialog', { name: /report a failed delivery/i });
    // The X control fires the Modal's onClose prop (distinct from the Cancel button).
    await userEvent.click(within(dialog).getByRole('button', { name: /^close$/i }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /report a failed delivery/i })).not.toBeInTheDocument(),
    );
  });
});
