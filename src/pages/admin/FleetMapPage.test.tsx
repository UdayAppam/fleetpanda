import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { reactLeafletMock } from '@/test/reactLeafletMock';

vi.mock('react-leaflet', () => reactLeafletMock);

import FleetMapPage from './FleetMapPage';
import { renderWithProviders } from '@/test/renderWithProviders';
import { resetDb, getDb, server } from '@/test/mswServer';
import { API_URL } from '@/config/env';
import { today } from '@/utils/clock';

beforeEach(() => resetDb());

// Seed a rich fleet: an in-transit vehicle with a trail (route + trail branches), a
// second in-transit vehicle (so `dim` applies to the non-selected one), and an idle
// vehicle (so the non-moving tooltip / no-cargo / no-dest branches render too).
function seedFleet() {
  const db = getDb();
  db.orders = [
    { id: 'order-1', sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 5000, deliveryDate: today(), assignedDriverId: 'driver-1', status: 'in_transit' },
    // quantity 0 exercises the "no cargo / empty quantity" branches on markers + tooltips.
    { id: 'order-2', sourceId: 'hub-3', destinationId: 'hub-1', product: 'petrol', quantity: 0, deliveryDate: today(), assignedDriverId: 'driver-2', status: 'in_transit' },
  ];
  db.vehiclePositions = [
    { id: 'pos-1', vehicleId: 'vehicle-1', driverId: 'driver-1', lat: 40, lng: -74, updatedAt: new Date().toISOString(), status: 'in_transit', trail: [{ lat: 39.9, lng: -74.1 }] },
    { id: 'pos-2', vehicleId: 'vehicle-2', driverId: 'driver-2', lat: 40.7, lng: -73.9, updatedAt: new Date().toISOString(), status: 'in_transit' },
    { id: 'pos-3', vehicleId: 'vehicle-3', driverId: 'driver-3', lat: 41, lng: -73, updatedAt: new Date().toISOString(), status: 'idle' },
  ];
  db.drivers.push(
    { id: 'driver-2', name: 'Mary', license: 'DL-2', phone: '+2', status: 'available' },
    { id: 'driver-3', name: 'Sam', license: 'DL-3', phone: '+3', status: 'available' },
  );
  db.vehicles.push(
    { id: 'vehicle-2', registration: 'TRK-202', capacity: 8000, type: 'Tanker', status: 'available' },
    { id: 'vehicle-3', registration: 'TRK-303', capacity: 8000, type: 'Tanker', status: 'available' },
  );
}

describe('FleetMapPage', () => {
  it('shows a loading spinner before data resolves', () => {
    renderWithProviders(<FleetMapPage />);
    expect(screen.getByText(/loading fleet/i)).toBeInTheDocument();
  });

  it('renders an error state and retries when positions fail to load', async () => {
    server.use(http.get(`${API_URL}/vehiclePositions`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    renderWithProviders(<FleetMapPage />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/boom|failed/i);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
  });

  it('renders vehicles on the map with routes, endpoints and the list panel', async () => {
    seedFleet();
    renderWithProviders(<FleetMapPage />);

    expect(await screen.findByText('Live Fleet Map')).toBeInTheDocument();
    // route casing + animated + trail polylines rendered
    expect(screen.getAllByTestId('polyline').length).toBeGreaterThan(0);
    // hub + endpoint + truck markers rendered
    expect(screen.getAllByTestId('marker').length).toBeGreaterThan(0);
    // list panel mirrors the trucks
    expect(screen.getAllByText('TRK-101').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TRK-303').length).toBeGreaterThan(0);
  });

  it('selects a vehicle when its marker is clicked', async () => {
    seedFleet();
    renderWithProviders(<FleetMapPage />);
    await screen.findByText('Live Fleet Map');

    const truck = screen.getAllByTestId('marker').find((m) => m.textContent?.includes('TRK-101'));
    expect(truck).toBeTruthy();
    await userEvent.click(truck!);

    await waitFor(() => {
      const pressed = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true');
      expect(pressed.length).toBeGreaterThan(0);
    });
  });

  it('selects a vehicle from the list panel', async () => {
    seedFleet();
    renderWithProviders(<FleetMapPage />);
    await screen.findByText('Live Fleet Map');

    // The list-panel rows carry aria-pressed (the map markers are buttons too).
    const row = screen.getAllByRole('button', { name: /TRK-303/ }).find((b) => b.hasAttribute('aria-pressed'));
    expect(row).toBeTruthy();
    await userEvent.click(row!);
    expect(row).toHaveAttribute('aria-pressed', 'true');
  });

  it('applies the driver / vehicle / status filters and clears them', async () => {
    seedFleet();
    renderWithProviders(<FleetMapPage />);
    await screen.findByText('Live Fleet Map');

    // The vehicle registrations also appear as <option>s in the filter selects, so we assert
    // on the rendered list-panel / marker BUTTONS (which disappear when filtered out).
    await userEvent.selectOptions(screen.getByLabelText('Filter by driver'), 'driver-1');
    await waitFor(() => expect(screen.queryByRole('button', { name: /TRK-202/ })).not.toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText('Filter by driver'), '');
    await userEvent.selectOptions(screen.getByLabelText('Filter by vehicle'), 'vehicle-1');
    await waitFor(() => expect(screen.queryByRole('button', { name: /TRK-303/ })).not.toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText('Filter by vehicle'), '');
    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), 'in_transit');
    await waitFor(() => expect(screen.queryByRole('button', { name: /TRK-303/ })).not.toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), '');
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /TRK-303/ }).length).toBeGreaterThan(0));
  });

  it('shows an empty list when the filters match nothing', async () => {
    seedFleet();
    renderWithProviders(<FleetMapPage />);
    await screen.findByText('Live Fleet Map');

    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), 'loading');
    expect(await screen.findByText(/no vehicles match/i)).toBeInTheDocument();
  });

  it('toggles auto-refresh and triggers a manual refresh', async () => {
    seedFleet();
    renderWithProviders(<FleetMapPage />);
    await screen.findByText('Live Fleet Map');

    await userEvent.click(screen.getByRole('button', { name: /Auto 30s/ }));
    expect(screen.getByRole('button', { name: /Paused/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Refresh/ })).toBeInTheDocument());
  });

  it('spins the refresh icon while a manual refetch is in flight', async () => {
    seedFleet();
    server.use(
      http.get(`${API_URL}/vehiclePositions`, async () => {
        await delay(150);
        return HttpResponse.json(getDb().vehiclePositions);
      }),
    );
    renderWithProviders(<FleetMapPage />);
    await screen.findByText('Live Fleet Map');

    const refresh = screen.getByRole('button', { name: /Refresh/ });
    await userEvent.click(refresh);
    await waitFor(() => expect(refresh.querySelector('svg')).toHaveClass('spin'));
    // and it stops spinning once the refetch settles
    await waitFor(() => expect(refresh.querySelector('svg')).not.toHaveClass('spin'));
  });
});
