import { useState } from 'react';
import { format, startOfMonth, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Truck, Package, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Spinner, ErrorState, EmptyState } from '@/components/ui/misc';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { useDriverSchedule } from '@/features/driver-shift/useDriverSchedule';
import { today } from '@/utils/clock';
import { fmtQty } from '@/utils/format';
import styles from './SchedulePage.module.css';

type DayState = 'past' | 'today' | 'upcoming';
const dayState = (date: string, iso: string): DayState => (date < iso ? 'past' : date > iso ? 'upcoming' : 'today');
const STATE_LABEL: Record<DayState, string> = { past: 'Past', today: 'Today', upcoming: 'Upcoming' };

export default function SchedulePage() {
  const iso = today();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date(iso + 'T00:00:00')));
  const month = format(cursor, 'yyyy-MM');
  const { days, hub, isLoading, error, refetch } = useDriverSchedule(month);

  if (isLoading) return <Spinner label="Loading your schedule…" />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  return (
    <div>
      <PageHeader eyebrow="Driver" title="My Schedule" />

      <div className={styles.monthNav}>
        <button className={styles.navBtn} onClick={() => setCursor((c) => addMonths(c, -1))} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <h3 className={styles.monthLabel}>{format(cursor, 'MMMM yyyy')}</h3>
        <button className={styles.today} onClick={() => setCursor(startOfMonth(new Date(iso + 'T00:00:00')))}>
          Today
        </button>
        <button className={styles.navBtn} onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>

      {days.length === 0 ? (
        <EmptyState title="Nothing scheduled" hint={`No orders or trucks assigned to you in ${format(cursor, 'MMMM yyyy')}.`} />
      ) : (
        <div className={styles.days}>
          {days.map((d) => {
            const state = dayState(d.date, iso);
            const dt = new Date(d.date + 'T00:00:00');
            return (
              <section key={d.date} className={styles.day} data-state={state}>
                <header className={styles.dayHead}>
                  <div className={styles.date}>
                    <span className={styles.dow}>{format(dt, 'EEE')}</span>
                    <span className={styles.dnum}>{format(dt, 'd')}</span>
                    <span className={styles.mon}>{format(dt, 'MMM')}</span>
                  </div>
                  <div className={styles.dayMeta}>
                    <span className={styles.truck}>
                      <Truck size={15} />
                      {d.vehicle ? (
                        <>
                          <strong className="mono">{d.vehicle.registration}</strong>
                          <span className="muted">{fmtQty(d.vehicle.capacity)}</span>
                        </>
                      ) : (
                        <span className="muted">No truck allocated</span>
                      )}
                    </span>
                    <Badge tone={state === 'today' ? 'ok' : state === 'upcoming' ? 'info' : 'neutral'}>
                      {STATE_LABEL[state]}
                    </Badge>
                  </div>
                </header>

                {d.orders.length === 0 ? (
                  <p className={styles.noOrders}>Truck reserved — no deliveries assigned.</p>
                ) : (
                  <>
                    <div className={styles.dayStats}>
                      <span><Package size={13} /> {d.orders.length} {d.orders.length === 1 ? 'order' : 'orders'} · {fmtQty(d.totalQty)}</span>
                      {d.delivered > 0 && <span className={styles.ok}>{d.delivered} delivered</span>}
                      {d.failed > 0 && <span className={styles.fail}>{d.failed} failed</span>}
                    </div>
                    <ul className={styles.orders}>
                      {d.orders.map((o) => (
                        <li key={o.id} className={styles.order}>
                          <span className={styles.route}>
                            {hub.get(o.sourceId)?.name ?? o.sourceId} <ArrowRight size={13} className={styles.arrow} />{' '}
                            <strong>{hub.get(o.destinationId)?.name ?? o.destinationId}</strong>
                          </span>
                          <span className={styles.prod}>
                            <span className="capitalize">{o.product}</span> <span className="num">{fmtQty(o.quantity)}</span>
                          </span>
                          <StatusBadge status={o.status} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
