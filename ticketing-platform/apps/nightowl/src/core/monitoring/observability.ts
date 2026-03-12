import { OBSERVABILITY_PROVIDER } from '../config/appConfig';
import { logger } from './logger';

export type ObservabilityContext = {
  domain?: string;
  action?: string;
  details?: Record<string, unknown>;
};

export type ObservabilityUser = {
  id: string;
  email?: string;
  roles?: string[];
};

export type ObservabilityAdapter = {
  init?: () => void | Promise<void>;
  captureError?: (error: Error, context?: ObservabilityContext) => void;
  captureMessage?: (message: string, context?: ObservabilityContext) => void;
  setUser?: (user: ObservabilityUser | null) => void;
};

const noopAdapter: ObservabilityAdapter = {};
let adapter: ObservabilityAdapter = noopAdapter;
let initialized = false;

function createConsoleAdapter(): ObservabilityAdapter {
  return {
    captureError(error, context) {
      logger.error(error.message, {
        code: 'OBSERVED_ERROR',
        context,
        stack: error.stack,
      });
    },
    captureMessage(message, context) {
      logger.info(message, { context });
    },
    setUser(user) {
      logger.debug('Observability user updated', { user });
    },
  };
}

export function configureObservability(nextAdapter: ObservabilityAdapter) {
  adapter = nextAdapter;
}

export async function initializeObservability() {
  if (initialized) {
    return;
  }

  if (OBSERVABILITY_PROVIDER === 'console') {
    configureObservability(createConsoleAdapter());
  }

  if (adapter.init) {
    await adapter.init();
  }

  initialized = true;
}

export function captureObservedError(error: Error, context?: ObservabilityContext) {
  adapter.captureError?.(error, context);
}

export function captureObservedMessage(message: string, context?: ObservabilityContext) {
  adapter.captureMessage?.(message, context);
}

export function setObservedUser(user: ObservabilityUser | null) {
  adapter.setUser?.(user);
}
