import { afterEach, vi } from 'vitest';

const baseEnv = { ...process.env };
const globalWithDev = globalThis as typeof globalThis & { __DEV__?: boolean };

globalWithDev.__DEV__ = false;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();

  for (const key of Object.keys(process.env)) {
    if (!(key in baseEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, baseEnv);
  globalWithDev.__DEV__ = false;
});
