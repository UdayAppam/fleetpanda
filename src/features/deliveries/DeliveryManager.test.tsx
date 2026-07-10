import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeliveryManager } from './DeliveryManager';
import { renderWithProviders } from '@/test/renderWithProviders';
import { resetDb } from '@/test/mswServer';
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

    expect(screen.getByRole('dialog', { name: /report a failed delivery/i })).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /mark failed/i });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/what went wrong/i), 'Customer site closed');
    expect(submit).toBeEnabled();
  });

  it('submits the failure reason and closes the modal on success', async () => {
    renderWithProviders(<DeliveryManager orders={[makeOrder()]} hub={hub} active />);
    await userEvent.click(screen.getByRole('button', { name: /report failure/i }));
    const submit = screen.getByRole('button', { name: /mark failed/i });
    await userEvent.type(screen.getByLabelText(/what went wrong/i), 'Customer site closed');
    await userEvent.click(submit);
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /report a failed delivery/i })).not.toBeInTheDocument(),
    );
  });
});
