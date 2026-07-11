import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeliveryManager } from './DeliveryManager';
import { renderWithProviders } from '@/test/renderWithProviders';
import { resetDb, getDb } from '@/test/mswServer';
import type { Hub, Order } from '@/types';

beforeEach(() => resetDb());

const hub = new Map<string, Hub>([
  ['hub-1', { id: 'hub-1', name: 'Downtown', locationType: 'hub', address: 'x', coordinates: { lat: 40, lng: -74 }, inventory: {} }],
  ['hub-3', { id: 'hub-3', name: 'Northgate', locationType: 'terminal', address: 'y', coordinates: { lat: 40.7, lng: -73.9 }, inventory: {} }],
]);

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
    renderWithProviders(<DeliveryManager orders={[]} hub={hub} active />);
    expect(screen.getByText(/no deliveries assigned/i)).toBeInTheDocument();
  });

  it('renders route, quantity and the current tag for the active in-transit order', () => {
    renderWithProviders(<DeliveryManager orders={[makeOrder()]} hub={hub} active />);
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('5,000 L')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark delivered/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /report failure/i })).toBeInTheDocument();
  });

  it('does not show actions when the shift is not active', () => {
    renderWithProviders(<DeliveryManager orders={[makeOrder()]} hub={hub} active={false} />);
    expect(screen.queryByRole('button', { name: /mark delivered/i })).not.toBeInTheDocument();
  });

  it('shows the completion note for a delivered order', () => {
    renderWithProviders(<DeliveryManager orders={[makeOrder({ status: 'delivered' })]} hub={hub} active />);
    expect(screen.getByText(/inventory updated/i)).toBeInTheDocument();
  });

  it('shows the failure reason for a failed order', () => {
    renderWithProviders(
      <DeliveryManager orders={[makeOrder({ status: 'failed', failureReason: 'Road closed' })]} hub={hub} active />,
    );
    expect(screen.getByText(/road closed/i)).toBeInTheDocument();
  });

  it('opens the failure modal and requires a reason before submitting', async () => {
    renderWithProviders(<DeliveryManager orders={[makeOrder()]} hub={hub} active />);
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
    renderWithProviders(<DeliveryManager orders={[makeOrder()]} hub={hub} active />);
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
    renderWithProviders(<DeliveryManager orders={[makeOrder()]} hub={hub} active />);
    fireEvent.click(screen.getByRole('button', { name: /mark delivered/i }));
    await waitFor(() => expect(getDb().orders.find((o) => o.id === 'order-1')?.status).toBe('delivered'));
  });

  it('renders em-dash fallbacks and default badges for unknown hubs', () => {
    renderWithProviders(
      <DeliveryManager
        orders={[makeOrder({ sourceId: 'ghost-src', destinationId: 'ghost-dst' })]}
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
        orders={[makeOrder({ status: 'delivered', completedAt: '2025-11-24T10:30:00.000Z' })]}
        hub={hub}
        active
      />,
    );
    expect(screen.getByText(/delivered at/i)).toBeInTheDocument();
  });

  it('closes the modal without submitting when cancelled', async () => {
    renderWithProviders(<DeliveryManager orders={[makeOrder()]} hub={hub} active />);
    await userEvent.click(screen.getByRole('button', { name: /report failure/i }));
    const dialog = screen.getByRole('dialog', { name: /report a failed delivery/i });
    await userEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /report a failed delivery/i })).not.toBeInTheDocument(),
    );
    expect(getDb().orders.find((o) => o.id === 'order-1')?.status).toBe('assigned');
  });

  it('closes the modal from the dialog close (X) control', async () => {
    renderWithProviders(<DeliveryManager orders={[makeOrder()]} hub={hub} active />);
    await userEvent.click(screen.getByRole('button', { name: /report failure/i }));
    const dialog = screen.getByRole('dialog', { name: /report a failed delivery/i });
    // The X control fires the Modal's onClose prop (distinct from the Cancel button).
    await userEvent.click(within(dialog).getByRole('button', { name: /^close$/i }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /report a failed delivery/i })).not.toBeInTheDocument(),
    );
  });
});
