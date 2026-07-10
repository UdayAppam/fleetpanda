import { useState } from 'react';
import { CheckCircle2, XCircle, Package, ArrowRight, MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/Field';
import { useShiftMutations } from '@/features/driver-shift/mutations';
import { legKm } from '@/services/logistics';
import { fmtQty, fmtTime } from '@/utils/format';
import type { Hub, Order } from '@/types';
import styles from './DeliveryManager.module.css';

const typeTone = (h?: Hub) => (h?.locationType === 'terminal' ? 'info' : 'neutral');

export function DeliveryManager({
  orders,
  hub,
  active,
}: {
  orders: Order[];
  hub: Map<string, Hub>;
  active: boolean;
}) {
  const { complete, fail } = useShiftMutations();
  const [failing, setFailing] = useState<Order | null>(null);
  const [reason, setReason] = useState('');

  const submitFail = () => {
    if (!failing || !reason.trim()) return;
    fail.mutate(
      { orderId: failing.id, reason: reason.trim() },
      { onSuccess: () => { setFailing(null); setReason(''); } },
    );
  };

  if (orders.length === 0) return <p className={styles.empty}>No deliveries assigned for today.</p>;
  const nextId = active ? orders.find((o) => o.status === 'in_transit')?.id : undefined;

  return (
    <div className={styles.list}>
      {orders.map((o, i) => {
        const src = hub.get(o.sourceId);
        const dst = hub.get(o.destinationId);
        const isNext = o.id === nextId;
        return (
          <div key={o.id} className={styles.card} data-status={o.status} data-next={isNext}>
            <div className={styles.head}>
              <div className={styles.title}>
                <span className={styles.idx}>{i + 1}</span>
                <span>
                  Deliver to <strong>{dst?.name ?? '—'}</strong>
                </span>
                {isNext && <span className={styles.nextTag}><Navigation size={11} /> Current</span>}
              </div>
              <StatusBadge status={o.status} />
            </div>

            <div className={styles.route}>
              <span className={styles.node}>
                <span className={styles.dot} data-role="pickup" />
                <span className={styles.nodeText}>
                  <span className={styles.hubName}>{src?.name ?? '—'}</span>
                  <Badge tone={typeTone(src)}>{src?.locationType ?? 'source'}</Badge>
                </span>
              </span>
              <ArrowRight size={16} className={styles.arrow} />
              <span className={styles.node}>
                <span className={styles.dot} data-role="drop" />
                <span className={styles.nodeText}>
                  <span className={styles.hubName}>{dst?.name ?? '—'}</span>
                  <Badge tone={typeTone(dst)}>{dst?.locationType ?? 'dest'}</Badge>
                </span>
              </span>
            </div>

            <div className={styles.meta}>
              <span>
                <Package size={14} /> <strong>{fmtQty(o.quantity)}</strong>{' '}
                <span className="capitalize">{o.product}</span>
              </span>
              <span>
                <MapPin size={14} /> ~{Math.round(legKm(o, (id) => hub.get(id)?.coordinates))} km
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
          </div>
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
