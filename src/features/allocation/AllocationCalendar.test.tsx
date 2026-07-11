import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format, addMonths } from 'date-fns';
import { AllocationCalendar } from './AllocationCalendar';
import { today, __setToday } from '@/utils/clock';
import type { Allocation, Driver, Vehicle } from '@/types';

const realToday = today();
const TODAY = '2026-07-15';
beforeEach(() => __setToday(TODAY));
afterEach(() => __setToday(realToday));

const vehicle = new Map<string, Vehicle>([
  ['vehicle-1', { id: 'vehicle-1', registration: 'TRK-101', capacity: 8000, type: 'Tanker', status: 'available' }],
]);
const driver = new Map<string, Driver>([
  ['driver-1', { id: 'driver-1', name: 'John', license: 'DL-1', phone: '+1', status: 'available' }],
]);
const allocations: Allocation[] = [
  { id: 'alloc-1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: TODAY }, // today (editable)
  { id: 'alloc-past', vehicleId: 'veh-past', driverId: 'driver-1', date: '2026-07-10' }, // past (read-only, unknown vehicle)
  { id: 'alloc-future', vehicleId: 'vehicle-1', driverId: 'drv-x', date: '2026-07-20' }, // future (unknown driver)
];

function renderCal({ onPickDay = vi.fn(), onEditAllocation = vi.fn(), onShowDay = vi.fn() } = {}) {
  render(
    <AllocationCalendar
      allocations={allocations}
      vehicle={vehicle}
      driver={driver}
      onPickDay={onPickDay}
      onEditAllocation={onEditAllocation}
      onShowDay={onShowDay}
    />,
  );
  return { onPickDay, onEditAllocation, onShowDay };
}

describe('AllocationCalendar', () => {
  it('renders the current month header', () => {
    renderCal();
    expect(screen.getByRole('heading', { name: 'July 2026' })).toBeInTheDocument();
  });

  it('shows allocations as chips with vehicle + driver (raw-id fallbacks)', () => {
    renderCal();
    expect(screen.getByText('TRK-101 · John')).toBeInTheDocument();
    expect(screen.getByText('veh-past · John')).toBeInTheDocument(); // unknown vehicle → id
    expect(screen.getByText('TRK-101 · drv-x')).toBeInTheDocument(); // unknown driver → id
  });

  it('caps chips at three and opens the day view from "+N more"', async () => {
    const busy: Allocation[] = Array.from({ length: 5 }, (_, i) => ({
      id: `b${i}`, vehicleId: 'vehicle-1', driverId: 'driver-1', date: TODAY,
    }));
    const onShowDay = vi.fn();
    render(
      <AllocationCalendar
        allocations={busy}
        vehicle={vehicle}
        driver={driver}
        onPickDay={vi.fn()}
        onEditAllocation={vi.fn()}
        onShowDay={onShowDay}
      />,
    );
    expect(screen.getAllByRole('button', { name: 'TRK-101 · John' })).toHaveLength(3); // capped
    await userEvent.click(screen.getByRole('button', { name: /\+2 more/ }));
    expect(onShowDay).toHaveBeenCalledWith(TODAY);
  });

  it('calls onPickDay from the date number for a selectable day', async () => {
    const { onPickDay } = renderCal();
    await userEvent.click(screen.getByRole('button', { name: `Allocate on ${TODAY}` }));
    expect(onPickDay).toHaveBeenCalledWith(TODAY);
  });

  it('edits an allocation when its chip is clicked', async () => {
    const { onEditAllocation } = renderCal();
    await userEvent.click(screen.getByRole('button', { name: 'TRK-101 · John' }));
    expect(onEditAllocation).toHaveBeenCalledWith(allocations[0]);
  });

  it('renders past allocations read-only (no edit control, disabled date)', () => {
    renderCal();
    // The past chip is plain text, not an edit button.
    expect(screen.queryByRole('button', { name: /veh-past/ })).not.toBeInTheDocument();
    expect(screen.getByText('veh-past · John')).toBeInTheDocument();
    // The past date number cannot start a new allocation.
    expect(screen.getByRole('button', { name: '2026-07-10 (history)' })).toBeDisabled();
  });

  it('advances to the next month', async () => {
    renderCal();
    await userEvent.click(screen.getByRole('button', { name: /next month/i }));
    const next = format(addMonths(new Date(TODAY + 'T00:00:00'), 1), 'MMMM yyyy');
    expect(screen.getByRole('heading', { name: next })).toBeInTheDocument();
  });

  it('goes back a month and returns via the Today button', async () => {
    renderCal();
    await userEvent.click(screen.getByRole('button', { name: /previous month/i }));
    expect(screen.getByRole('heading', { name: 'June 2026' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByRole('heading', { name: 'July 2026' })).toBeInTheDocument();
  });
});
