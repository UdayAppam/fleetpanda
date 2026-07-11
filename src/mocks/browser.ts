// Browser-side mock API: runs the shared MSW handlers in a Service Worker so the deployed
// static site is fully functional with NO backend. Data is seeded from the frozen demo
// snapshot and persisted per-browser to localStorage (so mutations survive a refresh).
//
// Enabled by VITE_MOCK=true at build time (see src/config/env.ts). OSM tiles and Nominatim
// geocoding are left to hit the network (onUnhandledRequest: 'bypass').
import { setupWorker } from 'msw/browser';
import { createHandlers, type MockDb, type MockStore } from './handlers';
import { reanchor } from './reanchor';
import { DEMO_DATE } from '@/config/env';
import seedData from './db.seed.json';

// Bump when db.seed.json's shape changes so returning visitors drop stale localStorage.
const SEED_VERSION = '2026-07-11-all-drivers';
const STORAGE_KEY = 'fleetpanda:mockdb';

// Rolling demo: every load re-anchors the frozen seed to the app's "today" (DEMO_DATE — the real
// day unless pinned) so a reviewer always sees a current-looking past/today/future.
function freshSeed(): MockDb {
  return reanchor(structuredClone(seedData) as unknown as MockDb, DEMO_DATE);
}

function loadDb(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { v: string; anchor: string; db: MockDb };
      // Reuse the cache only within the same day it was anchored, so it re-seeds (re-anchors)
      // when the calendar day rolls over — keeping the demo fresh while preserving same-day edits.
      if (saved.v === SEED_VERSION && saved.anchor === DEMO_DATE) return saved.db;
    }
  } catch {
    /* corrupt or unavailable storage → fall back to a fresh seed */
  }
  return freshSeed();
}

const store: MockStore = { db: loadDb() };
store.onWrite = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: SEED_VERSION, anchor: DEMO_DATE, db: store.db }));
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
  // Re-registers + re-activates the worker and re-establishes the client↔worker message channel
  // MSW uses to resolve handlers (which is what an idle eviction breaks).
  await worker.start(startOptions);
  // If this page isn't controlled yet (fresh/reclaimed worker), wait until it takes control so
  // the very next request is actually intercepted rather than falling through again.
  const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
  if (sw && !sw.controller) {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      sw.addEventListener('controllerchange', done, { once: true });
      setTimeout(done, 1500); // safety timeout — don't hang if control never changes
    });
  }
}
