import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format, addMonths } from 'date-fns';
import { AllocationCalendar } from './AllocationCalendar';
import { today } from '@/utils/clock';
import type { Allocation, Driver, Vehicle } from '@/types';

const todayIso = today();
const vehicle = new Map<string, Vehicle>([
  ['vehicle-1', { id: 'vehicle-1', registration: 'TRK-101', capacity: 8000, type: 'Tanker', status: 'available' }],
]);
const driver = new Map<string, Driver>([
  ['driver-1', { id: 'driver-1', name: 'John', license: 'DL-1', phone: '+1', status: 'available' }],
]);
const allocations: Allocation[] = [
  { id: 'alloc-1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: todayIso },
];

function renderCal(onPickDay = vi.fn()) {
  render(
    <AllocationCalendar
      allocations={allocations}
      vehicle={vehicle}
      driver={driver}
      onPickDay={onPickDay}
    />,
  );
  return onPickDay;
}

describe('AllocationCalendar', () => {
  it('renders the current month header', () => {
    renderCal();
    const heading = format(new Date(todayIso + 'T00:00:00'), 'MMMM yyyy');
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('shows an allocation chip with the vehicle registration', () => {
    renderCal();
    expect(screen.getAllByText('TRK-101').length).toBeGreaterThan(0);
  });

  it('calls onPickDay with the ISO date for a selectable day', async () => {
    const onPickDay = renderCal();
    await userEvent.click(screen.getByRole('button', { name: `Allocate on ${todayIso}` }));
    expect(onPickDay).toHaveBeenCalledWith(todayIso);
  });

  it('advances to the next month', async () => {
    renderCal();
    await userEvent.click(screen.getByRole('button', { name: /next month/i }));
    const next = format(addMonths(new Date(todayIso + 'T00:00:00'), 1), 'MMMM yyyy');
    expect(screen.getByRole('heading', { name: next })).toBeInTheDocument();
  });

  it('goes back to the previous month and returns via the Today button', async () => {
    renderCal();
    await userEvent.click(screen.getByRole('button', { name: /previous month/i }));
    const prev = format(addMonths(new Date(todayIso + 'T00:00:00'), -1), 'MMMM yyyy');
    expect(screen.getByRole('heading', { name: prev })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Today' }));
    const current = format(new Date(todayIso + 'T00:00:00'), 'MMMM yyyy');
    expect(screen.getByRole('heading', { name: current })).toBeInTheDocument();
  });

  it('caps chips at three, showing a +N overflow and the raw id when a vehicle is unknown', () => {
    const many: Allocation[] = [
      { id: 'm1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: todayIso },
      { id: 'm2', vehicleId: 'vehicle-2', driverId: 'driver-1', date: todayIso },
      { id: 'm3', vehicleId: 'vehicle-3', driverId: 'driver-1', date: todayIso },
      { id: 'm4', vehicleId: 'vehicle-4', driverId: 'driver-1', date: todayIso },
    ];
    render(
      <AllocationCalendar allocations={many} vehicle={vehicle} driver={driver} onPickDay={vi.fn()} />,
    );
    // Four allocations on one day → three chips + a "+1" overflow marker.
    expect(screen.getByText('+1')).toBeInTheDocument();
    // Unknown vehicle ids fall back to the raw id string.
    expect(screen.getByText('vehicle-2')).toBeInTheDocument();
  });
});
