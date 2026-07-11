// Rolling demo: the frozen seed (db.seed.json) is dated relative to SEED_BASE. To keep the demo
// looking current whenever a reviewer opens it, we shift every dated field by (target − base)
// days at load time, so "today" always has an active run, a coherent past, and upcoming orders.
import type { MockDb } from './handlers';

// db.seed.json's base "today" — every dated field is relative to this (see seed.js SEED_DATE).
export const SEED_BASE = '2026-07-10';

const DAY = 86_400_000;
const midnight = (isoDate: string) => new Date(isoDate + 'T00:00:00Z').getTime();

/** Whole-day difference between two YYYY-MM-DD dates (toDate − fromDate). */
export function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((midnight(toDate) - midnight(fromDate)) / DAY);
}

/** Shift a YYYY-MM-DD calendar date by whole days. */
export function shiftDate(date: string, days: number): string {
  return new Date(midnight(date) + days * DAY).toISOString().slice(0, 10);
}

/** Shift a full ISO timestamp by whole days (preserves time-of-day). */
export function shiftDateTime(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY).toISOString();
}

/** Re-anchor every dated field in the db from SEED_BASE to `targetToday`. Mutates + returns db. */
export function reanchor(db: MockDb, targetToday: string): MockDb {
  const days = daysBetween(SEED_BASE, targetToday);
  if (days === 0) return db;
  for (const o of db.orders) {
    o.deliveryDate = shiftDate(o.deliveryDate, days);
    if (o.completedAt) o.completedAt = shiftDateTime(o.completedAt, days);
  }
  for (const a of db.allocations) a.date = shiftDate(a.date, days);
  for (const s of db.shifts) {
    s.date = shiftDate(s.date, days);
    if (s.startedAt) s.startedAt = shiftDateTime(s.startedAt, days);
    if (s.endedAt) s.endedAt = shiftDateTime(s.endedAt, days);
  }
  for (const p of db.vehiclePositions) {
    if (p.updatedAt) p.updatedAt = shiftDateTime(p.updatedAt, days);
  }
  return db;
}
