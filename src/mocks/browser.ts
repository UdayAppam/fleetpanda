// Browser-side mock API: runs the shared MSW handlers in a Service Worker so the deployed
// static site is fully functional with NO backend. Data is seeded from the frozen demo
// snapshot and persisted per-browser to localStorage (so mutations survive a refresh).
//
// Enabled by VITE_MOCK=true at build time (see src/config/env.ts). OSM tiles and Nominatim
// geocoding are left to hit the network (onUnhandledRequest: 'bypass').
import { setupWorker } from 'msw/browser';
import { createHandlers, type MockDb, type MockStore } from './handlers';
import seedData from './db.seed.json';

// Bump when db.seed.json's shape changes so returning visitors drop stale localStorage.
const SEED_VERSION = '2026-07-11-all-drivers';
const STORAGE_KEY = 'fleetpanda:mockdb';

function freshSeed(): MockDb {
  return structuredClone(seedData) as unknown as MockDb;
}

function loadDb(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { v: string; db: MockDb };
      if (saved.v === SEED_VERSION) return saved.db;
    }
  } catch {
    /* corrupt or unavailable storage → fall back to a fresh seed */
  }
  return freshSeed();
}

const store: MockStore = { db: loadDb() };
store.onWrite = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: SEED_VERSION, db: store.db }));
  } catch {
    /* storage full / disabled → keep running from memory */
  }
};

/** Reset the in-browser dataset to the pristine seed (exposed for a "Reset demo" action). */
export function resetMockData() {
  store.db = freshSeed();
  store.onWrite?.();
}

const worker = setupWorker(...createHandlers(store));

const startOptions = {
  serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  onUnhandledRequest: 'bypass' as const,
  quiet: true,
};

export function startMockWorker() {
  return worker.start(startOptions);
}

// Re-arm the worker after the browser evicts it while the tab is idle. Without this, a request
// that fires in the gap before the Service Worker restarts falls through to the static host's
// SPA fallback (index.html) and blows up JSON.parse. Called by httpClient's self-heal path.
export async function reviveMockWorker() {
  if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
    try {
      await navigator.serviceWorker.ready;
    } catch {
      /* no active registration — worker.start() below re-registers it */
    }
  }
  return worker.start(startOptions);
}
