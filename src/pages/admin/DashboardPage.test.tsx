import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import DashboardPage from './DashboardPage';
import { renderWithProviders } from '@/test/renderWithProviders';
import { resetDb, getDb, server } from '@/test/mswServer';
import { API_URL } from '@/config/env';
import { today } from '@/utils/clock';
import type { Order } from '@/types';

beforeEach(() => resetDb());

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

describe('DashboardPage', () => {
  it('shows a loading spinner then the control-tower header', async () => {
    getDb().orders = [];
    getDb().allocations = [];
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Loading dashboard…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('renders summary tiles, the action list and CTAs for a mix of readiness states', async () => {
    const db = getDb();
    db.vehicles.push(
      { id: 'vehicle-2', registration: 'TRK-2', capacity: 8000, type: 'Tanker', status: 'available' },
      { id: 'vehicle-3', registration: 'TRK-3', capacity: 20000, type: 'Tanker', status: 'available' },
    );
    db.allocations = [
      { id: 'al-1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: d() },
      { id: 'al-3', vehicleId: 'vehicle-2', driverId: 'driver-3', date: d() },
      { id: 'al-4', vehicleId: 'vehicle-3', driverId: 'driver-4', date: d() },
    ];
    db.orders = [
      mkOrder({ id: 'o-ready', assignedDriverId: 'driver-1', quantity: 5000 }),
      mkOrder({ id: 'o-needveh', assignedDriverId: 'driver-2', quantity: 3000 }),
      mkOrder({ id: 'o-needdrv', assignedDriverId: null, quantity: 2000, status: 'pending' }),
      mkOrder({ id: 'o-blkcap', assignedDriverId: 'driver-3', quantity: 10000 }),
      mkOrder({ id: 'o-blkstock', assignedDriverId: 'driver-4', quantity: 10000, sourceId: 'hub-3', destinationId: 'hub-1' }),
      mkOrder({ id: 'o-transit', assignedDriverId: 'driver-5', quantity: 1000, status: 'in_transit' }),
      mkOrder({ id: 'o-delivered', assignedDriverId: 'driver-1', quantity: 1000, status: 'delivered' }),
    ];

    renderWithProviders(<DashboardPage />);
    await screen.findByRole('heading', { name: 'Dashboard' });

    // Summary tiles link out with the right counts.
    const ready = screen.getByRole('link', { name: /Ready/ });
    expect(ready).toHaveAttribute('href', expect.stringContaining('readiness=ready'));
    expect(ready).toHaveTextContent('1');
    expect(screen.getByRole('link', { name: /In transit/ })).toHaveTextContent('1');
    expect(screen.getByRole('link', { name: /Need action/ })).toHaveTextContent('2');
    expect(screen.getByRole('link', { name: /Blocked/ })).toHaveTextContent('2');

    // Actionable orders appear; ready ones do not.
    expect(screen.getByText('o-needveh')).toBeInTheDocument();
    expect(screen.getByText('o-needdrv')).toBeInTheDocument();
    expect(screen.getByText('o-blkcap')).toBeInTheDocument();
    expect(screen.getByText('o-blkstock')).toBeInTheDocument();
    expect(screen.queryByText('o-ready')).not.toBeInTheDocument();

    // Detail lines for the blocked orders.
    expect(screen.getByText(/Day load 10,000 L exceeds vehicle 8,000 L/)).toBeInTheDocument();
    expect(screen.getByText(/Source short by 200 L/)).toBeInTheDocument();

    // Every CTA variant renders.
    expect(screen.getByRole('button', { name: 'Assign driver' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reallocate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review stock' })).toBeInTheDocument();

    // Clicking CTAs navigates (with state and without).
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Allocate vehicle' }));
    await user.click(screen.getByRole('button', { name: 'Assign driver' }));
  });

  it('shows the all-clear and healthy-stock states when nothing needs action', async () => {
    getDb().orders = [];
    getDb().allocations = [];
    renderWithProviders(<DashboardPage />);
    await screen.findByRole('heading', { name: 'Dashboard' });

    expect(screen.getByText(/All clear/)).toBeInTheDocument();
    expect(screen.getByText(/Stock levels healthy/)).toBeInTheDocument();
  });

  it('lists low-stock hubs (critical + low) with a link to inventory', async () => {
    getDb().orders = [];
    getDb().allocations = [];
    getDb().hubs[0].inventory.diesel = 500; // Downtown → critical
    getDb().hubs[1].inventory.diesel = 6000; // Northgate → low
    renderWithProviders(<DashboardPage />);
    await screen.findByRole('heading', { name: 'Dashboard' });

    expect(screen.getByText('Downtown')).toBeInTheDocument();
    expect(screen.getByText('Northgate')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open inventory/ })).toBeInTheDocument();
  });

  it('renders shift advisories (overbooked + under-utilised) and Review navigates', async () => {
    const db = getDb();
    db.vehicles.push({ id: 'vehicle-big', registration: 'BIG-1', capacity: 100000, type: 'Tanker', status: 'available' });
    db.allocations = [
      { id: 'al-a', vehicleId: 'vehicle-1', driverId: 'driver-1', date: d() },
      { id: 'al-b', vehicleId: 'vehicle-big', driverId: 'driver-2', date: d() },
    ];
    db.orders = [
      mkOrder({ id: 'ob1', assignedDriverId: 'driver-1', quantity: 3000 }),
      mkOrder({ id: 'ob2', assignedDriverId: 'driver-1', quantity: 3000 }),
      mkOrder({ id: 'uu1', assignedDriverId: 'driver-2', quantity: 1000 }),
    ];

    renderWithProviders(<DashboardPage />);
    await screen.findByRole('heading', { name: 'Dashboard' });

    expect(screen.getByRole('heading', { name: /Shift advisories/ })).toBeInTheDocument();
    expect(screen.getByText(/over the 8h shift by/)).toBeInTheDocument();
    expect(screen.getByText(/Consider a smaller tanker/)).toBeInTheDocument();

    const reviews = screen.getAllByRole('button', { name: 'Review' });
    expect(reviews).toHaveLength(2);
    const user = userEvent.setup();
    await user.click(reviews[0]);
  });

  it('flags hubs that are missing a product entirely as low stock', async () => {
    getDb().orders = [];
    getDb().allocations = [];
    // Petrol has no inventory entry on any hub → `h.inventory[key] ?? 0` fallback → critical.
    getDb().products.push({ id: 'prod-petrol', key: 'petrol', name: 'Petrol Gold', unit: 'L', lowStockThreshold: 1000, tankCapacity: 5000 });
    renderWithProviders(<DashboardPage />);
    await screen.findByRole('heading', { name: 'Dashboard' });

    expect(screen.getAllByText('Petrol Gold').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Open inventory/ })).toBeInTheDocument();
  });

  it('renders when the hubs payload is null', async () => {
    getDb().orders = [];
    getDb().allocations = [];
    server.use(http.get(`${API_URL}/hubs`, () => HttpResponse.json(null)));
    renderWithProviders(<DashboardPage />);
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.getByText(/Stock levels healthy/)).toBeInTheDocument();
  });

  it('renders when the products payload is null', async () => {
    getDb().orders = [];
    getDb().allocations = [];
    server.use(http.get(`${API_URL}/products`, () => HttpResponse.json(null)));
    renderWithProviders(<DashboardPage />);
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.getByText(/Stock levels healthy/)).toBeInTheDocument();
  });
});
