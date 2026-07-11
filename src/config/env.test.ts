import { describe, it, expect, afterEach, vi } from 'vitest';

// env.ts resolves its constants once at module-evaluation time from import.meta.env, so each
// case stubs the vars, resets the module registry, and re-imports to observe the derived value.
async function loadEnv() {
  vi.resetModules();
  return import('./env');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('config/env', () => {
  it('uses an explicit VITE_API_URL when provided', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com');
    vi.stubEnv('VITE_MOCK', 'false');
    const env = await loadEnv();
    expect(env.API_URL).toBe('https://api.example.com');
    expect(env.USE_MOCK).toBe(false);
  });

  it('falls back to same-origin in mock mode', async () => {
    vi.stubEnv('VITE_API_URL', undefined as unknown as string);
    vi.stubEnv('VITE_MOCK', 'true');
    const env = await loadEnv();
    expect(env.USE_MOCK).toBe(true);
    expect(env.API_URL).toBe('');
  });

  it('falls back to the local backend when not mocking and no URL is set', async () => {
    vi.stubEnv('VITE_API_URL', undefined as unknown as string);
    vi.stubEnv('VITE_MOCK', 'false');
    const env = await loadEnv();
    expect(env.API_URL).toBe('http://localhost:4000');
  });

  it('pins DEMO_DATE from VITE_DEMO_DATE and otherwise uses the local calendar day', async () => {
    vi.stubEnv('VITE_DEMO_DATE', '2025-01-15');
    expect((await loadEnv()).DEMO_DATE).toBe('2025-01-15');

    vi.stubEnv('VITE_DEMO_DATE', undefined as unknown as string);
    const env = await loadEnv();
    expect(env.DEMO_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
