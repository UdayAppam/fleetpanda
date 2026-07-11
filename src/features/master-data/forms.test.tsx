import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// react-leaflet cannot run in jsdom; stub the pieces LocationPicker (used by HubForm) needs.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  CircleMarker: () => null,
  useMap: () => ({ flyTo: vi.fn(), getZoom: () => 12, invalidateSize: vi.fn() }),
  useMapEvents: () => null,
}));

// Stub the picker with buttons that drive HubForm's onChange/onAddress callbacks directly.
vi.mock('./LocationPicker', () => ({
  LocationPicker: ({
    onChange,
    onAddress,
  }: {
    onChange: (lat: number, lng: number) => void;
    onAddress?: (address: string) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onChange(12.34, 56.78)}>
        pick-coords
      </button>
      <button type="button" onClick={() => onAddress?.('123 Mock St')}>
        pick-address
      </button>
    </div>
  ),
}));

import { ProductForm, DriverForm, VehicleForm, HubForm } from './forms';
import { renderWithProviders } from '@/test/renderWithProviders';
import { resetDb } from '@/test/mswServer';

beforeEach(() => resetDb());

describe('DriverForm', () => {
  it('validates required fields', async () => {
    render(<DriverForm onSubmit={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });

  it('submits valid values', async () => {
    const onSubmit = vi.fn();
    render(<DriverForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Name'), 'John Doe');
    await userEvent.type(screen.getByLabelText('License'), 'DL-1234');
    await userEvent.type(screen.getByLabelText('Phone'), '+15551234');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ name: 'John Doe', license: 'DL-1234' });
  });

  it('passes the id through when editing an existing driver', async () => {
    const onSubmit = vi.fn();
    render(
      <DriverForm
        initial={{ id: 'driver-9', name: 'Jane', license: 'DL-9', phone: '+15550009', status: 'available' }}
        onSubmit={onSubmit}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][1]).toBe('driver-9');
  });
});

describe('VehicleForm', () => {
  it('submits valid values with coerced capacity', async () => {
    const onSubmit = vi.fn();
    render(<VehicleForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Registration'), 'TRK-999');
    await userEvent.type(screen.getByLabelText(/capacity/i), '8000');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ registration: 'TRK-999', capacity: 8000 });
  });

  it('shows field errors when required values are missing', async () => {
    const onSubmit = vi.fn();
    render(<VehicleForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    // Registration + capacity errors render via errors.<field>?.message and block submit.
    expect(await screen.findByText(/registration is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('passes the id through when editing an existing vehicle', async () => {
    const onSubmit = vi.fn();
    render(
      <VehicleForm
        initial={{ id: 'vehicle-9', registration: 'TRK-909', capacity: 8000, type: 'Tanker', status: 'available' }}
        onSubmit={onSubmit}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][1]).toBe('vehicle-9');
  });

  it('surfaces a per-field error for a cleared type', async () => {
    const onSubmit = vi.fn();
    render(
      <VehicleForm
        initial={{ id: 'vehicle-1', registration: 'TRK-101', capacity: 8000, type: 'Tanker', status: 'available' }}
        onSubmit={onSubmit}
      />,
    );
    await userEvent.clear(screen.getByLabelText('Type'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    // errors.type?.message renders (forms.tsx line 207 truthy branch).
    expect(await screen.findByText(/type is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('ProductForm', () => {
  it('rejects a low-stock threshold above tank capacity', async () => {
    render(<ProductForm onSubmit={() => {}} />);
    await userEvent.type(screen.getByLabelText(/key/i), 'petrol');
    await userEvent.type(screen.getByLabelText('Name'), 'Petrol');
    await userEvent.type(screen.getByLabelText(/low-stock threshold/i), '9000');
    await userEvent.type(screen.getByLabelText(/max tank capacity/i), '5000');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText(/can’t exceed tank capacity/i)).toBeInTheDocument();
  });

  it('shows the tank-capacity error when required fields are empty', async () => {
    const onSubmit = vi.fn();
    render(<ProductForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    // A blank capacity triggers errors.tankCapacity?.message (forms.tsx line 153).
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('surfaces a per-field error for a cleared unit', async () => {
    const onSubmit = vi.fn();
    render(
      <ProductForm
        initial={{ id: 'prod-1', key: 'diesel', name: 'Diesel', unit: 'L', lowStockThreshold: 100, tankCapacity: 20000 }}
        onSubmit={onSubmit}
      />,
    );
    await userEvent.clear(screen.getByLabelText('Unit'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    // errors.unit?.message renders as a role="alert" (forms.tsx line 139 truthy branch).
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('passes the id through when editing an existing product', async () => {
    const onSubmit = vi.fn();
    render(
      <ProductForm
        initial={{ id: 'prod-diesel', key: 'diesel', name: 'Diesel', unit: 'L', lowStockThreshold: 5000, tankCapacity: 20000 }}
        onSubmit={onSubmit}
      />,
    );
    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'Diesel Plus');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][1]).toBe('prod-diesel');
  });
});

describe('HubForm', () => {
  it('renders with default coordinates and the inventory field for each product', async () => {
    renderWithProviders(<HubForm onSubmit={() => {}} />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText(/Latitude/)).toHaveValue(40.7128);
    expect(await screen.findByLabelText(/Diesel/)).toBeInTheDocument();
  });

  it('validates the required name', async () => {
    renderWithProviders(<HubForm onSubmit={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });

  it('pre-fills every field when editing an existing hub and submits with its id', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <HubForm
        initial={{
          id: 'hub-9',
          name: 'Depot 9',
          locationType: 'terminal',
          address: '9 Main Street',
          coordinates: { lat: 41, lng: -73 },
          inventory: { diesel: 100 },
        }}
        onSubmit={onSubmit}
      />,
    );
    await screen.findByLabelText(/Diesel/);
    expect(screen.getByLabelText('Name')).toHaveValue('Depot 9');
    expect(screen.getByLabelText(/Latitude/)).toHaveValue(41);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][1]).toBe('hub-9');
  });

  it('shows a coordinate error for an out-of-range latitude', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<HubForm onSubmit={onSubmit} />);
    await screen.findByLabelText(/Diesel/);
    await userEvent.type(screen.getByLabelText('Name'), 'Depot X');
    await userEvent.type(screen.getByLabelText(/Address/), '1 Main Street');

    // Latitude has no native max attribute, so an out-of-range value reaches the zod resolver
    // and surfaces errors.coordinates?.lat?.message (forms.tsx lines 90-93).
    const lat = screen.getByLabelText(/Latitude/);
    await userEvent.clear(lat);
    await userEvent.type(lat, '999');
    const lng = screen.getByLabelText(/Longitude/);
    await userEvent.clear(lng);
    await userEvent.type(lng, '999');

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    // Both errors.coordinates?.lat?.message and ...lng?.message render (forms.tsx lines 90-93).
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(2));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('writes picker coordinates + address into the form and submits them', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<HubForm onSubmit={onSubmit} />);
    await screen.findByLabelText(/Diesel/);
    await userEvent.type(screen.getByLabelText('Name'), 'Depot X');
    await userEvent.click(screen.getByText('pick-coords'));
    await userEvent.click(screen.getByText('pick-address'));
    expect(screen.getByLabelText(/Latitude/)).toHaveValue(12.34);
    expect(screen.getByLabelText(/Longitude/)).toHaveValue(56.78);
    expect(screen.getByLabelText(/Address/)).toHaveValue('123 Mock St');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: 'Depot X',
      address: '123 Mock St',
      coordinates: { lat: 12.34, lng: 56.78 },
    });
  });
});
