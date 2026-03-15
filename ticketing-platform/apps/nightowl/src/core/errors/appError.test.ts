import { describe, expect, it } from 'vitest';

import { AppError, toAppError } from './appError';

describe('appError', () => {
  it('preserves structured app error details', () => {
    const cause = new Error('root cause');
    const error = new AppError({
      message: 'Request failed',
      code: 'REQUEST_FAILED',
      statusCode: 422,
      details: { field: 'email' },
      cause,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AppError');
    expect(error.message).toBe('Request failed');
    expect(error.code).toBe('REQUEST_FAILED');
    expect(error.statusCode).toBe(422);
    expect(error.details).toEqual({ field: 'email' });
    expect(error.cause).toBe(cause);
  });

  it('returns app errors unchanged', () => {
    const original = new AppError({
      message: 'No change',
      code: 'KEEP_ME',
    });

    expect(toAppError(original)).toBe(original);
  });

  it('normalizes native errors', () => {
    const original = new Error('boom');
    const normalized = toAppError(original);

    expect(normalized).toBeInstanceOf(AppError);
    expect(normalized.message).toBe('boom');
    expect(normalized.code).toBe('UNEXPECTED_ERROR');
    expect(normalized.cause).toBe(original);
  });

  it('normalizes non-error values', () => {
    const normalized = toAppError({ unexpected: true });

    expect(normalized).toBeInstanceOf(AppError);
    expect(normalized.message).toBe('Unexpected error');
    expect(normalized.code).toBe('UNEXPECTED_ERROR');
    expect(normalized.details).toEqual({ unexpected: true });
  });
});
