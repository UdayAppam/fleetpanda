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

  it('writes picker coordinates + address into the form and submits them', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<HubForm onSubmit={onSubmit} />);
    await screen.findByLabelText(/Diesel/);
    await userEvent.type(screen.getByLabelText('Name'), 'Depot X');
    await userEvent.click(screen.getByRole('button', { name: /pick-coords/ }));
    await userEvent.click(screen.getByRole('button', { name: /pick-address/ }));
    expect(screen.getByLabelText(/Latitude/)).toHaveValue(12.34);
    expect(screen.getByLabelText(/Longitude/)).toHaveValue(56.78);
    expect(screen.getByLabelText('Address')).toHaveValue('123 Mock St');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: 'Depot X',
      address: '123 Mock St',
      coordinates: { lat: 12.34, lng: 56.78 },
    });
  });
});
