import { toAppError } from '../errors/appError';

const RETRYABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function shouldRetryStatus(statusCode: number) {
  return statusCode === 408 || statusCode === 429 || statusCode >= 500;
}

export function isRetryableNetworkError(error: unknown) {
  const appError = toAppError(error);
  return appError.code === 'REQUEST_TIMEOUT' || appError.code === 'UNEXPECTED_ERROR';
}

export function shouldRetryRequest(
  method: string,
  attempt: number,
  maxRetries: number,
  error?: unknown,
  statusCode?: number,
) {
  if (attempt >= maxRetries) {
    return false;
  }

  if (!RETRYABLE_METHODS.has(method.toUpperCase())) {
    return false;
  }

  if (typeof statusCode === 'number') {
    return shouldRetryStatus(statusCode);
  }

  return isRetryableNetworkError(error);
}

export function getRetryDelayMs(attempt: number) {
  const baseMs = 250 * 2 ** attempt;
  return Math.min(baseMs, 1000);
}
