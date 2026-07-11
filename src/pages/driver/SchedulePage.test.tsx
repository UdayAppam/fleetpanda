import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import SchedulePage from './SchedulePage';
import { renderWithProviders, makeStore } from '@/test/renderWithProviders';
import { resetDb, getDb, server } from '@/test/mswServer';
import { API_URL } from '@/config/env';
import { loginSuccess } from '@/store/slices/authSlice';
import { today, __setToday } from '@/utils/clock';
import type { Order } from '@/types';

const realToday = today();
beforeEach(() => resetDb());
afterEach(() => __setToday(realToday));

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

const order = (over: Partial<Order> & { id: string }): Order => ({
  sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 5000,
  deliveryDate: '2026-07-15', assignedDriverId: 'driver-1', status: 'assigned', ...over,
});

function seedMonth() {
  __setToday('2026-07-15');
  const db = getDb();
  db.vehicles = [
    { id: 'vehicle-1', registration: 'TRK-101', capacity: 12000, type: 'Tanker', status: 'available' },
    { id: 'vehicle-2', registration: 'TRK-202', capacity: 8000, type: 'Tanker', status: 'available' },
  ];
  db.orders = [
    order({ id: 'o-today-1', deliveryDate: '2026-07-15' }),
    order({ id: 'o-today-2', deliveryDate: '2026-07-15', destinationId: 'hub-1', quantity: 3000 }),
    order({ id: 'o-past-ok', deliveryDate: '2026-07-05', status: 'delivered' }),
    order({ id: 'o-past-fail', deliveryDate: '2026-07-05', status: 'failed', quantity: 2000 }),
    order({ id: 'o-next', deliveryDate: '2026-07-22' }),
    order({ id: 'o-ghost', deliveryDate: '2026-07-20', sourceId: 'ghost-src', destinationId: 'ghost-dst' }), // unknown hubs → raw id fallback
    order({ id: 'o-august', deliveryDate: '2026-08-01' }), // different month → excluded from July
  ];
  db.allocations = [
    { id: 'a1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: '2026-07-15' }, // truck for today
    { id: 'a2', vehicleId: 'vehicle-2', driverId: 'driver-1', date: '2026-07-18' }, // truck-only day (no orders)
  ];
}

describe('SchedulePage', () => {
  it('shows a loading spinner before data resolves', () => {
    renderWithProviders(<SchedulePage />, { store: authedStore() });
    expect(screen.getByText(/loading your schedule/i)).toBeInTheDocument();
  });

  it('renders an error state and retries when data fails to load', async () => {
    server.use(http.get(`${API_URL}/orders`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    renderWithProviders(<SchedulePage />, { store: authedStore() });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/boom|failed/i);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
  });

  it('renders the day-wise month schedule with per-day truck and orders', async () => {
    seedMonth();
    renderWithProviders(<SchedulePage />, { store: authedStore() });
    await screen.findByText('My Schedule');
    expect(screen.getByText('July 2026')).toBeInTheDocument();

    // per-day truck info: today's allocation + the truck-only day
    expect(screen.getByText('TRK-101')).toBeInTheDocument();
    expect(screen.getByText('TRK-202')).toBeInTheDocument();
    expect(screen.getByText(/truck reserved/i)).toBeInTheDocument(); // alloc-only day, no orders
    expect(screen.getAllByText(/no truck allocated/i).length).toBeGreaterThanOrEqual(1); // days without a truck

    // day-state chips ("Today" also names the nav button, so expect both it and the chip)
    expect(screen.getAllByText('Today').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Past').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Upcoming').length).toBeGreaterThanOrEqual(1);

    // delivered/failed roll-up on the past day (two orders same day)
    expect(screen.getByText(/1 delivered/)).toBeInTheDocument();
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();

    // order-count wording (singular + plural) and that the August order is excluded
    expect(screen.getAllByText(/2 orders/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/1 order ·/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/August/)).not.toBeInTheDocument();
    // unknown hub → raw id fallback in the route
    expect(screen.getByText('ghost-dst')).toBeInTheDocument();
  });

  it('navigates months and shows an empty state for a month with nothing', async () => {
    seedMonth();
    renderWithProviders(<SchedulePage />, { store: authedStore() });
    await screen.findByText('July 2026');

    await userEvent.click(screen.getByRole('button', { name: /previous month/i }));
    expect(screen.getByText('June 2026')).toBeInTheDocument();
    expect(screen.getByText(/nothing scheduled/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /next month/i })); // back to July
    await userEvent.click(screen.getByRole('button', { name: /next month/i })); // August
    expect(screen.getByText('August 2026')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^today$/i }));
    expect(screen.getByText('July 2026')).toBeInTheDocument();
  });

  it('shows nothing scheduled for a signed-out (no driverId) user', async () => {
    renderWithProviders(<SchedulePage />); // default store: unauthenticated
    await waitFor(() => expect(screen.getByText(/nothing scheduled/i)).toBeInTheDocument());
  });
});
