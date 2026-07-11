// Serverless demo mode: when VITE_MOCK=true the app runs its own API in the browser via
// MSW (see src/mocks/browser.ts), so it hosts on any static host (Netlify) with no backend.
// In that mode requests are same-origin ('') and intercepted by the Service Worker.
export const USE_MOCK = import.meta.env.VITE_MOCK === 'true';
export const API_URL = import.meta.env.VITE_API_URL ?? (USE_MOCK ? '' : 'http://localhost:4000');
export const POSITION_REFRESH_MS = 30_000;

// The serverless mock ships a frozen seed dated 2026-07-10 (see src/mocks/db.seed.json and
// SEED_VERSION). Keep this in sync with that snapshot.
export const SEED_DEMO_DATE = '2026-07-10';

// The app's "today". In mock mode it defaults to the seed's date so the seeded shifts/orders
// line up regardless of the real calendar day (otherwise `npm run dev:mock` on a later date
// shows no data). Otherwise it tracks the real local day. VITE_DEMO_DATE overrides either.
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const DEMO_DATE = import.meta.env.VITE_DEMO_DATE ?? (USE_MOCK ? SEED_DEMO_DATE : localToday());
