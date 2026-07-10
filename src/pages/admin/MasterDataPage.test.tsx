import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

// react-leaflet cannot run in jsdom; stub the pieces LocationPicker (used by HubForm) needs.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  CircleMarker: () => null,
  useMap: () => ({ flyTo: vi.fn(), getZoom: () => 12, invalidateSize: vi.fn() }),
  useMapEvents: () => null,
}));

import MasterDataPage from './MasterDataPage';
import { renderWithProviders } from '@/test/renderWithProviders';
import { resetDb, getDb, server } from '@/test/mswServer';
import { API_URL } from '@/config/env';

beforeEach(() => resetDb());

// Seed varied records so every attribute filter, Badge tone, and inventory branch renders.
function seedVariety() {
  const db = getDb();
  db.hubs.push({
    id: 'hub-term',
    name: 'Harbor Terminal',
    locationType: 'terminal',
    address: 'Dock 1',
    coordinates: { lat: 41, lng: -73 },
    inventory: { diesel: 1000 },
  });
  // second product with no hub inventory -> exercises the "qty == null" skip branch
  db.products.push({ id: 'prod-petrol', key: 'petrol', name: 'Petrol Gold', unit: 'L', lowStockThreshold: 100, tankCapacity: 5000 });
  db.drivers.push({ id: 'driver-2', name: 'Mary', license: 'DL-2', phone: '+222222', status: 'on_shift' });
  db.vehicles.push(
    { id: 'veh-shift', registration: 'TRK-202', capacity: 9000, type: 'Tanker', status: 'on_shift' },
    { id: 'veh-maint', registration: 'TRK-303', capacity: 7000, type: 'Rigid', status: 'maintenance' },
  );
}

async function gotoTab(name: RegExp) {
  await userEvent.click(screen.getByRole('button', { name }));
}

describe('MasterDataPage', () => {
  it('renders the locations tab by default', async () => {
    seedVariety();
    renderWithProviders(<MasterDataPage />);
    expect(await screen.findByText('Downtown')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Master Data' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hubs & Terminals' })).toBeInTheDocument();
    // terminal Badge (info tone) + hub Badge (neutral tone)
    expect(screen.getByText('terminal')).toBeInTheDocument();
    expect(screen.getAllByText('hub').length).toBeGreaterThan(0);
    // inventory chip rendered for diesel (present); petrol is skipped where absent
    expect(screen.getAllByText('Diesel').length).toBeGreaterThan(0);
  });

  it('switches between all four rail tabs', async () => {
    seedVariety();
    renderWithProviders(<MasterDataPage />);
    await screen.findByText('Downtown');

    await gotoTab(/Products/);
    expect(await screen.findByRole('heading', { name: 'Products' })).toBeInTheDocument();
    expect(screen.getByText('Diesel')).toBeInTheDocument();

    await gotoTab(/Drivers/);
    expect(await screen.findByRole('heading', { name: 'Drivers' })).toBeInTheDocument();
    expect(screen.getByText('John')).toBeInTheDocument();

    await gotoTab(/Vehicles/);
    expect(await screen.findByRole('heading', { name: 'Vehicles' })).toBeInTheDocument();
    expect(screen.getByText('TRK-101')).toBeInTheDocument();
  });

  it('filters locations by attribute chips and search', async () => {
    seedVariety();
    renderWithProviders(<MasterDataPage />);
    await screen.findByText('Downtown');

    await userEvent.click(screen.getByRole('tab', { name: /Terminals/ }));
    expect(screen.getByText('Harbor Terminal')).toBeInTheDocument();
    expect(screen.queryByText('Downtown')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /^Hubs/ }));
    expect(screen.getByText('Downtown')).toBeInTheDocument();
    expect(screen.queryByText('Harbor Terminal')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search'), 'harbor');
    await waitFor(() => expect(screen.queryByText('Downtown')).not.toBeInTheDocument());
  });

  it('filters drivers by status chips', async () => {
    seedVariety();
    renderWithProviders(<MasterDataPage />);
    await screen.findByText('Downtown');
    await gotoTab(/Drivers/);
    await screen.findByText('John');

    await userEvent.click(screen.getByRole('tab', { name: /On shift/ }));
    expect(screen.getByText('Mary')).toBeInTheDocument();
    expect(screen.queryByText('John')).not.toBeInTheDocument();
  });

  it('renders all vehicle Badge tones and filters by maintenance', async () => {
    seedVariety();
    renderWithProviders(<MasterDataPage />);
    await screen.findByText('Downtown');
    await gotoTab(/Vehicles/);
    await screen.findByText('TRK-101');

    expect(screen.getByText('available')).toBeInTheDocument();
    expect(screen.getByText('on shift')).toBeInTheDocument();
    expect(screen.getByText('maintenance')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /Maintenance/ }));
    expect(screen.getByText('TRK-303')).toBeInTheDocument();
    expect(screen.queryByText('TRK-101')).not.toBeInTheDocument();
  });

  it('creates a new location', async () => {
    renderWithProviders(<MasterDataPage />);
    await screen.findByText('Downtown');

    await userEvent.click(screen.getByRole('button', { name: 'New Location' }));
    const dialog = await screen.findByRole('dialog', { name: 'New Location' });
    await userEvent.type(within(dialog).getByLabelText('Name'), 'New Depot');
    // the Address field's label also carries a hint, so match on the leading text
    await userEvent.type(within(dialog).getByLabelText(/^Address/), '500 Main St');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New Location' })).not.toBeInTheDocument());
  });

  it('creates a new product', async () => {
    renderWithProviders(<MasterDataPage />);
    await screen.findByText('Downtown');
    await gotoTab(/Products/);
    await screen.findByText('Diesel');

    await userEvent.click(screen.getByRole('button', { name: 'New Product' }));
    const dialog = await screen.findByRole('dialog', { name: 'New Product' });
    await userEvent.type(within(dialog).getByLabelText(/Key/), 'kerosene');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Kerosene');
    await userEvent.type(within(dialog).getByLabelText(/Low-stock threshold/), '50');
    await userEvent.type(within(dialog).getByLabelText(/Max tank capacity/), '2000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New Product' })).not.toBeInTheDocument());
  });

  it('creates a new driver', async () => {
    renderWithProviders(<MasterDataPage />);
    await screen.findByText('Downtown');
    await gotoTab(/Drivers/);
    await screen.findByText('John');

    await userEvent.click(screen.getByRole('button', { name: 'New Driver' }));
    const dialog = await screen.findByRole('dialog', { name: 'New Driver' });
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Sam Rider');
    await userEvent.type(within(dialog).getByLabelText('License'), 'DL-900');
    await userEvent.type(within(dialog).getByLabelText('Phone'), '+1999999');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New Driver' })).not.toBeInTheDocument());
  });

  it('creates a new vehicle', async () => {
    renderWithProviders(<MasterDataPage />);
    await screen.findByText('Downtown');
    await gotoTab(/Vehicles/);
    await screen.findByText('TRK-101');

    await userEvent.click(screen.getByRole('button', { name: 'New Vehicle' }));
    const dialog = await screen.findByRole('dialog', { name: 'New Vehicle' });
    await userEvent.type(within(dialog).getByLabelText('Registration'), 'TRK-777');
    await userEvent.type(within(dialog).getByLabelText(/Capacity/), '4000');
    await userEvent.type(within(dialog).getByLabelText('Type'), 'Rigid');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New Vehicle' })).not.toBeInTheDocument());
  });

  it('edits an existing location', async () => {
    renderWithProviders(<MasterDataPage />);
    await screen.findByText('Downtown');

    await userEvent.click(screen.getAllByLabelText('Edit')[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Edit Location' });
    const name = within(dialog).getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Downtown HQ');
    // seeded hub-1 address ("x") is too short for the schema — set a valid one
    const address = within(dialog).getByLabelText(/^Address/);
    await userEvent.clear(address);
    await userEvent.type(address, '1 Market Street');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit Location' })).not.toBeInTheDocument());
  });

  it('deletes a location after confirmation', async () => {
    renderWithProviders(<MasterDataPage />);
    await screen.findByText('Downtown');

    await userEvent.click(screen.getAllByLabelText('Delete')[0]);
    // row delete buttons also carry aria-label "Delete", so scope to the confirm dialog
    const confirmDialog = await screen.findByRole('dialog', { name: 'Delete record?' });
    await userEvent.click(within(confirmDialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Downtown')).not.toBeInTheDocument());
  });

  it('keeps a vehicle when the delete confirm is cancelled', async () => {
    seedVariety();
    renderWithProviders(<MasterDataPage />);
    await screen.findByText('Downtown');
    await gotoTab(/Vehicles/);
    await screen.findByText('TRK-101');

    await userEvent.click(screen.getAllByLabelText('Delete')[0]);
    const cancelBtn = await screen.findByRole('button', { name: 'Cancel' });
    await userEvent.click(cancelBtn);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument());
    expect(screen.getByText('TRK-101')).toBeInTheDocument();
  });

  it('renders an error state when the hubs request fails and retries', async () => {
    server.use(http.get(`${API_URL}/hubs`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    renderWithProviders(<MasterDataPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/boom|failed/i);
    await userEvent.click(screen.getByRole('button', { name: /Retry/i }));
  });

  it('tolerates null products/drivers/vehicles payloads across every tab', async () => {
    server.use(
      http.get(`${API_URL}/products`, () => HttpResponse.json(null)),
      http.get(`${API_URL}/drivers`, () => HttpResponse.json(null)),
      http.get(`${API_URL}/vehicles`, () => HttpResponse.json(null)),
    );
    renderWithProviders(<MasterDataPage />);
    // locations tab still renders; its inventory chips read `products.data ?? []`
    await screen.findByText('Downtown');

    await gotoTab(/Products/);
    expect(await screen.findByRole('heading', { name: 'Products' })).toBeInTheDocument();
    await gotoTab(/Drivers/);
    expect(await screen.findByRole('heading', { name: 'Drivers' })).toBeInTheDocument();
    await gotoTab(/Vehicles/);
    expect(await screen.findByRole('heading', { name: 'Vehicles' })).toBeInTheDocument();
  });

  it('evaluates all fallback columns of the search predicate on each tab', async () => {
    seedVariety();
    renderWithProviders(<MasterDataPage />);
    await screen.findByText('Downtown');

    await gotoTab(/Products/);
    await screen.findByText('Diesel');
    await userEvent.type(screen.getByLabelText('Search'), 'zzz');
    await waitFor(() => expect(screen.queryByText('Diesel')).not.toBeInTheDocument());

    await gotoTab(/Drivers/);
    await screen.findByText('John');
    await userEvent.type(screen.getByLabelText('Search'), 'zzz');
    await waitFor(() => expect(screen.queryByText('John')).not.toBeInTheDocument());

    await gotoTab(/Vehicles/);
    await screen.findByText('TRK-101');
    await userEvent.type(screen.getByLabelText('Search'), 'zzz');
    await waitFor(() => expect(screen.queryByText('TRK-101')).not.toBeInTheDocument());
  });

  it('closes the create and edit drawers via their Close controls', async () => {
    renderWithProviders(<MasterDataPage />);
    await screen.findByText('Downtown');

    await userEvent.click(screen.getByRole('button', { name: 'New Location' }));
    await screen.findByRole('dialog', { name: 'New Location' });
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New Location' })).not.toBeInTheDocument());

    await userEvent.click(screen.getAllByLabelText('Edit')[0]);
    await screen.findByRole('dialog', { name: 'Edit Location' });
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit Location' })).not.toBeInTheDocument());
  });
});
