import { Truck } from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { fmtQty } from '@/utils/format';
import type { FleetVehicle } from './useFleetData';
import styles from './FleetMap.module.css';

// Accessible mirror of the map markers (also the filtered results list). Selecting a row
// highlights + flies to its marker, and vice-versa.
export function VehicleListPanel({
  vehicles,
  selectedId,
  onSelect,
}: {
  vehicles: FleetVehicle[];
  selectedId: string | null;
  onSelect: (vehicleId: string) => void;
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className="eyebrow">Active vehicles</span>
        <span className={styles.count}>{vehicles.length}</span>
      </div>
      <ul className={`${styles.list} scroll`}>
        {vehicles.length === 0 && <li className={styles.emptyRow}>No vehicles match the filters.</li>}
        {vehicles.map((v) => (
          <li key={v.position.id}>
            <button
              className={styles.row}
              data-selected={selectedId === v.position.vehicleId}
              onClick={() => onSelect(v.position.vehicleId)}
              aria-pressed={selectedId === v.position.vehicleId}
            >
              <Truck size={16} className={styles.rowIcon} />
              <div className={styles.rowMain}>
                <span className={`${styles.reg} mono`}>{v.vehicleReg}</span>
                <span className={styles.driver}>{v.driverName}</span>
                {v.destName && (
                  <span className={styles.dest}>
                    → {v.destName}
                    {v.product && v.quantity ? ` · ${fmtQty(v.quantity)} ${v.product}` : ''}
                  </span>
                )}
              </div>
              <StatusBadge status={v.status} kind="map" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
