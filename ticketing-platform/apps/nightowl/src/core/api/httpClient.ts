import { API_BASE_URL, API_MAX_RETRIES, API_REQUEST_TIMEOUT_MS } from './apiConfig';
import { AppError, toAppError } from '../errors/appError';
import { logger } from '../monitoring/logger';
import { getRetryDelayMs, shouldRetryRequest } from './httpRetry';

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  timeoutMs?: number;
  maxRetries?: number;
};

type AccessTokenProvider = () => string | null;

let accessTokenProvider: AccessTokenProvider = () => null;

export function setAccessTokenProvider(provider: AccessTokenProvider) {
  accessTokenProvider = provider;
}

async function parseResponse(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

function createRequestId() {
  return `req_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const accessToken = accessTokenProvider();
  const requestId = createRequestId();
  const method = (options.method ?? 'GET').toUpperCase();
  const timeoutMs = options.timeoutMs ?? API_REQUEST_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? API_MAX_RETRIES;

  headers.set('x-client-request-id', requestId);

  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let response: Response;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        method,
        signal: controller.signal,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new AppError({
          message: 'Network request timed out',
          code: 'REQUEST_TIMEOUT',
          details: { path, method, requestId, timeoutMs, attempt },
          cause: error,
        });

        if (shouldRetryRequest(method, attempt, maxRetries, timeoutError)) {
          await wait(getRetryDelayMs(attempt));
          continue;
        }

        throw timeoutError;
      }

      const normalizedError = toAppError(error);
      if (shouldRetryRequest(method, attempt, maxRetries, normalizedError)) {
        await wait(getRetryDelayMs(attempt));
        continue;
      }

      normalizedError.details = {
        ...(typeof normalizedError.details === 'object' && normalizedError.details ? normalizedError.details : {}),
        path,
        method,
        requestId,
        attempt,
      };
      throw normalizedError;
    } finally {
      clearTimeout(timeoutId);
    }

    const payload = await parseResponse(response);

    if (!response.ok) {
      if (shouldRetryRequest(method, attempt, maxRetries, undefined, response.status)) {
        await wait(getRetryDelayMs(attempt));
        continue;
      }

      throw new AppError({
        message:
          payload && typeof payload === 'object' && 'message' in payload
            ? String(payload.message)
            : `Request failed with status ${response.status}`,
        code:
          payload && typeof payload === 'object' && 'error' in payload
            ? String(payload.error)
            : 'REQUEST_FAILED',
        statusCode: response.status,
        details: {
          payload,
          path,
          method,
          requestId,
          attempt,
        },
      });
    }

    if (attempt > 0) {
      logger.info('HTTP request recovered after retry', { method, path, attempt, requestId });
    }

    return payload as T;
  }

  throw new AppError({
    message: 'Request failed after retries',
    code: 'REQUEST_RETRIES_EXHAUSTED',
    details: { path, method, requestId, maxRetries },
  });
}

export const httpClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
