function readPublicEnv(name: string) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return undefined;
  }

  const value = rawValue.trim();
  return value.length ? value : undefined;
}

export const STRIPE_PUBLISHABLE_KEY = readPublicEnv('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY');
export const STRIPE_MERCHANT_DISPLAY_NAME =
  readPublicEnv('EXPO_PUBLIC_STRIPE_MERCHANT_DISPLAY_NAME') ?? 'Night Owl';
export const STRIPE_URL_SCHEME = readPublicEnv('EXPO_PUBLIC_STRIPE_URL_SCHEME') ?? 'nightowl';
export const STRIPE_RETURN_URL = `${STRIPE_URL_SCHEME}://stripe-redirect`;
export const STRIPE_MERCHANT_IDENTIFIER = readPublicEnv('EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER');
export const isStripeConfigured = Boolean(STRIPE_PUBLISHABLE_KEY);
