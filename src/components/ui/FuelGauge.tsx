import { stockLevel, gaugeFill } from '@/services/rules';
import type { Product } from '@/types';
import styles from './FuelGauge.module.css';

// Fills qty / tankCapacity; threshold drawn as a tick; color from the single stockLevel rule.
export function FuelGauge({ qty, product }: { qty: number; product: Product }) {
  const level = stockLevel(qty, product.lowStockThreshold);
  const fill = gaugeFill(qty, product);
  const tick = Math.max(0, Math.min(1, product.lowStockThreshold / product.tankCapacity));
  return (
    <div className={styles.wrap} title={`${qty.toLocaleString()} / ${product.tankCapacity.toLocaleString()} ${product.unit}`}>
      <div className={styles.track} data-level={level}>
        <div className={styles.fill} style={{ width: `${fill * 100}%` }} />
        <div className={styles.tick} style={{ left: `${tick * 100}%` }} />
      </div>
      <span className={`${styles.val} num`}>{qty.toLocaleString()}</span>
    </div>
  );
}
