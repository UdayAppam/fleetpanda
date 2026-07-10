import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VehicleListPanel } from './VehicleListPanel';
import type { FleetVehicle } from './useFleetData';

const vehicles: FleetVehicle[] = [
  {
    position: { id: 'pos-1', vehicleId: 'vehicle-1', driverId: 'driver-1', lat: 40, lng: -74, updatedAt: '', status: 'in_transit' },
    vehicleReg: 'TRK-101',
    driverName: 'John',
    status: 'in_transit',
    destName: 'Northgate',
    product: 'diesel',
    quantity: 5000,
  },
  {
    position: { id: 'pos-2', vehicleId: 'vehicle-2', driverId: 'driver-2', lat: 41, lng: -73, updatedAt: '', status: 'idle' },
    vehicleReg: 'TRK-202',
    driverName: 'Mary',
    status: 'idle',
  },
  {
    // A destination without product/quantity — the ` · qty product` suffix is omitted.
    position: { id: 'pos-3', vehicleId: 'vehicle-3', driverId: 'driver-3', lat: 42, lng: -72, updatedAt: '', status: 'loading' },
    vehicleReg: 'TRK-303',
    driverName: 'Sam',
    status: 'loading',
    destName: 'Eastside',
  },
];

describe('VehicleListPanel', () => {
  it('shows the count and each vehicle row', () => {
    render(<VehicleListPanel vehicles={vehicles} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('TRK-101')).toBeInTheDocument();
    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.getByText(/Northgate/)).toBeInTheDocument();
    // Destination shown without the product/quantity suffix.
    expect(screen.getByText(/Eastside/)).toBeInTheDocument();
  });

  it('reflects the selected vehicle via aria-pressed', () => {
    render(<VehicleListPanel vehicles={vehicles} selectedId="vehicle-1" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /TRK-101/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /TRK-202/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onSelect with the vehicle id when a row is clicked', async () => {
    const onSelect = vi.fn();
    render(<VehicleListPanel vehicles={vehicles} selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /TRK-202/ }));
    expect(onSelect).toHaveBeenCalledWith('vehicle-2');
  });

  it('shows an empty row when no vehicles match', () => {
    render(<VehicleListPanel vehicles={[]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText(/no vehicles match/i)).toBeInTheDocument();
  });
});
