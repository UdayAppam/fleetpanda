import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import ShiftPage from './ShiftPage';
import { renderWithProviders, makeStore } from '@/test/renderWithProviders';
import { resetDb, getDb, server } from '@/test/mswServer';
import { API_URL } from '@/config/env';
import { loginSuccess } from '@/store/slices/authSlice';
import { today, __setToday } from '@/utils/clock';
import type { Order } from '@/types';

const realToday = today();
beforeEach(() => resetDb());
afterEach(() => __setToday(realToday)); // some cases pin "today"; always restore the real one

function authedStore() {
  const store = makeStore();
  store.dispatch(
    loginSuccess({
      user: { id: 'user-driver', email: 'driver@fleetpanda.com', name: 'John', role: 'driver', driverId: 'driver-1' },
      token: 't',
    }),
  );
  return store;
}

// Give the driver a today-dated allocation so readiness/plan logic engages.
function seedAllocationToday() {
  getDb().allocations = [{ id: 'alloc-1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: today() }];
}

const order = (over: Partial<Order> = {}): Order => ({
  id: 'order-1',
  sourceId: 'hub-1',
  destinationId: 'hub-3',
  product: 'diesel',
  quantity: 5000,
  deliveryDate: today(),
  assignedDriverId: 'driver-1',
  status: 'assigned',
  ...over,
});

describe('ShiftPage', () => {
  it('shows a loading spinner before data resolves', () => {
    renderWithProviders(<ShiftPage />, { store: authedStore() });
    expect(screen.getByText(/loading your shift/i)).toBeInTheDocument();
  });

  it('renders an error state and retries when orders fail to load', async () => {
    server.use(http.get(`${API_URL}/orders`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    renderWithProviders(<ShiftPage />, { store: authedStore() });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/boom|failed/i);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
  });

  it('shows the this-month summary with the next upcoming run', async () => {
    __setToday('2026-07-15');
    seedAllocationToday(); // uses today() = 2026-07-15
    getDb().orders = [
      order({ id: 'order-1', deliveryDate: '2026-07-15' }), // today
      order({ id: 'order-done', deliveryDate: '2026-07-05', status: 'delivered' }),
      order({ id: 'order-next', deliveryDate: '2026-07-22' }), // upcoming
    ];
    renderWithProviders(<ShiftPage />, { store: authedStore() });

    await screen.findByText('Shift & Deliveries');
    expect(screen.getByText('July')).toBeInTheDocument();
    expect(screen.getByText(/3 assigned/)).toBeInTheDocument();
    expect(screen.getByText(/1 done/)).toBeInTheDocument();
    expect(screen.getByText(/^next /)).toBeInTheDocument(); // nextDate branch
  });

  it('disables Start Shift and explains why when the driver is not ready (stock short)', async () => {
    seedAllocationToday();
    const db = getDb();
    db.orders = [order()];
    db.hubs[0].inventory.diesel = 100; // Downtown short for the 5,000 L order

    renderWithProviders(<ShiftPage />, { store: authedStore() });

    expect(await screen.findByText('Shift & Deliveries')).toBeInTheDocument();
    expect(screen.getByText('Not started')).toBeInTheDocument();
    const start = screen.getByRole('button', { name: /start shift/i });
    expect(start).toBeDisabled();
    expect(screen.getByText(/order needs/i)).toBeInTheDocument();
    // progress + route stats block renders when there are orders
    expect(screen.getByText(/deliveries ·/i)).toBeInTheDocument();
  });

  it('enables Start Shift when ready and starts the shift', async () => {
    seedAllocationToday();
    const db = getDb();
    db.orders = [order()];
    // put the driver far from the first pickup so the reposition hint renders
    db.vehiclePositions = [
      { id: 'pos-1', vehicleId: 'vehicle-1', driverId: 'driver-1', lat: 41, lng: -73, updatedAt: new Date().toISOString(), status: 'idle' },
    ];

    renderWithProviders(<ShiftPage />, { store: authedStore() });
    await screen.findByText('Shift & Deliveries');

    expect(screen.getByText(/from your location/i)).toBeInTheDocument();
    const start = screen.getByRole('button', { name: /start shift/i });
    expect(start).toBeEnabled();
    await userEvent.click(start);

    expect(await screen.findByRole('button', { name: /end shift/i })).toBeInTheDocument();
    expect(screen.getByText(/deliveries dispatched/i)).toBeInTheDocument();
  });

  it('ends an active shift after confirming (normal message, plus cancel path)', async () => {
    seedAllocationToday();
    const db = getDb();
    db.orders = [
      order({ status: 'delivered', completedAt: new Date().toISOString() }),
      order({ id: 'order-2', destinationId: 'hub-1', status: 'failed', failureReason: 'Site closed' }),
    ];
    db.shifts.push({
      id: 'shift-1', driverId: 'driver-1', vehicleId: 'vehicle-1', date: today(),
      status: 'active', startedAt: new Date().toISOString(), endedAt: null, orderIds: ['order-1'],
    });

    renderWithProviders(<ShiftPage />, { store: authedStore() });
    await screen.findByText('Shift & Deliveries');
    expect(screen.getByText('Shift active')).toBeInTheDocument();
    // delivered order → progress shows 1 delivered, ETA present
    expect(screen.getByText(/1 delivered/i)).toBeInTheDocument();

    // open confirm then cancel (covers ok === false)
    await userEvent.click(screen.getByRole('button', { name: /end shift/i }));
    expect(await screen.findByText(/end your shift for today/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByText(/end your shift for today/i)).not.toBeInTheDocument());

    // reopen and confirm
    await userEvent.click(screen.getByRole('button', { name: /end shift/i }));
    await screen.findByText(/end your shift for today/i);
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /end shift/i }));
    expect(await screen.findByText(/shift ended/i)).toBeInTheDocument();
  });

  it('warns about in-transit deliveries when ending the shift', async () => {
    seedAllocationToday();
    const db = getDb();
    db.orders = [order({ status: 'in_transit' })];
    db.shifts.push({
      id: 'shift-1', driverId: 'driver-1', vehicleId: 'vehicle-1', date: today(),
      status: 'active', startedAt: new Date().toISOString(), endedAt: null, orderIds: ['order-1'],
    });

    renderWithProviders(<ShiftPage />, { store: authedStore() });
    await screen.findByText('Shift & Deliveries');

    // DeliveryManager surfaces the active in-transit delivery action
    expect(await screen.findByRole('button', { name: /mark delivered/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /end shift/i }));
    expect(await screen.findByText(/still in transit/i)).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /end shift/i }));
    expect(await screen.findByText(/shift ended/i)).toBeInTheDocument();
  });

  it('shows "no vehicle allocated" and no orders messaging when nothing is set up', async () => {
    getDb().allocations = [];
    getDb().orders = [];
    getDb().vehiclePositions = []; // no live position → startFrom undefined branch

    renderWithProviders(<ShiftPage />, { store: authedStore() });
    await screen.findByText('Shift & Deliveries');

    expect(screen.getByText('No vehicle allocated')).toBeInTheDocument();
    expect(screen.getByText(/no deliveries assigned for today/i)).toBeInTheDocument();
  });

  it('renders when the vehicle-positions payload is null', async () => {
    getDb().allocations = [];
    getDb().orders = [];
    server.use(http.get(`${API_URL}/vehiclePositions`, () => HttpResponse.json(null)));

    renderWithProviders(<ShiftPage />, { store: authedStore() });
    await screen.findByText('Shift & Deliveries');
    expect(screen.getByText('No vehicle allocated')).toBeInTheDocument();
  });
});
