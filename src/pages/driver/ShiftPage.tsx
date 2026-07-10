import { Play, Square, Truck, Info, Clock, Route, MapPin, Package, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, Spinner, ErrorState } from '@/components/ui/misc';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DeliveryManager } from '@/features/deliveries/DeliveryManager';
import { usePositions } from '@/hooks/queries';
import { useDriverDay } from '@/features/driver-shift/useDriverDay';
import { useShiftMutations } from '@/features/driver-shift/mutations';
import { useConfirm } from '@/contexts/ConfirmContext';
import { driverDayPlan, sequenceOrders, fmtDuration, etaEnd } from '@/services/logistics';
import { fmtDate, fmtQty, fmtTime } from '@/utils/format';
import { today } from '@/utils/clock';
import styles from './ShiftPage.module.css';

export default function ShiftPage() {
  const day = useDriverDay();
  const positions = usePositions();
  const { start, end } = useShiftMutations();
  const confirm = useConfirm();

  if (day.isLoading) return <Spinner label="Loading your shift…" />;
  if (day.error) return <ErrorState message={(day.error as Error).message} onRetry={day.refetch} />;

  const active = day.activeShift;
  const totalQty = day.orders.reduce((n, o) => n + o.quantity, 0);
  const delivered = day.orders.filter((o) => o.status === 'delivered').length;
  const failed = day.orders.filter((o) => o.status === 'failed').length;
  const done = delivered + failed;
  const total = day.orders.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const coordOf = (id: string) => day.hub.get(id)?.coordinates;
  const myPos = (positions.data ?? []).find((p) => p.driverId === day.driverId);
  const startFrom = myPos ? { lat: myPos.lat, lng: myPos.lng } : undefined;
  const route = sequenceOrders(day.orders, coordOf, startFrom);
  const plan = driverDayPlan(route, coordOf, day.allocatedVehicle?.capacity ?? null, startFrom);
  const eta = active?.startedAt ? fmtTime(etaEnd(active.startedAt, plan.totalMinutes)) : null;
  const firstPickup = route[0] ? day.hub.get(route[0].sourceId)?.name : undefined;

  const endShift = async () => {
    /* v8 ignore next -- endShift is only wired to the End Shift button, which renders only when a shift is active */
    if (!active) return;
    const remaining = day.orders.filter((o) => o.status === 'in_transit').length;
    const ok = await confirm({
      title: 'End shift?',
      message: remaining
        ? `${remaining} delivery(ies) are still in transit. End the shift anyway?`
        : 'End your shift for today?',
      confirmLabel: 'End shift',
      danger: remaining > 0,
    });
    if (ok) end.mutate(active.id);
  };

  return (
    <div className={styles.wrap}>
      <PageHeader eyebrow={`Driver · ${fmtDate(today())}`} title="Shift & Deliveries" />

      {/* Shift status */}
      <Card className={styles.hero}>
        <div className={styles.heroTop}>
          <div className={styles.vehicle}>
            <span className={styles.vehIcon}>
              <Truck size={22} />
            </span>
            <div>
              <div className={styles.vehReg}>{day.allocatedVehicle?.registration ?? 'No vehicle allocated'}</div>
              <div className={styles.vehSub}>
                {day.allocatedVehicle ? `${day.allocatedVehicle.type} · ${fmtQty(day.allocatedVehicle.capacity)} capacity` : 'Ask dispatch to allocate a vehicle'}
              </div>
            </div>
          </div>
          <Badge tone={active ? 'ok' : 'neutral'}>{active ? 'Shift active' : 'Not started'}</Badge>
        </div>

        {total > 0 && (
          <>
            <div className={styles.progressRow}>
              <span className={styles.progressLabel}>
                <CheckCircle2 size={15} /> {delivered} delivered
                {failed > 0 && ` · ${failed} failed`} <span className={styles.muted}>of {total}</span>
              </span>
              <span className={`${styles.muted} num`}>{pct}%</span>
            </div>
            <div className={styles.bar}>
              <span className={styles.barFill} style={{ ['--pct' as string]: `${pct}%` }} />
            </div>

            <div className={styles.route}>
              <span>
                <Package size={14} /> {total} deliveries · {fmtQty(totalQty)}
              </span>
              <span>
                <Route size={14} /> ≈ {Math.round(plan.totalKm)} km
              </span>
              <span>
                <Clock size={14} /> ≈ {fmtDuration(plan.totalMinutes)}
              </span>
              {eta && <span className={styles.eta}>ETA ~{eta}</span>}
            </div>
            {!active && firstPickup && (
              <div className={styles.startAt}>
                <MapPin size={14} /> Starts at <strong>{firstPickup}</strong>
                {plan.reposition && plan.reposition.km > 0.5 && (
                  <span className={styles.muted}> · {Math.round(plan.reposition.km)} km from your location</span>
                )}
              </div>
            )}
          </>
        )}

        <div className={styles.actions}>
          {!active ? (
            <div className={styles.startWrap}>
              <Button
                size="lg"
                block
                icon={<Play size={18} />}
                disabled={!day.readiness.ready}
                loading={start.isPending}
                onClick={() => start.mutate({ driverId: day.driverId, date: today() })}
              >
                Start Shift
              </Button>
              {!day.readiness.ready && (
                <p className={styles.reason}>
                  <Info size={14} /> {day.readiness.reason}
                </p>
              )}
            </div>
          ) : (
            <Button size="lg" block variant="danger" icon={<Square size={16} />} onClick={endShift} loading={end.isPending}>
              End Shift
            </Button>
          )}
        </div>
      </Card>

      {/* Delivery management */}
      <div className={styles.sectionHead}>
        <h3 className={styles.sectionTitle}>Delivery Management</h3>
        {total > 0 && <span className={styles.muted}>{done}/{total} complete</span>}
      </div>
      <DeliveryManager orders={route} hub={day.hub} active={Boolean(active)} />
    </div>
  );
}
