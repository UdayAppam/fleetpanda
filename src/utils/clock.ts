import { DEMO_DATE } from '@/config/env';

// Single injectable clock. Date-only fields use YYYY-MM-DD to dodge timezone off-by-one.
// The app's "today" is pinned to the seed's demo date so a fresh clone has an active shift.
let _today = DEMO_DATE;

export const today = (): string => _today;
export const now = (): string => new Date().toISOString();

// test hook
export const __setToday = (d: string) => {
  _today = d;
};
