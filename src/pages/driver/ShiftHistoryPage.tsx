import { PageHeader } from '@/components/layout/PageHeader';
import { Card, Spinner, EmptyState } from '@/components/ui/misc';
import { Badge } from '@/components/ui/Badge';
import { useShifts, useOrders } from '@/hooks/queries';
import { useLookups } from '@/hooks/useLookups';
import { useAuth } from '@/contexts/AuthContext';
import { fmtDate, fmtTime } from '@/utils/format';
import styles from './ShiftHistoryPage.module.css';

export default function ShiftHistoryPage() {
  const { user } = useAuth();
  const shifts = useShifts();
  const orders = useOrders();
  const { vehicle } = useLookups();

  if (shifts.isLoading || orders.isLoading) return <Spinner label="Loading history…" />;

  const past = (shifts.data ?? [])
    .filter((s) => s.driverId === user?.driverId && s.status === 'ended')
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const orderById = new Map((orders.data ?? []).map((o) => [o.id, o]));

  return (
    <div className={styles.wrap}>
      <PageHeader eyebrow="Records" title="Shift History" />
      {past.length === 0 ? (
        <EmptyState title="No past shifts yet" hint="Completed shifts will appear here." />
      ) : (
        <div className={styles.list}>
          {past.map((s) => {
            const shiftOrders = s.orderIds.map((id) => orderById.get(id)).filter(Boolean);
            const completed = shiftOrders.filter((o) => o!.status === 'delivered').length;
            const failed = shiftOrders.filter((o) => o!.status === 'failed').length;
            return (
              <Card key={s.id} className={styles.item}>
                <div className={styles.top}>
                  <div>
                    <div className={styles.date}>{fmtDate(s.date)}</div>
                    <div className={styles.sub}>
                      {vehicle.get(s.vehicleId)?.registration} · {fmtTime(s.startedAt)}–{fmtTime(s.endedAt)}
                    </div>
                  </div>
                  <div className={styles.badges}>
                    <Badge tone="ok">{completed} delivered</Badge>
                    {failed > 0 && <Badge tone="crit">{failed} failed</Badge>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
