import { today } from '@/utils/clock';
import { fmtDate } from '@/utils/format';
import styles from './SyncClock.module.css';

export function SyncClock() {
  return (
    <div className={styles.clock}>
      <span className={styles.dot} />
      <span className={styles.label}>{fmtDate(today())}</span>
    </div>
  );
}
