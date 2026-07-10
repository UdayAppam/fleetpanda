import { useMemo, useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMonths,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { today } from '@/utils/clock';
import type { Allocation, Driver, Vehicle } from '@/types';
import styles from './AllocationCalendar.module.css';

interface Props {
  allocations: Allocation[];
  vehicle: Map<string, Vehicle>;
  driver: Map<string, Driver>;
  onPickDay: (isoDate: string) => void;
}

export function AllocationCalendar({ allocations, vehicle, driver, onPickDay }: Props) {
  const [cursor, setCursor] = useState(() => new Date(today() + 'T00:00:00'));
  const todayIso = today();

  const byDate = useMemo(() => {
    const m = new Map<string, Allocation[]>();
    allocations.forEach((a) => {
      const arr = m.get(a.date) ?? [];
      arr.push(a);
      m.set(a.date, arr);
    });
    return m;
  }, [allocations]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  return (
    <div className={styles.cal}>
      <div className={styles.head}>
        <h3>{format(cursor, 'MMMM yyyy')}</h3>
        <div className={styles.nav}>
          <button onClick={() => setCursor((c) => addMonths(c, -1))} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setCursor(new Date(todayIso + 'T00:00:00'))}>Today</button>
          <button onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className={styles.grid}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className={styles.dow}>
            {d}
          </div>
        ))}
        {days.map((day) => {
          const iso = format(day, 'yyyy-MM-dd');
          const list = byDate.get(iso) ?? [];
          const past = iso < todayIso; // history — read-only, no new allocations
          return (
            <button
              key={iso}
              className={styles.day}
              data-outside={!isSameMonth(day, cursor)}
              data-today={isSameDay(day, new Date(todayIso + 'T00:00:00'))}
              data-past={past}
              disabled={past}
              onClick={() => !past && onPickDay(iso)}
              aria-label={past ? `${iso} (history)` : `Allocate on ${iso}`}
              title={past ? 'Past date — history only' : undefined}
            >
              <span className={styles.dayNum}>{format(day, 'd')}</span>
              <span className={styles.chips}>
                {list.slice(0, 3).map((a) => (
                  <span key={a.id} className={styles.chip} title={`${vehicle.get(a.vehicleId)?.registration} · ${driver.get(a.driverId)?.name}`}>
                    {vehicle.get(a.vehicleId)?.registration ?? a.vehicleId}
                  </span>
                ))}
                {list.length > 3 && <span className={styles.more}>+{list.length - 3}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
