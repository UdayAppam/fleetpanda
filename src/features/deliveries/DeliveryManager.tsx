import { useState } from 'react';
import { CheckCircle2, XCircle, Package, MapPin, Navigation, Fuel } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/Field';
import { useShiftMutations } from '@/features/driver-shift/mutations';
import type { Trip } from '@/services/logistics';
import { fmtQty, fmtTime } from '@/utils/format';
import type { Hub, Order } from '@/types';
import styles from './DeliveryManager.module.css';

const typeTone = (h?: Hub) => (h?.locationType === 'terminal' ? 'info' : 'neutral');

// Reframes the day as "trips": load once at a source, then drop at each stop in sequence —
// so the pickup shows once per load, not repeated on every card (see docs ADR-29).
export function DeliveryManager({
  trips,
  hub,
  active,
  capacity,
}: {
  trips: Trip[];
  hub: Map<string, Hub>;
  active: boolean;
  capacity?: number | null;
}) {
  const { complete, fail } = useShiftMutations();
  const [failing, setFailing] = useState<Order | null>(null);
  const [reason, setReason] = useState('');

  const submitFail = () => {
    /* v8 ignore next -- defensive: the submit button is disabled unless both hold */
    if (!failing || !reason.trim()) return;
    fail.mutate(
      { orderId: failing.id, reason: reason.trim() },
      { onSuccess: () => { setFailing(null); setReason(''); } },
    );
  };

  const allOrders = trips.flatMap((t) => t.drops.map((d) => d.order));
  if (allOrders.length === 0) return <p className={styles.empty}>No deliveries assigned for today.</p>;
  const nextId = active ? allOrders.find((o) => o.status === 'in_transit')?.id : undefined;

  let dropNo = 0;
  return (
    <div className={styles.list}>
      {trips.map((trip, ti) => {
        const src = hub.get(trip.sourceId);
        const fill = capacity ? Math.min(1, trip.load / capacity) : null;
        return (
          <section key={`${trip.sourceId}-${ti}`} className={styles.trip}>
            <header className={styles.loadHead}>
              <div className={styles.loadTitle}>
                <span className={styles.loadIcon}><Fuel size={16} /></span>
                <span>
                  Load at <strong>{src?.name ?? '—'}</strong>{' '}
                  <Badge tone={typeTone(src)}>{src?.locationType ?? 'source'}</Badge>
                </span>
              </div>
              <div className={styles.loadMeta}>
                <span><Package size={13} /> {fmtQty(trip.load)}</span>
                <span>{trip.drops.length} {trip.drops.length === 1 ? 'drop' : 'drops'}</span>
                {fill != null && (
                  <span className={styles.fill} title={`${Math.round(fill * 100)}% of ${fmtQty(capacity!)} tank`}>
                    <span className={styles.fillBar} style={{ ['--fill' as string]: `${fill * 100}%` }} />
                    <span className={`${styles.fillPct} num`}>{Math.round(fill * 100)}%</span>
                  </span>
                )}
              </div>
            </header>

            <ol className={styles.drops}>
              {trip.drops.map((d) => {
                const o = d.order;
                const dst = hub.get(o.destinationId);
                const isNext = o.id === nextId;
                dropNo += 1;
                return (
                  <li key={o.id} className={styles.card} data-status={o.status} data-next={isNext}>
                    <div className={styles.head}>
                      <div className={styles.title}>
                        <span className={styles.idx}>{dropNo}</span>
                        <span>
                          Deliver to <strong>{dst?.name ?? '—'}</strong>
                        </span>
                        <Badge tone={typeTone(dst)}>{dst?.locationType ?? 'dest'}</Badge>
                        {isNext && <span className={styles.nextTag}><Navigation size={11} /> Current</span>}
                      </div>
                      <StatusBadge status={o.status} />
                    </div>

                    <div className={styles.meta}>
                      <span>
                        <Package size={14} /> <strong>{fmtQty(o.quantity)}</strong>{' '}
                        <span className="capitalize">{o.product}</span>
                      </span>
                      <span>
                        <MapPin size={14} /> ~{Math.round(d.km)} km
                      </span>
                      <span className={`${styles.oid} mono`}>{o.id}</span>
                    </div>

                    {o.status === 'delivered' && (
                      <div className={styles.doneNote}>
                        <CheckCircle2 size={15} /> Delivered{o.completedAt ? ` at ${fmtTime(o.completedAt)}` : ''} · inventory updated
                      </div>
                    )}
                    {o.status === 'failed' && (
                      <div className={styles.failNote}>
                        <XCircle size={15} /> Failed — {o.failureReason}
                      </div>
                    )}

                    {active && o.status === 'in_transit' && (
                      <div className={styles.actions}>
                        <Button
                          block
                          icon={<CheckCircle2 size={16} />}
                          loading={complete.isPending && complete.variables === o.id}
                          onClick={() => complete.mutate(o.id)}
                        >
                          Mark delivered
                        </Button>
                        <Button block variant="ghost" icon={<XCircle size={16} />} onClick={() => setFailing(o)}>
                          Report failure
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      <Modal
        open={Boolean(failing)}
        onClose={() => setFailing(null)}
        title="Report a failed delivery"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFailing(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={submitFail} loading={fail.isPending} disabled={!reason.trim()}>
              Mark failed
            </Button>
          </>
        }
      >
        <p className={styles.failHint}>{failing ? `Delivery to ${hub.get(failing.destinationId)?.name}` : ''}</p>
        <Field label="What went wrong?" error={!reason.trim() ? 'A reason is required' : undefined}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer site closed" autoFocus />
        </Field>
      </Modal>
    </div>
  );
}
