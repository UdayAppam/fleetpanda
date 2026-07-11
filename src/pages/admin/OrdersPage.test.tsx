import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import OrdersPage from './OrdersPage';
import { renderWithProviders } from '@/test/renderWithProviders';
import { resetDb, getDb, server } from '@/test/mswServer';
import { API_URL } from '@/config/env';
import { today } from '@/utils/clock';

beforeEach(() => resetDb());

// Seed a spread of orders (all statuses + readiness groups) plus a second, on-shift driver.
function seedVariety() {
  const db = getDb();
  db.drivers.push({ id: 'driver-2', name: 'Mary', license: 'DL-2', phone: '+222222', status: 'on_shift' });
  db.orders.push(
    // pending, no driver -> readiness "needs" (needs_driver)
    { id: 'order-pending', sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 200, deliveryDate: '2025-11-24', assignedDriverId: null, status: 'pending' },
    // in_transit, with driver -> driver name shown, readiness "In transit"
    { id: 'order-transit', sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 300, deliveryDate: '2025-11-24', assignedDriverId: 'driver-1', status: 'in_transit' },
    // delivered, unknown hub + unknown driver -> route "—" and driver "—" fallbacks, readiness pill null
    { id: 'order-delivered', sourceId: 'ghost', destinationId: 'ghost2', product: 'diesel', quantity: 400, deliveryDate: '2025-11-24', assignedDriverId: 'gone', status: 'delivered' },
    // failed, no driver -> readiness pill null, driver "—" (null branch)
    { id: 'order-failed', sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 500, deliveryDate: '2025-11-24', assignedDriverId: null, status: 'failed' },
    // pending, no driver, on a DIFFERENT date -> excluded by the date filter branch
    { id: 'order-otherdate', sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 600, deliveryDate: '2025-12-01', assignedDriverId: null, status: 'pending' },
  );
}

describe('OrdersPage', () => {
  it('renders the orders table with every status/readiness variant', async () => {
    seedVariety();
    renderWithProviders(<OrdersPage />);

    expect(await screen.findByText('order-1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Orders' })).toBeInTheDocument();
    // readiness pills for the assorted states ("In transit" also appears as a filter chip)
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getAllByText('Needs driver').length).toBeGreaterThan(0);
    expect(screen.getAllByText('In transit').length).toBeGreaterThan(0);
    // in_transit order shows the resolved driver name; every other seeded row is present
    expect(screen.getAllByText('John').length).toBeGreaterThan(0);
    expect(screen.getByText('order-delivered')).toBeInTheDocument();
    expect(screen.getByText('order-failed')).toBeInTheDocument();
  });

  it('filters by status chips and resets with All', async () => {
    seedVariety();
    renderWithProviders(<OrdersPage />);
    await screen.findByText('order-1');

    await userEvent.click(screen.getByRole('tab', { name: /Delivered/ }));
    expect(screen.getByText('order-delivered')).toBeInTheDocument();
    expect(screen.queryByText('order-1')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /^All/ }));
    expect(await screen.findByText('order-1')).toBeInTheDocument();
  });

  it('filters via the search box (id, product, and destination name)', async () => {
    seedVariety();
    renderWithProviders(<OrdersPage />);
    await screen.findByText('order-1');
    const searchBox = screen.getByLabelText('Search');

    // matches by product
    await userEvent.type(searchBox, 'diesel');
    expect(screen.getByText('order-1')).toBeInTheDocument();

    // matches by destination hub name only (Northgate)
    await userEvent.clear(searchBox);
    await userEvent.type(searchBox, 'northgate');
    expect(screen.getByText('order-1')).toBeInTheDocument();
    // order-delivered's destination is an unknown hub -> filtered out
    expect(screen.queryByText('order-delivered')).not.toBeInTheDocument();

    // matches nothing
    await userEvent.clear(searchBox);
    await userEvent.type(searchBox, 'zzzznomatch');
    await waitFor(() => expect(screen.queryByText('order-1')).not.toBeInTheDocument());
  });

  it('honours the ?status deep link', async () => {
    seedVariety();
    renderWithProviders(<OrdersPage />, { route: '/admin/orders?status=assigned' });
    expect(await screen.findByText('order-1')).toBeInTheDocument();
    // pending order should be hidden by the assigned filter
    expect(screen.queryByText('order-pending')).not.toBeInTheDocument();
  });

  it('honours the ?readiness + ?date deep link and clears it', async () => {
    seedVariety();
    renderWithProviders(<OrdersPage />, { route: '/admin/orders?readiness=needs&date=2025-11-24' });

    // only the driverless pending order on that date qualifies
    expect(await screen.findByText('order-pending')).toBeInTheDocument();
    expect(screen.queryByText('order-1')).not.toBeInTheDocument();
    // the "other date" pending order is excluded by the date filter branch
    expect(screen.queryByText('order-otherdate')).not.toBeInTheDocument();

    const chip = screen.getByRole('button', { name: /Need action/ });
    await userEvent.click(chip);
    expect(await screen.findByText('order-1')).toBeInTheDocument();
  });

  it('shows the readiness chip without a date when ?date is omitted', async () => {
    seedVariety();
    renderWithProviders(<OrdersPage />, { route: '/admin/orders?readiness=needs' });
    expect(await screen.findByText('order-pending')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Need action/ })).toBeInTheDocument();
  });

  it('hides the clear chip for the terminal "done" readiness group', async () => {
    seedVariety();
    renderWithProviders(<OrdersPage />, { route: '/admin/orders?readiness=done' });
    // delivered/failed orders belong to the done group
    expect(await screen.findByText('order-delivered')).toBeInTheDocument();
    expect(screen.queryByText('order-1')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Need action|Ready/ })).not.toBeInTheDocument();
  });

  it('assigns a driver via the row select', async () => {
    seedVariety();
    renderWithProviders(<OrdersPage />);
    await screen.findByText('order-pending');

    const select = screen.getByLabelText('Assign driver to order-pending');
    // option label carries the on-shift/available suffix
    expect(within(select).getByRole('option', { name: /Mary . on shift/ })).toBeInTheDocument();
    await userEvent.selectOptions(select, 'driver-1');
    await waitFor(() => expect((screen.getByLabelText('Assign driver to order-pending') as HTMLSelectElement).value).toBe('driver-1'));
  });

  it('ignores selecting the empty "Unassigned" option (no mutation)', async () => {
    renderWithProviders(<OrdersPage />);
    await screen.findByText('order-1');
    const select = screen.getByLabelText('Assign driver to order-1') as HTMLSelectElement;
    // Selecting the empty option hits the falsy `e.target.value` branch (no mutation),
    // so the controlled value stays pinned to the current driver.
    await userEvent.selectOptions(select, '');
    expect(select.value).toBe('driver-1');
  });

  it('creates a new order from the drawer', async () => {
    renderWithProviders(<OrdersPage />);
    await screen.findByText('order-1');

    await userEvent.click(screen.getByRole('button', { name: /New Order/ }));
    const dialog = await screen.findByRole('dialog', { name: 'New Order' });
    await userEvent.selectOptions(within(dialog).getByLabelText('Source hub'), 'hub-1');
    await userEvent.selectOptions(within(dialog).getByLabelText('Destination'), 'hub-3');
    await userEvent.selectOptions(within(dialog).getByLabelText('Product'), 'diesel');
    await userEvent.type(within(dialog).getByLabelText(/Quantity/), '100');
    // sufficient-stock feedback should render
    expect(within(dialog).getByText(/can cover this order/i)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: /Create order/i }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New Order' })).not.toBeInTheDocument());
  });

  it('edits an existing (future-dated) order from the drawer', async () => {
    getDb().orders.push({
      id: 'order-future',
      sourceId: 'hub-1',
      destinationId: 'hub-3',
      product: 'diesel',
      quantity: 1000,
      deliveryDate: today(),
      assignedDriverId: 'driver-1',
      status: 'assigned',
    });
    renderWithProviders(<OrdersPage />);
    await screen.findByText('order-future');

    await userEvent.click(screen.getByLabelText('Edit order-future'));
    const dialog = await screen.findByRole('dialog', { name: /Edit order-future/ });
    const qty = within(dialog).getByLabelText(/Quantity/);
    await userEvent.clear(qty);
    await userEvent.type(qty, '1200');
    await userEvent.click(within(dialog).getByRole('button', { name: /Save changes/i }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Edit order-future/ })).not.toBeInTheDocument());
  });

  it('deletes an order after confirmation', async () => {
    renderWithProviders(<OrdersPage />);
    await screen.findByText('order-1');

    await userEvent.click(screen.getByLabelText('Delete order-1'));
    const confirmBtn = await screen.findByRole('button', { name: 'Delete' });
    await userEvent.click(confirmBtn);
    await waitFor(() => expect(screen.queryByText('order-1')).not.toBeInTheDocument());
  });

  it('renders an error state when the orders request fails', async () => {
    server.use(http.get(`${API_URL}/orders`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    renderWithProviders(<OrdersPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/boom|failed/i);
  });

  it('refetches the orders when the error-state retry is pressed', async () => {
    server.use(http.get(`${API_URL}/orders`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    renderWithProviders(<OrdersPage />);
    await screen.findByRole('alert');
    // Restore the healthy handler, then retry → onRetry calls orders.refetch() and the table loads.
    server.resetHandlers();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('order-1')).toBeInTheDocument();
  });

  it('dismisses the New Order drawer via its close control', async () => {
    renderWithProviders(<OrdersPage />);
    await screen.findByText('order-1');
    await userEvent.click(screen.getByRole('button', { name: /New Order/ }));
    const dialog = await screen.findByRole('dialog', { name: 'New Order' });
    // The X control fires the drawer Modal's onClose prop (OrdersPage line 193).
    await userEvent.click(within(dialog).getByRole('button', { name: /^close$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New Order' })).not.toBeInTheDocument());
  });

  it('dismisses the Edit drawer via its close control', async () => {
    getDb().orders.push({
      id: 'order-future', sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel',
      quantity: 1000, deliveryDate: today(), assignedDriverId: 'driver-1', status: 'assigned',
    });
    renderWithProviders(<OrdersPage />);
    await screen.findByText('order-future');
    await userEvent.click(screen.getByLabelText('Edit order-future'));
    const dialog = await screen.findByRole('dialog', { name: /Edit order-future/ });
    // The X control fires the edit Modal's onClose prop (OrdersPage line 200).
    await userEvent.click(within(dialog).getByRole('button', { name: /^close$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Edit order-future/ })).not.toBeInTheDocument());
  });
});
