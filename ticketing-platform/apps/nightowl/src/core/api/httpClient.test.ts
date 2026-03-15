import { afterEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function textResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/plain',
    },
  });
}

async function loadHttpClient() {
  vi.resetModules();
  return import('./httpClient');
}

describe('httpClient', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends JSON requests with default headers and bearer auth', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.nightowl.test/v1';
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const { httpClient, setAccessTokenProvider } = await loadHttpClient();
    setAccessTokenProvider(() => 'token-123');

    await expect(
      httpClient.post('/checkout', { orderId: 'ord_1' }, { headers: { 'x-trace-id': 'trace-1' } }),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toBe('https://api.nightowl.test/v1/checkout');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ orderId: 'ord_1' }));
    expect(headers.get('Authorization')).toBe('Bearer token-123');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('x-trace-id')).toBe('trace-1');
    expect(headers.get('x-client-request-id')).toMatch(/^req_/);
  });

  it('respects caller-provided authorization headers', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.nightowl.test/v1';
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const { httpClient, setAccessTokenProvider } = await loadHttpClient();
    setAccessTokenProvider(() => 'token-123');

    await httpClient.get('/secure', {
      headers: {
        Authorization: 'Bearer explicit-token',
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer explicit-token');
  });

  it('returns text payloads and empty responses correctly', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.nightowl.test/v1';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(textResponse('pong'))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const { httpClient } = await loadHttpClient();

    await expect(httpClient.get<string>('/health')).resolves.toBe('pong');
    await expect(httpClient.delete<null>('/cart')).resolves.toBeNull();
  });

  it('retries retry-safe requests on transient failures and recovers', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.nightowl.test/v1';
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'temporarily unavailable' }, 500))
      .mockResolvedValueOnce(jsonResponse({ recovered: true }, 200));
    vi.stubGlobal('fetch', fetchMock);

    const { httpClient } = await loadHttpClient();
    const requestPromise = httpClient.get('/events', { maxRetries: 1 });

    await vi.advanceTimersByTimeAsync(250);

    await expect(requestPromise).resolves.toEqual({ recovered: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-idempotent requests', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.nightowl.test/v1';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: 'payment failed', error: 'PAYMENT_FAILED' }, 500));
    vi.stubGlobal('fetch', fetchMock);

    const { httpClient } = await loadHttpClient();

    await expect(httpClient.post('/checkout', { orderId: 'ord_1' }, { maxRetries: 1 })).rejects.toMatchObject({
      message: 'payment failed',
      code: 'PAYMENT_FAILED',
      statusCode: 500,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('wraps timeouts as request timeout errors with request context', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.nightowl.test/v1';
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal;

      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const abortError = new Error('aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { httpClient } = await loadHttpClient();
    const requestExpectation = expect(
      httpClient.get('/slow', { timeoutMs: 100, maxRetries: 0 }),
    ).rejects.toMatchObject({
      message: 'Network request timed out',
      code: 'REQUEST_TIMEOUT',
      details: expect.objectContaining({
        path: '/slow',
        method: 'GET',
        timeoutMs: 100,
        attempt: 0,
      }),
    });

    await vi.advanceTimersByTimeAsync(100);

    await requestExpectation;
  });
});
