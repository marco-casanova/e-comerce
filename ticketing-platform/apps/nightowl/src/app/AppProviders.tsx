import { StatusBar } from "expo-status-bar";
import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StripeProvider } from "@stripe/stripe-react-native";

import { AuthProvider } from "../core/auth/AuthProvider";
import {
  API_BASE_URL,
  APP_CONFIG_ISSUES,
  APP_ENV,
  OBSERVABILITY_PROVIDER,
} from "../core/config/appConfig";
import { syncRuntimeModeFromUrl } from "../core/config/runtimeMode";
import { AppErrorBoundary } from "../core/errors/AppErrorBoundary";
import { logger } from "../core/monitoring/logger";
import { initializeObservability } from "../core/monitoring/observability";
import {
  STRIPE_MERCHANT_IDENTIFIER,
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_URL_SCHEME,
} from "../core/payments/stripeConfig";

export function AppProviders({ children }: PropsWithChildren) {
  const content = children ? <>{children}</> : <></>;
  const [isRuntimeReady, setIsRuntimeReady] = useState(false);

  useEffect(() => {
    void initializeObservability();

    logger.info("Night Owl bootstrap", {
      appEnv: APP_ENV,
      apiBaseUrl: API_BASE_URL,
      observabilityProvider: OBSERVABILITY_PROVIDER,
    });

    if (APP_ENV === "production" && APP_CONFIG_ISSUES.usingDefaultApiBaseUrl) {
      logger.warn("Production build is using default API base URL", {
        apiBaseUrl: API_BASE_URL,
      });
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const syncInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      const enabledE2E = syncRuntimeModeFromUrl(initialUrl);

      if (enabledE2E) {
        logger.info("Runtime E2E mode enabled from initial URL", {
          initialUrl,
        });
      }

      if (isMounted) {
        setIsRuntimeReady(true);
      }
    };

    void syncInitialUrl();

    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (syncRuntimeModeFromUrl(url)) {
        logger.info("Runtime E2E mode enabled from incoming URL", { url });
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthProvider>
          <StripeProvider
            merchantIdentifier={STRIPE_MERCHANT_IDENTIFIER}
            publishableKey={STRIPE_PUBLISHABLE_KEY ?? ""}
            urlScheme={STRIPE_URL_SCHEME}
          >
            {isRuntimeReady ? content : <BootstrapScreen />}
          </StripeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

function BootstrapScreen() {
  return (
    <View style={styles.bootstrapScreen}>
      <ActivityIndicator color="#f0b35c" size="large" />
      <Text style={styles.bootstrapText}>Preparing Night Owl</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bootstrapScreen: {
    alignItems: "center",
    flex: 1,
    gap: 14,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  bootstrapText: {
    color: "#d7ddeb",
    fontSize: 16,
    fontWeight: "600",
  },
});
