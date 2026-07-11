import { API_URL, USE_MOCK } from '@/config/env';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

// A same-origin response whose body starts with '<' is the static host's SPA fallback
// (index.html), which only happens in serverless demo mode when the MSW Service Worker has
// been evicted while idle and the request fell through to the network instead of the mock.
const looksLikeHtml = (text: string) => text.trimStart().startsWith('<');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const doFetch = () => fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });

  let res = await doFetch();
  let text = await res.text();

  // Serverless demo self-heal: if the mock Service Worker was evicted while idle, the request
  // fell through to index.html. Re-arm the worker and retry once before giving up.
  if (USE_MOCK && looksLikeHtml(text)) {
    const { reviveMockWorker } = await import('@/mocks/browser');
    await reviveMockWorker();
    res = await doFetch();
    text = await res.text();
    if (looksLikeHtml(text)) {
      throw new ApiError(503, 'Demo API is waking up — please retry in a moment.');
    }
  }

  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const message = (data && (data.error || data.message)) || `Request failed (${res.status})`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
