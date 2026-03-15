import { parseBoolean, parsePositiveInteger, readParsedPublicEnv, readPublicEnv } from './publicEnv';

const DEFAULT_API_BASE_URL = 'http://localhost:4000/v1';

function normalizeApiBaseUrl(url: string) {
  return url.replace(/\/+$/, '');
}

function parseApiBaseUrl(rawValue: string) {
  const normalized = normalizeApiBaseUrl(rawValue);

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    return normalized;
  } catch {
    return null;
  }
}

export const API_BASE_URL =
  readParsedPublicEnv('EXPO_PUBLIC_API_URL', {
    defaultValue: DEFAULT_API_BASE_URL,
    parse: parseApiBaseUrl,
  }) ?? DEFAULT_API_BASE_URL;

export const API_REQUEST_TIMEOUT_MS =
  readParsedPublicEnv('EXPO_PUBLIC_API_TIMEOUT_MS', {
    defaultValue: 4500,
    parse: parsePositiveInteger,
  }) ?? 4500;

export const API_MAX_RETRIES =
  readParsedPublicEnv('EXPO_PUBLIC_API_MAX_RETRIES', {
    defaultValue: 1,
    parse: parsePositiveInteger,
  }) ?? 1;

export const APP_ENV = readPublicEnv('EXPO_PUBLIC_APP_ENV') ?? (__DEV__ ? 'development' : 'production');

export const IS_E2E_MODE =
  readParsedPublicEnv('EXPO_PUBLIC_E2E_MODE', {
    parse: parseBoolean,
  }) ?? APP_ENV === 'e2e';

export const ENABLE_VERBOSE_LOGS =
  readParsedPublicEnv('EXPO_PUBLIC_ENABLE_VERBOSE_LOGS', {
    defaultValue: __DEV__,
    parse: parseBoolean,
  }) ?? __DEV__;

export const OBSERVABILITY_PROVIDER = readPublicEnv('EXPO_PUBLIC_OBSERVABILITY_PROVIDER') ?? 'none';

export const APP_CONFIG_ISSUES = {
  hasApiBaseUrlOverride: Boolean(readPublicEnv('EXPO_PUBLIC_API_URL')),
  usingDefaultApiBaseUrl: !readPublicEnv('EXPO_PUBLIC_API_URL'),
};
