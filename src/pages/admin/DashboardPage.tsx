import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Truck, TriangleAlert, ArrowRight, Boxes, PartyPopper } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, Spinner } from '@/components/ui/misc';
import { Button } from '@/components/ui/Button';
import { Clock, GaugeCircle } from 'lucide-react';
import { ReadinessPill, ctaFor } from '@/features/dispatch/readinessUi';
import { useDispatchReadiness } from '@/features/dispatch/useDispatchReadiness';
import { useShiftAdvisories } from '@/features/dispatch/useShiftAdvisories';
import { useHubs, useProducts } from '@/hooks/queries';
import { useLookups } from '@/hooks/useLookups';
import { stockLevel } from '@/services/rules';
import { fmtDuration } from '@/services/logistics';
import { fmtDate, fmtQty } from '@/utils/format';
import { today } from '@/utils/clock';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const date = today();
  const { counts, actionable, isLoading } = useDispatchReadiness(date);
  const { advisories } = useShiftAdvisories(date);
  const hubs = useHubs();
  const products = useProducts();
  const { hub } = useLookups();
  const nav = useNavigate();

  if (isLoading || hubs.isLoading || products.isLoading) return <Spinner label="Loading dashboard…" />;

  const lowStock = (hubs.data ?? []).flatMap((h) =>
    (products.data ?? [])
      .filter((p) => stockLevel(h.inventory[p.key] ?? 0, p.lowStockThreshold) !== 'ok')
      .map((p) => ({ hub: h.name, product: p.name, qty: h.inventory[p.key] ?? 0, level: stockLevel(h.inventory[p.key] ?? 0, p.lowStockThreshold) })),
  );

  // Tiles scope to TODAY (same as the counts) so the filtered list matches the number shown.
  const summary = [
    { key: 'ready', label: 'Ready', value: counts.ready, tone: 'ok', to: `/admin/orders?readiness=ready&date=${date}` },
    { key: 'transit', label: 'In transit', value: counts.in_transit, tone: 'info', to: `/admin/orders?readiness=in_transit&date=${date}` },
    { key: 'needs', label: 'Need action', value: counts.needs, tone: 'warn', to: `/admin/orders?readiness=needs&date=${date}` },
    { key: 'blocked', label: 'Blocked', value: counts.blocked, tone: 'crit', to: `/admin/orders?readiness=blocked&date=${date}` },
  ] as const;

  return (
    <div>
      <PageHeader eyebrow={`Control tower · ${fmtDate(date)}`} title="Dashboard" />

      <div className={styles.summary}>
        {summary.map((s) => (
          <Link key={s.key} to={s.to} className={styles.sumTile} data-tone={s.tone}>
            <span className={`${styles.sumValue} num`}>{s.value}</span>
            <span className={styles.sumLabel}>{s.label}</span>
          </Link>
        ))}
      </div>

      <div className={styles.grid}>
        <section>
          <h3 className={styles.sectionTitle}>
            What needs you {actionable.length > 0 && <span className={styles.badgeCount}>{actionable.length}</span>}
          </h3>
          <Card>
            {actionable.length === 0 ? (
              <div className={styles.allClear}>
                <PartyPopper size={20} />
                <div>
                  <strong>All clear for {fmtDate(date)}.</strong>
                  <p>Every order today has a driver, a vehicle, and enough stock.</p>
                </div>
              </div>
            ) : (
              <ul className={styles.actionList}>
                {actionable.map(({ order, readiness }) => {
                  const cta = ctaFor(order, readiness.action);
                  const Icon =
                    readiness.tone === 'crit' ? TriangleAlert : readiness.state === 'needs_driver' ? Truck : ArrowRight;
                  return (
                    <li key={order.id} className={styles.actionRow} data-tone={readiness.tone}>
                      <Icon size={17} className={styles.actionIcon} />
                      <div className={styles.actionMain}>
                        <div className={styles.actionTop}>
                          <span className="mono">{order.id}</span>
                          <ReadinessPill readiness={readiness} />
                        </div>
                        <div className={styles.actionDetail}>
                          {hub.get(order.sourceId)?.name} → {hub.get(order.destinationId)?.name} ·{' '}
                          <span style={{ textTransform: 'capitalize' }}>{order.product}</span> {fmtQty(order.quantity)}
                          {readiness.detail && <> · {readiness.detail}</>}
                        </div>
                      </div>
                      {cta && (
                        <Button
                          size="sm"
                          variant={readiness.tone === 'crit' ? 'danger' : 'primary'}
                          onClick={() => nav(cta.to, cta.state ? { state: cta.state } : undefined)}
                        >
                          {cta.label}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>

        <section>
          <h3 className={styles.sectionTitle}>
            Low stock {lowStock.length > 0 && <span className={styles.badgeCount}>{lowStock.length}</span>}
          </h3>
          <Card>
            {lowStock.length === 0 ? (
              <div className={styles.allClear}>
                <CheckCircle2 size={20} />
                <div>
                  <strong>Stock levels healthy.</strong>
                </div>
              </div>
            ) : (
              <ul className={styles.stockList}>
                {lowStock.slice(0, 6).map((s, i) => (
                  <li key={i} className={styles.stockRow}>
                    <Boxes size={15} className={styles.actionIcon} data-level={s.level} />
                    <span className={styles.stockHub}>{s.hub}</span>
                    <span style={{ textTransform: 'capitalize', color: 'var(--text-muted)' }}>{s.product}</span>
                    <span className="num" data-level={s.level} style={{ marginLeft: 'auto', color: s.level === 'crit' ? 'var(--crit)' : 'var(--warn)' }}>
                      {fmtQty(s.qty)}
                    </span>
                  </li>
                ))}
                <li className={styles.stockFoot}>
                  <Link to="/admin/inventory">Open inventory <ArrowRight size={13} /></Link>
                </li>
              </ul>
            )}
          </Card>
        </section>
      </div>

      {advisories.length > 0 && (
        <section className={styles.advisories}>
          <h3 className={styles.sectionTitle}>
            Shift advisories <span className={styles.badgeCount}>{advisories.length}</span>
          </h3>
          <Card>
            <ul className={styles.actionList}>
              {advisories.map((a) => (
                <li key={`${a.driverId}-${a.kind}`} className={styles.actionRow} data-tone="warn">
                  {a.kind === 'overbooked' ? (
                    <Clock size={17} className={styles.actionIcon} />
                  ) : (
                    <GaugeCircle size={17} className={styles.actionIcon} />
                  )}
                  <div className={styles.actionMain}>
                    <div className={styles.actionTop}>
                      <strong>{a.driverName}</strong> · {a.vehicleReg}
                    </div>
                    <div className={styles.actionDetail}>
                      {a.kind === 'overbooked'
                        ? `${a.plan.legs.length} deliveries ≈ ${fmtDuration(a.plan.totalMinutes)} — over the 8h shift by ${fmtDuration(a.plan.overMinutes)}. Split the run or add a driver.`
                        : `Only ${Math.round((a.plan.utilisation ?? 0) * 100)}% of ${a.vehicleReg} used (${fmtQty(a.plan.load)}). Consider a smaller tanker.`}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => nav('/admin/allocation', { state: { driverId: a.driverId, date } })}
                  >
                    Review
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
