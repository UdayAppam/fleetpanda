import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { reactLeafletMock } from '@/test/reactLeafletMock';

vi.mock('react-leaflet', () => reactLeafletMock);

import DriverMapPage from './DriverMapPage';
import { renderWithProviders, makeStore } from '@/test/renderWithProviders';
import { resetDb, getDb, server } from '@/test/mswServer';
import { API_URL } from '@/config/env';
import { loginSuccess } from '@/store/slices/authSlice';
import { today } from '@/utils/clock';

beforeEach(() => resetDb());

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

describe('DriverMapPage', () => {
  it('shows a loading spinner before data resolves', () => {
    renderWithProviders(<DriverMapPage />, { store: authedStore() });
    expect(screen.getByText(/loading map/i)).toBeInTheDocument();
  });

  it('shows the empty state when the driver has no vehicle position', async () => {
    getDb().vehiclePositions = [];
    renderWithProviders(<DriverMapPage />, { store: authedStore() });
    expect(await screen.findByText(/no vehicle position yet/i)).toBeInTheDocument();
  });

  it('shows the empty state when the positions payload is null', async () => {
    server.use(http.get(`${API_URL}/vehiclePositions`, () => HttpResponse.json(null)));
    renderWithProviders(<DriverMapPage />, { store: authedStore() });
    expect(await screen.findByText(/no vehicle position yet/i)).toBeInTheDocument();
  });

  it('renders the map with a hint and a disabled Send button when nothing is in transit', async () => {
    // Default order-1 is dated in the past, so the driver has no in-transit delivery today.
    renderWithProviders(<DriverMapPage />, { store: authedStore() });

    expect(await screen.findByText('Driver Map')).toBeInTheDocument();
    expect(screen.getByText(/have an in-transit delivery/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send gps update/i })).toBeDisabled();
    // the driver's own vehicle marker
    expect(screen.getByText(/🚚 You/)).toBeInTheDocument();
  });

  it('renders the route, nav card and enables Send GPS for an in-transit delivery', async () => {
    const db = getDb();
    db.orders = [
      { id: 'order-1', sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 5000, deliveryDate: today(), assignedDriverId: 'driver-1', status: 'in_transit' },
      // dest hub is missing from the lookup → covers the `if (!h) return null` branch
      { id: 'order-2', sourceId: 'hub-1', destinationId: 'hub-missing', product: 'diesel', quantity: 1000, deliveryDate: today(), assignedDriverId: 'driver-1', status: 'in_transit' },
    ];
    db.vehiclePositions = [
      { id: 'pos-1', vehicleId: 'vehicle-1', driverId: 'driver-1', lat: 40, lng: -74, updatedAt: new Date().toISOString(), status: 'in_transit', trail: [{ lat: 39.9, lng: -74.1 }] },
    ];

    renderWithProviders(<DriverMapPage />, { store: authedStore() });
    await screen.findByText('Driver Map');

    // pickup + dropoff tooltips, nav card
    expect(await screen.findByText(/Pickup · Downtown/)).toBeInTheDocument();
    expect(screen.getAllByText(/Northgate/).length).toBeGreaterThan(0);
    expect(screen.getByText('Next stop')).toBeInTheDocument();
    // route polylines rendered
    expect(screen.getAllByTestId('polyline').length).toBeGreaterThan(0);

    const send = screen.getByRole('button', { name: /send gps update/i });
    expect(send).toBeEnabled();
    await userEvent.click(send);
    expect(await screen.findByText(/GPS position sent/i)).toBeInTheDocument();
  });
});
