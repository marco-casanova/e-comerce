import type { ExpoConfig } from 'expo/config';

const { expo: baseConfig } = require('./app.json') as { expo: ExpoConfig };
type PluginEntry = NonNullable<ExpoConfig['plugins']>[number];

function withStripePluginOptions(
  plugins: ExpoConfig['plugins'],
  merchantIdentifier?: string,
): ExpoConfig['plugins'] {
  const stripeOptions: Record<string, string> = {};
  if (merchantIdentifier) {
    stripeOptions.merchantIdentifier = merchantIdentifier;
  }

  const stripePluginEntry: [string, Record<string, string>] = ['@stripe/stripe-react-native', stripeOptions];
  let hasStripePlugin = false;

  const nextPlugins: PluginEntry[] =
    plugins?.map((plugin): PluginEntry => {
      if (plugin === '@stripe/stripe-react-native') {
        hasStripePlugin = true;
        return stripePluginEntry;
      }

      if (Array.isArray(plugin) && plugin[0] === '@stripe/stripe-react-native') {
        hasStripePlugin = true;
        const existingOptions =
          plugin[1] && typeof plugin[1] === 'object' && !Array.isArray(plugin[1]) ? plugin[1] : {};

        return ['@stripe/stripe-react-native', { ...existingOptions, ...stripeOptions }] as [string, any];
      }

      return plugin;
    }) ?? [];

  if (!hasStripePlugin) {
    nextPlugins.unshift(stripePluginEntry);
  }

  return nextPlugins;
}

export default (): ExpoConfig => {
  const stripeMerchantIdentifier = process.env.EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER;
  const stripeUrlScheme = process.env.EXPO_PUBLIC_STRIPE_URL_SCHEME;

  return {
    ...baseConfig,
    scheme: stripeUrlScheme ?? baseConfig.scheme,
    plugins: withStripePluginOptions(baseConfig.plugins, stripeMerchantIdentifier),
  };
};
