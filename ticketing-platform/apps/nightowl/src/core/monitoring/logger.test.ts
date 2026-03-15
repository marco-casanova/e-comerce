import { describe, expect, it, vi } from 'vitest';

async function loadLogger() {
  vi.resetModules();
  return import('./logger');
}

describe('logger', () => {
  it('suppresses info logs in production when verbose logs are disabled', async () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    process.env.EXPO_PUBLIC_ENABLE_VERBOSE_LOGS = 'false';
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { logger } = await loadLogger();

    logger.info('hidden message');

    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('prints info logs outside production and serializes metadata', async () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'development';
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { logger } = await loadLogger();

    logger.info('boot', {
      feature: 'checkout',
      attempt: 2,
      callback: () => 'ignored',
    });

    expect(infoSpy).toHaveBeenCalledWith('[nightowl:info]', 'boot', {
      feature: 'checkout',
      attempt: 2,
    });
  });

  it('always prints warnings and errors', async () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    process.env.EXPO_PUBLIC_ENABLE_VERBOSE_LOGS = 'false';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { logger } = await loadLogger();

    logger.warn('warning message');
    logger.error('error message');

    expect(warnSpy).toHaveBeenCalledWith('[nightowl:warn]', 'warning message');
    expect(errorSpy).toHaveBeenCalledWith('[nightowl:error]', 'error message');
  });
});
