import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Force serverless mode + stub the worker so we can exercise httpClient's self-heal branch,
// which only runs when the deployed MSW Service Worker has been evicted while idle.
vi.mock('@/config/env', () => ({ API_URL: '', USE_MOCK: true }));
vi.mock('@/mocks/browser', () => ({ reviveMockWorker: vi.fn().mockResolvedValue(undefined) }));

import { http, ApiError } from './httpClient';
import { reviveMockWorker } from '@/mocks/browser';

const revive = vi.mocked(reviveMockWorker);
const htmlResponse = () => new Response('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } });
const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('httpClient serverless self-heal', () => {
  beforeEach(() => revive.mockClear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('re-arms the worker and retries with backoff after a fall-through to index.html', async () => {
    // HTML on the first try, then JSON once the worker has re-taken control.
    const fetchMock = vi.fn().mockResolvedValueOnce(htmlResponse()).mockResolvedValue(jsonResponse([{ id: 'order-1' }]));
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    const p = http.get<{ id: string }[]>('/orders');
    await vi.runAllTimersAsync(); // flush the backoff delay
    const data = await p;

    expect(revive).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(data[0].id).toBe('order-1');
  });

  it('throws a clear 503 when the worker still cannot intercept after all retries', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => htmlResponse());
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    const p = http.get('/orders').then(() => null, (e) => e);
    await vi.runAllTimersAsync(); // flush all backoff delays
    const err = await p;

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(503);
    expect(revive).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(2); // initial + several retries
  });
});
