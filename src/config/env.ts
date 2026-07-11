// Serverless demo mode: when VITE_MOCK=true the app runs its own API in the browser via
// MSW (see src/mocks/browser.ts), so it hosts on any static host (Netlify) with no backend.
// In that mode requests are same-origin ('') and intercepted by the Service Worker.
export const USE_MOCK = import.meta.env.VITE_MOCK === 'true';
export const API_URL = import.meta.env.VITE_API_URL ?? (USE_MOCK ? '' : 'http://localhost:4000');
export const POSITION_REFRESH_MS = 30_000;

// The app's "today" tracks the real local calendar day. In serverless mock mode the frozen seed
// is re-anchored to this date at load (see src/mocks/reanchor.ts), so the demo always looks
// current. VITE_DEMO_DATE can pin it for a reproducible demo.
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const DEMO_DATE = import.meta.env.VITE_DEMO_DATE ?? localToday();
