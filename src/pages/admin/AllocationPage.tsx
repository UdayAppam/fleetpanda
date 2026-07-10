import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CalendarPlus, AlertTriangle, PackageCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Select, Input } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/misc';
import { AllocationCalendar } from '@/features/allocation/AllocationCalendar';
import { useAllocationMutations } from '@/features/allocation/mutations';
import { useAllocations, useOrders, usePositions } from '@/hooks/queries';
import { useLookups } from '@/hooks/useLookups';
import { hasAllocationConflict } from '@/services/rules';
import { driverDayPlan, fmtDuration, SHIFT_HOURS } from '@/services/logistics';
import { today } from '@/utils/clock';
import { fmtQty } from '@/utils/format';
import { Clock, GaugeCircle } from 'lucide-react';
import type { Order } from '@/types';
import formStyles from '@/features/master-data/forms.module.css';

const ACTIVE = (o: Order) => o.status !== 'delivered' && o.status !== 'failed';

export default function AllocationPage() {
  const allocations = useAllocations();
  const orders = useOrders();
  const positions = usePositions();
  const { vehicle, driver, hub, vehicles, drivers, loading } = useLookups();
  const { create } = useAllocationMutations();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');

  const list = allocations.data ?? [];
  const conflict = vehicleId ? hasAllocationConflict(list, vehicleId, date) : false;
  const pastDate = date < today(); // can't allocate in the past — HARD block

  const openFor = (iso: string, presetDriver = '') => {
    setDate(iso);
    setVehicleId('');
    setDriverId(presetDriver);
    setOpen(true);
  };

  // Deep-link prefill from dashboard CTAs: { driverId, date }.
  useEffect(() => {
    const st = location.state as { driverId?: string | null; date?: string } | null;
    if (st?.date) openFor(st.date, st.driverId ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Order-aware: the selected driver's live load for the day, and any source-stock shortfalls.
  const dayOrders = useMemo<Order[]>(
    () =>
      driverId
        ? (orders.data ?? []).filter((o) => o.assignedDriverId === driverId && o.deliveryDate === date && ACTIVE(o))
        : [],
    [orders.data, driverId, date],
  );
  const dayLoad = dayOrders.reduce((n, o) => n + o.quantity, 0);
  /* v8 ignore next -- a selectable vehicle always resolves in the same lookup, so capacity is never nullish */
  const selectedCapacity = vehicleId ? vehicle.get(vehicleId)?.capacity ?? 0 : 0;
  const overCapacity = Boolean(vehicleId && dayLoad > selectedCapacity); // HARD block

  // Vehicle's live position folds a deadhead (current → first pickup) into the shift time.
  const vehiclePos = vehicleId
    ? (positions.data ?? []).find((p) => p.vehicleId === vehicleId)
    : undefined;
  const startFrom = vehiclePos ? { lat: vehiclePos.lat, lng: vehiclePos.lng } : undefined;

  // Driver-day feasibility: does the run fit an 8h shift? (warn) + tanker utilisation.
  const plan = useMemo(
    () => driverDayPlan(dayOrders, (id) => hub.get(id)?.coordinates, selectedCapacity || null, startFrom),
    [dayOrders, hub, selectedCapacity, startFrom],
  );
  const overbooked = dayOrders.length > 0 && !plan.feasible; // WARN
  const underutilised = Boolean(vehicleId && plan.underutilised); // WARN

  // Stock shortfalls are a WARNING (non-blocking) — stock may be replenished before the date.
  const stockShortfalls = useMemo(
    () =>
      dayOrders
        .map((o) => {
          const have = hub.get(o.sourceId)?.inventory[o.product] ?? 0;
          return have < o.quantity
            ? { orderId: o.id, hubName: hub.get(o.sourceId)?.name ?? o.sourceId, product: o.product, shortBy: o.quantity - have }
            : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [dayOrders, hub],
  );

  const submit = () => {
    /* v8 ignore next -- this guard mirrors the Allocate button's disabled prop, so it can't run while true */
    if (!vehicleId || !driverId || conflict || overCapacity || pastDate) return;
    create.mutate({ vehicleId, driverId, date }, { onSuccess: () => setOpen(false) });
  };

  if (loading || allocations.isLoading || orders.isLoading) return <Spinner label="Loading allocations…" />;

  return (
    <div>
      <PageHeader
        eyebrow="Planning"
        title="Vehicle Allocation"
        actions={
          <Button icon={<CalendarPlus size={16} />} onClick={() => openFor(today())}>
            Allocate Vehicle
          </Button>
        }
      />
      <AllocationCalendar allocations={list} vehicle={vehicle} driver={driver} onPickDay={openFor} />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Allocate Vehicle"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              loading={create.isPending}
              disabled={!vehicleId || !driverId || conflict || overCapacity || pastDate}
            >
              Allocate
            </Button>
          </>
        }
      >
        <div className={formStyles.form}>
          <Field label="Date" error={pastDate ? 'Can’t allocate for a past date' : undefined}>
            <Input type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Driver" hint={driverId ? `${dayOrders.length} order(s) today · ${fmtQty(dayLoad)} to carry` : undefined}>
            <Select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              <option value="">Select…</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vehicle" hint={driverId && dayLoad > 0 ? 'Too-small, in-maintenance and already-booked vehicles are disabled' : undefined}>
            <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">Select…</option>
              {vehicles.map((v) => {
                const tooSmall = dayLoad > 0 && v.capacity < dayLoad;
                const inMaintenance = v.status === 'maintenance';
                const booked = hasAllocationConflict(list, v.id, date);
                const reason = tooSmall ? 'too small' : inMaintenance ? 'maintenance' : booked ? 'booked' : '';
                return (
                  <option key={v.id} value={v.id} disabled={Boolean(reason)}>
                    {v.registration} · {fmtQty(v.capacity)}
                    {reason ? ` — ${reason}` : ''}
                  </option>
                );
              })}
            </Select>
          </Field>

          {conflict && (
            <div className={formStyles.opCrit} role="alert">
              <AlertTriangle size={16} />
              <span>
                {vehicle.get(vehicleId)?.registration} is already allocated on {date}
              </span>
            </div>
          )}
          {overCapacity && !conflict && (
            <div className={formStyles.opCrit} role="alert">
              <AlertTriangle size={16} />
              <span>
                {vehicle.get(vehicleId)?.registration} ({fmtQty(selectedCapacity)}) can’t carry the day’s load of{' '}
                {fmtQty(dayLoad)}. Pick a larger vehicle.
              </span>
            </div>
          )}
          {vehicleId && !conflict && !overCapacity && dayLoad > 0 && (
            <div className={formStyles.opOk}>
              <PackageCheck size={16} />
              <span>
                {vehicle.get(vehicleId)?.registration} fits the day’s load ({fmtQty(dayLoad)} of {fmtQty(selectedCapacity)}).
              </span>
            </div>
          )}
          {driverId && dayOrders.length > 0 && (
            <div className={overbooked ? formStyles.opWarn : formStyles.opOk}>
              <Clock size={16} />
              <span>
                {dayOrders.length} deliveries ≈ {fmtDuration(plan.totalMinutes)} of driving over ~
                {Math.round(plan.totalKm)} km
                {plan.reposition && plan.reposition.km > 0.5
                  ? ` (incl. ${Math.round(plan.reposition.km)} km / ${fmtDuration(plan.reposition.minutes)} to reach the first pickup from ${vehicle.get(vehicleId)?.registration}'s current location)`
                  : ''}
                .{' '}
                {overbooked
                  ? `That overruns the ${SHIFT_HOURS}h shift by ${fmtDuration(plan.overMinutes)} — consider splitting the run.`
                  : `Fits the ${SHIFT_HOURS}h shift.`}
              </span>
            </div>
          )}
          {underutilised && (
            <div className={formStyles.opWarn}>
              <GaugeCircle size={16} />
              <span>
                {/* v8 ignore next -- underutilised is only true when plan.utilisation is non-null */}
                Only {Math.round((plan.utilisation ?? 0) * 100)}% of {vehicle.get(vehicleId)?.registration} used — a
                smaller tanker would be more efficient.
              </span>
            </div>
          )}
          {stockShortfalls.length > 0 && (
            <div className={formStyles.opWarn} role="alert">
              <AlertTriangle size={16} />
              <span>
                Stock warning — {stockShortfalls.map((s) => `${s.hubName} short ${fmtQty(s.shortBy)} ${s.product}`).join('; ')}.
                You can still allocate; the shift won’t start until stock is replenished.
              </span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
