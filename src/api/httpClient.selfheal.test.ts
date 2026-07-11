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
  afterEach(() => vi.unstubAllGlobals());

  it('re-arms the worker and retries once when a request falls through to index.html', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(htmlResponse()).mockResolvedValueOnce(jsonResponse([{ id: 'order-1' }]));
    vi.stubGlobal('fetch', fetchMock);

    const data = await http.get<{ id: string }[]>('/orders');

    expect(revive).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(data[0].id).toBe('order-1');
  });

  it('throws a clear 503 when the worker still cannot intercept after revival', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => htmlResponse());
    vi.stubGlobal('fetch', fetchMock);

    await expect(http.get('/orders')).rejects.toMatchObject({ status: 503 });
    expect(revive).toHaveBeenCalledOnce();
    await expect(http.get('/orders')).rejects.toBeInstanceOf(ApiError);
  });
});
