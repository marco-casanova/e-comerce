import { describe, expect, it } from 'vitest';

import { parseBoolean, parsePositiveInteger, readParsedPublicEnv } from './publicEnv';

describe('publicEnv', () => {
  it('parses positive integers', () => {
    expect(parsePositiveInteger('1')).toBe(1);
    expect(parsePositiveInteger('120')).toBe(120);
  });

  it('rejects invalid positive integers', () => {
    expect(parsePositiveInteger('0')).toBeNull();
    expect(parsePositiveInteger('-1')).toBeNull();
    expect(parsePositiveInteger('1.2')).toBeNull();
    expect(parsePositiveInteger('abc')).toBeNull();
  });

  it('parses booleans', () => {
    expect(parseBoolean('true')).toBe(true);
    expect(parseBoolean('false')).toBe(false);
    expect(parseBoolean('TRUE')).toBe(true);
    expect(parseBoolean('FALSE')).toBe(false);
  });

  it('returns default when env value is missing or invalid', () => {
    const envKey = 'EXPO_PUBLIC_TEST_CONFIG_VALUE';
    delete process.env[envKey];

    expect(
      readParsedPublicEnv(envKey, {
        defaultValue: 42,
        parse: parsePositiveInteger,
      }),
    ).toBe(42);

    process.env[envKey] = 'invalid';
    expect(
      readParsedPublicEnv(envKey, {
        defaultValue: 42,
        parse: parsePositiveInteger,
      }),
    ).toBe(42);

    delete process.env[envKey];
  });
});
