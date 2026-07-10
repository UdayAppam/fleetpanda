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
});
