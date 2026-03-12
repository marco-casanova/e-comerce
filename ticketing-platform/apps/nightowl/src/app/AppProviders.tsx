import { StatusBar } from 'expo-status-bar';
import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';

import { AuthProvider } from '../core/auth/AuthProvider';
import { API_BASE_URL, APP_CONFIG_ISSUES, APP_ENV, OBSERVABILITY_PROVIDER } from '../core/config/appConfig';
import { AppErrorBoundary } from '../core/errors/AppErrorBoundary';
import { logger } from '../core/monitoring/logger';
import { initializeObservability } from '../core/monitoring/observability';
import { STRIPE_MERCHANT_IDENTIFIER, STRIPE_PUBLISHABLE_KEY, STRIPE_URL_SCHEME } from '../core/payments/stripeConfig';

export function AppProviders({ children }: PropsWithChildren) {
  const content = children ? <>{children}</> : <></>;

  useEffect(() => {
    void initializeObservability();

    logger.info('Night Owl bootstrap', {
      appEnv: APP_ENV,
      apiBaseUrl: API_BASE_URL,
      observabilityProvider: OBSERVABILITY_PROVIDER,
    });

    if (APP_ENV === 'production' && APP_CONFIG_ISSUES.usingDefaultApiBaseUrl) {
      logger.warn('Production build is using default API base URL', { apiBaseUrl: API_BASE_URL });
    }
  }, []);

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthProvider>
          <StripeProvider
            merchantIdentifier={STRIPE_MERCHANT_IDENTIFIER}
            publishableKey={STRIPE_PUBLISHABLE_KEY ?? ''}
            urlScheme={STRIPE_URL_SCHEME}
          >
            {content}
          </StripeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
