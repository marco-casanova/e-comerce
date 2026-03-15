import { describe, expect, it, vi } from 'vitest';

const globalWithDev = globalThis as typeof globalThis & { __DEV__?: boolean };

async function loadAppConfig() {
  vi.resetModules();
  return import('./appConfig');
}

describe('appConfig', () => {
  it('uses production-safe defaults when env is missing', async () => {
    globalWithDev.__DEV__ = false;

    const config = await loadAppConfig();

    expect(config.API_BASE_URL).toBe('http://localhost:4000/v1');
    expect(config.API_REQUEST_TIMEOUT_MS).toBe(4500);
    expect(config.API_MAX_RETRIES).toBe(1);
    expect(config.APP_ENV).toBe('production');
    expect(config.ENABLE_VERBOSE_LOGS).toBe(false);
    expect(config.OBSERVABILITY_PROVIDER).toBe('none');
    expect(config.APP_CONFIG_ISSUES).toEqual({
      hasApiBaseUrlOverride: false,
      usingDefaultApiBaseUrl: true,
    });
  });

  it('parses valid env overrides and normalizes the api base url', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.nightowl.test/v1///';
    process.env.EXPO_PUBLIC_API_TIMEOUT_MS = '6000';
    process.env.EXPO_PUBLIC_API_MAX_RETRIES = '3';
    process.env.EXPO_PUBLIC_APP_ENV = 'staging';
    process.env.EXPO_PUBLIC_ENABLE_VERBOSE_LOGS = 'true';
    process.env.EXPO_PUBLIC_OBSERVABILITY_PROVIDER = 'sentry';

    const config = await loadAppConfig();

    expect(config.API_BASE_URL).toBe('https://api.nightowl.test/v1');
    expect(config.API_REQUEST_TIMEOUT_MS).toBe(6000);
    expect(config.API_MAX_RETRIES).toBe(3);
    expect(config.APP_ENV).toBe('staging');
    expect(config.ENABLE_VERBOSE_LOGS).toBe(true);
    expect(config.OBSERVABILITY_PROVIDER).toBe('sentry');
    expect(config.APP_CONFIG_ISSUES).toEqual({
      hasApiBaseUrlOverride: true,
      usingDefaultApiBaseUrl: false,
    });
  });

  it('falls back to defaults when env overrides are invalid and honors __DEV__ defaults', async () => {
    globalWithDev.__DEV__ = true;
    process.env.EXPO_PUBLIC_API_URL = 'ftp://invalid-url';
    process.env.EXPO_PUBLIC_API_TIMEOUT_MS = 'slow';
    process.env.EXPO_PUBLIC_API_MAX_RETRIES = '-1';
    process.env.EXPO_PUBLIC_ENABLE_VERBOSE_LOGS = 'maybe';

    const config = await loadAppConfig();

    expect(config.API_BASE_URL).toBe('http://localhost:4000/v1');
    expect(config.API_REQUEST_TIMEOUT_MS).toBe(4500);
    expect(config.API_MAX_RETRIES).toBe(1);
    expect(config.APP_ENV).toBe('development');
    expect(config.ENABLE_VERBOSE_LOGS).toBe(true);
  });
});
