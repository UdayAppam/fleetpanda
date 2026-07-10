import { describe, it, expect, afterEach, vi } from 'vitest';
import { http, ApiError } from './httpClient';

const res = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) }) as Response;

afterEach(() => vi.unstubAllGlobals());

describe('http client', () => {
  it('issues GET/POST/PATCH/PUT/DELETE with the right method and JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await http.get('/things');
    await http.post('/things', { a: 1 });
    await http.patch('/things/1', { a: 2 });
    await http.put('/things/1', { a: 3 });
    await http.del('/things/1');

    const methods = fetchMock.mock.calls.map(([, init]) => (init as RequestInit)?.method ?? 'GET');
    expect(methods).toEqual(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']);
    expect((fetchMock.mock.calls[1][1] as RequestInit).body).toBe(JSON.stringify({ a: 1 }));
  });

  it('defaults an empty POST body to {}', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res({}));
    vi.stubGlobal('fetch', fetchMock);
    await http.post('/action');
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBe('{}');
  });

  it('resolves undefined for an empty response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(undefined)));
    await expect(http.del('/things/1')).resolves.toBeUndefined();
  });

  it('throws an ApiError carrying the server error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res({ error: 'Nope' }, false, 409)));
    await expect(http.get('/x')).rejects.toMatchObject({ status: 409, message: 'Nope' });
  });

  it('falls back to a generic message when the body has none', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res({}, false, 500)));
    await expect(http.get('/x')).rejects.toThrow(/Request failed \(500\)/);
  });

  it('exposes an ApiError class with status/body', () => {
    const e = new ApiError(400, 'bad', { detail: 1 });
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(400);
    expect(e.body).toEqual({ detail: 1 });
  });
});
