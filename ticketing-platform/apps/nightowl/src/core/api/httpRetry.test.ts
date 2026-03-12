import { describe, expect, it } from 'vitest';

import { AppError } from '../errors/appError';
import { getRetryDelayMs, isRetryableNetworkError, shouldRetryRequest, shouldRetryStatus } from './httpRetry';

describe('httpRetry', () => {
  it('detects retryable statuses', () => {
    expect(shouldRetryStatus(408)).toBe(true);
    expect(shouldRetryStatus(429)).toBe(true);
    expect(shouldRetryStatus(500)).toBe(true);
    expect(shouldRetryStatus(400)).toBe(false);
  });

  it('retries only retry-safe methods', () => {
    expect(shouldRetryRequest('GET', 0, 1, undefined, 500)).toBe(true);
    expect(shouldRetryRequest('POST', 0, 1, undefined, 500)).toBe(false);
  });

  it('stops retrying when max retries reached', () => {
    expect(shouldRetryRequest('GET', 1, 1, undefined, 500)).toBe(false);
  });

  it('detects retryable network errors', () => {
    const timeoutError = new AppError({
      message: 'timeout',
      code: 'REQUEST_TIMEOUT',
    });
    const randomError = new AppError({
      message: 'invalid',
      code: 'INVALID_INPUT',
    });

    expect(isRetryableNetworkError(timeoutError)).toBe(true);
    expect(isRetryableNetworkError(randomError)).toBe(false);
  });

  it('calculates bounded retry backoff', () => {
    expect(getRetryDelayMs(0)).toBe(250);
    expect(getRetryDelayMs(1)).toBe(500);
    expect(getRetryDelayMs(2)).toBe(1000);
    expect(getRetryDelayMs(3)).toBe(1000);
  });
});
