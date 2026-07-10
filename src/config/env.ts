export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
export const POSITION_REFRESH_MS = 30_000;

// The app's "today" defaults to the real local calendar day so seeded data lines up with
// live dates. VITE_DEMO_DATE can pin it for reproducible demos.
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const DEMO_DATE = import.meta.env.VITE_DEMO_DATE ?? localToday();
