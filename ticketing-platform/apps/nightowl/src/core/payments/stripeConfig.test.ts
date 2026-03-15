import { describe, expect, it, vi } from 'vitest';

async function loadStripeConfig() {
  vi.resetModules();
  return import('./stripeConfig');
}

describe('stripeConfig', () => {
  it('uses safe defaults when Stripe env is missing', async () => {
    const config = await loadStripeConfig();

    expect(config.STRIPE_PUBLISHABLE_KEY).toBeUndefined();
    expect(config.STRIPE_MERCHANT_DISPLAY_NAME).toBe('Night Owl');
    expect(config.STRIPE_URL_SCHEME).toBe('nightowl');
    expect(config.STRIPE_RETURN_URL).toBe('nightowl://stripe-redirect');
    expect(config.STRIPE_MERCHANT_IDENTIFIER).toBeUndefined();
    expect(config.isStripeConfigured).toBe(false);
  });

  it('uses explicit Stripe env overrides', async () => {
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
    process.env.EXPO_PUBLIC_STRIPE_MERCHANT_DISPLAY_NAME = 'Night Owl Club';
    process.env.EXPO_PUBLIC_STRIPE_URL_SCHEME = 'nightowl-pay';
    process.env.EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER = 'merchant.com.nightowl.club';

    const config = await loadStripeConfig();

    expect(config.STRIPE_PUBLISHABLE_KEY).toBe('pk_test_123');
    expect(config.STRIPE_MERCHANT_DISPLAY_NAME).toBe('Night Owl Club');
    expect(config.STRIPE_URL_SCHEME).toBe('nightowl-pay');
    expect(config.STRIPE_RETURN_URL).toBe('nightowl-pay://stripe-redirect');
    expect(config.STRIPE_MERCHANT_IDENTIFIER).toBe('merchant.com.nightowl.club');
    expect(config.isStripeConfigured).toBe(true);
  });
});
