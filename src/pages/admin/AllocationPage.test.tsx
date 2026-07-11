import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import AllocationPage from './AllocationPage';
import { renderWithProviders } from '@/test/renderWithProviders';
import { resetDb, getDb, server } from '@/test/mswServer';
import { API_URL } from '@/config/env';
import { today, __setToday } from '@/utils/clock';
import type { Order } from '@/types';

const realToday = today();
beforeEach(() => resetDb());
afterEach(() => __setToday(realToday)); // some cases pin "today"; always restore

const d = () => today();

const mkOrder = (over: Partial<Order> & { id: string }): Order => ({
  sourceId: 'hub-1',
  destinationId: 'hub-3',
  product: 'diesel',
  quantity: 5000,
  deliveryDate: d(),
  assignedDriverId: 'driver-1',
  status: 'assigned',
  ...over,
});

async function openModal() {
  const user = userEvent.setup();
  const btn = await screen.findByRole('button', { name: /Allocate Vehicle/ });
  await user.click(btn);
  await screen.findByRole('dialog', { name: 'Allocate Vehicle' });
  return user;
}

// The dialog's aria-label ("Allocate Vehicle") also matches /Vehicle/, so target the
// select by its combobox role to disambiguate from the field label lookup.
const vehicleSelect = () => screen.getByRole('combobox', { name: /Vehicle/ });

function DeepLinkHarness() {
  const nav = useNavigate();
  return (
    <>
      <button onClick={() => nav('/admin/allocation', { state: { driverId: 'driver-1', date: today() } })}>
        deep-link
      </button>
      <AllocationPage />
    </>
  );
}

// Deep-link carrying only a date (no driverId) exercises the `st.driverId ?? ''` fallback.
function DeepLinkNoDriverHarness() {
  const nav = useNavigate();
  return (
    <>
      <button onClick={() => nav('/admin/allocation', { state: { date: today() } })}>deep-link</button>
      <AllocationPage />
    </>
  );
}

describe('AllocationPage', () => {
  it('shows a loading spinner then renders the calendar and header', async () => {
    renderWithProviders(<AllocationPage />);
    expect(screen.getByText('Loading allocations…')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Allocate Vehicle/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vehicle Allocation' })).toBeInTheDocument();
  });

  function seedEditable() {
    const db = getDb();
    db.vehicles = [
      { id: 'vehicle-1', registration: 'TRK-101', capacity: 8000, type: 'Tanker', status: 'available' },
      { id: 'vehicle-2', registration: 'TRK-202', capacity: 12000, type: 'Tanker', status: 'available' },
    ];
    db.drivers = [
      { id: 'driver-1', name: 'John', license: 'DL-1', phone: '+1', status: 'available' },
      { id: 'driver-2', name: 'Mary', license: 'DL-2', phone: '+2', status: 'available' },
    ];
    db.allocations = [{ id: 'a1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: d() }];
    db.orders = [];
  }

  it('edits an existing allocation from its calendar chip', async () => {
    seedEditable();
    const user = userEvent.setup();
    renderWithProviders(<AllocationPage />);
    await screen.findByRole('button', { name: /Allocate Vehicle/ });

    await user.click(screen.getByRole('button', { name: 'TRK-101 · John' }));
    await screen.findByRole('dialog', { name: 'Edit Allocation' });

    await user.selectOptions(vehicleSelect(), 'vehicle-2');
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    await waitFor(() => expect(getDb().allocations.find((a) => a.id === 'a1')?.vehicleId).toBe('vehicle-2'));
  });

  it('removes an allocation via the edit modal after confirming', async () => {
    seedEditable();
    const user = userEvent.setup();
    renderWithProviders(<AllocationPage />);
    await screen.findByRole('button', { name: /Allocate Vehicle/ });

    await user.click(screen.getByRole('button', { name: 'TRK-101 · John' }));
    await screen.findByRole('dialog', { name: 'Edit Allocation' });
    await user.click(screen.getByRole('button', { name: /Remove/ }));

    const confirmDialog = await screen.findByRole('dialog', { name: /Remove allocation/i });
    await user.click(within(confirmDialog).getByRole('button', { name: /^Remove$/ }));

    await waitFor(() => expect(getDb().allocations.some((a) => a.id === 'a1')).toBe(false));
  });

  it('uses generic names in the remove confirmation when vehicle/driver are unknown', async () => {
    const db = getDb();
    db.allocations = [{ id: 'a1', vehicleId: 'veh-x', driverId: 'drv-x', date: d() }]; // not in lookups
    db.orders = [];
    const user = userEvent.setup();
    renderWithProviders(<AllocationPage />);
    await screen.findByRole('button', { name: /Allocate Vehicle/ });

    await user.click(screen.getByRole('button', { name: 'veh-x · drv-x' }));
    await screen.findByRole('dialog', { name: 'Edit Allocation' });
    await user.click(screen.getByRole('button', { name: /Remove/ }));

    const confirmDialog = await screen.findByRole('dialog', { name: /Remove allocation/i });
    expect(within(confirmDialog).getByText(/Unassign this vehicle from the driver/i)).toBeInTheDocument();
  });

  it('opens the day view from "+N more" and edits an allocation from it', async () => {
    const db = getDb();
    db.vehicles = [{ id: 'vehicle-1', registration: 'TRK-101', capacity: 8000, type: 'Tanker', status: 'available' }];
    db.drivers = [{ id: 'driver-1', name: 'John', license: 'DL-1', phone: '+1', status: 'available' }];
    db.orders = [];
    db.allocations = Array.from({ length: 5 }, (_, i) => ({ id: `b${i}`, vehicleId: 'vehicle-1', driverId: 'driver-1', date: d() }));
    const user = userEvent.setup();
    renderWithProviders(<AllocationPage />);
    await screen.findByRole('button', { name: /Allocate Vehicle/ });

    await user.click(screen.getByRole('button', { name: /\+2 more/ }));
    const dayDialog = await screen.findByRole('dialog', { name: /Allocations ·/ });
    expect(within(dayDialog).getAllByRole('button', { name: /^Edit$/ })).toHaveLength(5);
    expect(within(dayDialog).getByRole('button', { name: /Add allocation/ })).toBeInTheDocument();

    await user.click(within(dayDialog).getAllByRole('button', { name: /^Edit$/ })[0]);
    await screen.findByRole('dialog', { name: 'Edit Allocation' });
  });

  it('adds a new allocation for the day from the day view', async () => {
    const db = getDb();
    db.vehicles = [{ id: 'vehicle-1', registration: 'TRK-101', capacity: 8000, type: 'Tanker', status: 'available' }];
    db.drivers = [{ id: 'driver-1', name: 'John', license: 'DL-1', phone: '+1', status: 'available' }];
    db.orders = [];
    db.allocations = Array.from({ length: 4 }, (_, i) => ({ id: `b${i}`, vehicleId: 'vehicle-1', driverId: 'driver-1', date: d() }));
    const user = userEvent.setup();
    renderWithProviders(<AllocationPage />);
    await screen.findByRole('button', { name: /Allocate Vehicle/ });

    await user.click(screen.getByRole('button', { name: /\+1 more/ }));
    const dayDialog = await screen.findByRole('dialog', { name: /Allocations ·/ });
    await user.click(within(dayDialog).getByRole('button', { name: /Add allocation/ }));
    await screen.findByRole('dialog', { name: 'Allocate Vehicle' });
  });

  it('shows a past day view read-only, with id fallbacks and no add', async () => {
    __setToday('2026-07-15');
    const db = getDb();
    db.vehicles = [];
    db.drivers = [];
    db.orders = [];
    db.allocations = Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, vehicleId: 'veh-x', driverId: 'drv-x', date: '2026-07-10' }));
    const user = userEvent.setup();
    renderWithProviders(<AllocationPage />);
    await screen.findByRole('button', { name: /Allocate Vehicle/ });

    await user.click(screen.getByRole('button', { name: /\+1 more/ }));
    const dayDialog = await screen.findByRole('dialog', { name: /Allocations · 2026-07-10/ });
    expect(within(dayDialog).getAllByText('history').length).toBeGreaterThanOrEqual(1); // read-only
    expect(within(dayDialog).queryByRole('button', { name: /Add allocation/ })).not.toBeInTheDocument();
    expect(within(dayDialog).getAllByText('veh-x').length).toBeGreaterThanOrEqual(1); // vehicle id fallback
    expect(within(dayDialog).getAllByText('drv-x').length).toBeGreaterThanOrEqual(1); // driver id fallback

    // close the day view (a past day has no footer, only the header close control)
    await user.click(within(dayDialog).getByRole('button', { name: /^close$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Allocations · 2026-07-10/ })).not.toBeInTheDocument());
  });

  it('prefills the modal from deep-link location.state', async () => {
    getDb().orders.push(mkOrder({ id: 'o-today', quantity: 5000 }));
    renderWithProviders(<DeepLinkHarness />);
    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Allocate Vehicle/ });
    await user.click(screen.getByRole('button', { name: 'deep-link' }));

    await screen.findByRole('dialog', { name: 'Allocate Vehicle' });
    expect(screen.getByText(/order\(s\) today/)).toBeInTheDocument();
    expect((screen.getByLabelText(/Driver/) as HTMLSelectElement).value).toBe('driver-1');
  });

  it('shows the driver hint and the "fits the load" OK message', async () => {
    getDb().orders.push(mkOrder({ id: 'o-today', quantity: 5000 }));
    renderWithProviders(<AllocationPage />);
    const user = await openModal();

    await user.selectOptions(screen.getByLabelText(/Driver/), 'driver-1');
    expect(screen.getByText(/order\(s\) today/)).toBeInTheDocument();

    await user.selectOptions(vehicleSelect(), 'vehicle-1');
    expect(screen.getByText(/fits the day/)).toBeInTheDocument();
    expect(screen.getByText(/Fits the .*shift/)).toBeInTheDocument();
  });

  it('warns when the vehicle can’t carry the day’s load (over capacity)', async () => {
    getDb().orders.push(
      mkOrder({ id: 'o-1', quantity: 5000 }),
      mkOrder({ id: 'o-2', quantity: 5000 }),
    );
    renderWithProviders(<AllocationPage />);
    const user = await openModal();

    // Select the vehicle FIRST (no driver → nothing disabled), then the heavy driver day.
    await user.selectOptions(vehicleSelect(), 'vehicle-1');
    await user.selectOptions(screen.getByLabelText(/Driver/), 'driver-1');

    expect(screen.getByText(/carry the day/)).toBeInTheDocument();
    // Vehicle option now shows the "too small" disabled reason.
    expect(screen.getByRole('option', { name: /too small/ })).toBeInTheDocument();
  });

  it('warns about an allocation conflict when the date lands on a booked day', async () => {
    getDb().allocations.push({ id: 'a-future', vehicleId: 'vehicle-1', driverId: 'driver-1', date: '2999-12-31' });
    renderWithProviders(<AllocationPage />);
    const user = await openModal();

    await user.selectOptions(vehicleSelect(), 'vehicle-1');
    fireEvent.change(screen.getByLabelText(/Date/), { target: { value: '2999-12-31' } });

    expect(screen.getByText(/already allocated on 2999-12-31/)).toBeInTheDocument();
  });

  it('hard-blocks allocation for a past date', async () => {
    renderWithProviders(<AllocationPage />);
    await openModal();

    fireEvent.change(screen.getByLabelText(/Date/), { target: { value: '2000-01-01' } });

    expect(screen.getByText(/allocate for a past date/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Allocate' })).toBeDisabled();
  });

  it('warns when a big tanker is under-utilised by a tiny load', async () => {
    getDb().vehicles.push({ id: 'vehicle-2', registration: 'BIG-900', capacity: 100000, type: 'Tanker', status: 'available' });
    getDb().orders.push(mkOrder({ id: 'o-small', quantity: 1000 }));
    renderWithProviders(<AllocationPage />);
    const user = await openModal();

    await user.selectOptions(screen.getByLabelText(/Driver/), 'driver-1');
    await user.selectOptions(vehicleSelect(), 'vehicle-2');

    expect(screen.getByText(/more efficient/)).toBeInTheDocument();
  });

  it('surfaces a source-stock shortfall as a non-blocking warning', async () => {
    getDb().hubs[0].inventory.diesel = 100; // Downtown almost empty
    getDb().orders.push(mkOrder({ id: 'o-short', quantity: 5000, sourceId: 'hub-1' }));
    renderWithProviders(<AllocationPage />);
    const user = await openModal();

    await user.selectOptions(screen.getByLabelText(/Driver/), 'driver-1');

    expect(screen.getByText(/Stock warning/)).toBeInTheDocument();
  });

  it('folds a reposition deadhead into the shift and flags an overbooked run', async () => {
    // Orders start at hub-3 while the vehicle sits at hub-1 → a real reposition leg.
    // Many drops (16 × ~30 min unload) overrun the 8h shift; load (8,000) stays within capacity.
    getDb().orders.push(
      ...Array.from({ length: 16 }, (_, i) => mkOrder({ id: `o-far-${i}`, quantity: 500, sourceId: 'hub-3', destinationId: 'hub-1' })),
    );
    renderWithProviders(<AllocationPage />);
    const user = await openModal();

    await user.selectOptions(screen.getByLabelText(/Driver/), 'driver-1');
    await user.selectOptions(vehicleSelect(), 'vehicle-1');

    expect(screen.getByText(/to reach the first pickup/)).toBeInTheDocument();
    expect(screen.getByText(/overruns the/)).toBeInTheDocument();
  });

  it('renders every vehicle-option disabled reason (too small / maintenance / booked)', async () => {
    getDb().orders.push(
      mkOrder({ id: 'o-a', quantity: 5000 }),
      mkOrder({ id: 'o-b', quantity: 5000 }),
    );
    getDb().vehicles.push(
      { id: 'v-maint', registration: 'MNT-1', capacity: 20000, type: 'Tanker', status: 'maintenance' },
      { id: 'v-booked', registration: 'BKD-1', capacity: 20000, type: 'Tanker', status: 'available' },
    );
    getDb().allocations.push({ id: 'a-booked', vehicleId: 'v-booked', driverId: 'driver-9', date: d() });
    renderWithProviders(<AllocationPage />);
    const user = await openModal();

    await user.selectOptions(screen.getByLabelText(/Driver/), 'driver-1');

    expect(screen.getByRole('option', { name: /too small/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /maintenance/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /booked/ })).toBeInTheDocument();
  });

  it('creates an allocation and closes the modal on success', async () => {
    getDb().orders.push(mkOrder({ id: 'o-ok', quantity: 5000 }));
    renderWithProviders(<AllocationPage />);
    const user = await openModal();

    await user.selectOptions(screen.getByLabelText(/Driver/), 'driver-1');
    await user.selectOptions(vehicleSelect(), 'vehicle-1');
    await user.click(screen.getByRole('button', { name: 'Allocate' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('prefills only the date when the deep-link omits the driver id', async () => {
    renderWithProviders(<DeepLinkNoDriverHarness />);
    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Allocate Vehicle/ });
    await user.click(screen.getByRole('button', { name: 'deep-link' }));

    await screen.findByRole('dialog', { name: 'Allocate Vehicle' });
    expect((screen.getByLabelText(/Driver/) as HTMLSelectElement).value).toBe('');
  });

  it('tolerates null orders/positions payloads when a driver and vehicle are picked', async () => {
    server.use(
      http.get(`${API_URL}/orders`, () => HttpResponse.json(null)),
      http.get(`${API_URL}/vehiclePositions`, () => HttpResponse.json(null)),
    );
    renderWithProviders(<AllocationPage />);
    const user = await openModal();

    await user.selectOptions(screen.getByLabelText(/Driver/), 'driver-1');
    await user.selectOptions(vehicleSelect(), 'vehicle-1');
    // With no orders the day is empty, so the "fits" message never shows; the modal still works.
    expect((vehicleSelect() as HTMLSelectElement).value).toBe('vehicle-1');
  });

  it('falls back to the raw source id when a shortfall order points at an unknown hub', async () => {
    getDb().orders.push(mkOrder({ id: 'o-nohub', quantity: 5000, sourceId: 'hub-nope' }));
    renderWithProviders(<AllocationPage />);
    const user = await openModal();

    await user.selectOptions(screen.getByLabelText(/Driver/), 'driver-1');

    expect(screen.getByText(/Stock warning/)).toBeInTheDocument();
    expect(screen.getByText(/hub-nope short/)).toBeInTheDocument();
  });

  it('closes the modal via Cancel and via the Close control', async () => {
    renderWithProviders(<AllocationPage />);
    const user = await openModal();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Allocate Vehicle/ }));
    await screen.findByRole('dialog', { name: 'Allocate Vehicle' });
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
