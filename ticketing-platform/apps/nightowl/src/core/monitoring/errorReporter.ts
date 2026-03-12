import { toAppError } from '../errors/appError';
import { logger } from './logger';
import { captureObservedError } from './observability';

type ErrorContext = {
  domain: string;
  action?: string;
  details?: Record<string, unknown>;
};

export function reportError(error: unknown, context: ErrorContext) {
  const appError = toAppError(error);
  const observedError =
    appError.cause instanceof Error
      ? appError.cause
      : new Error(appError.message);

  captureObservedError(observedError, context);

  logger.error(appError.message, {
    code: appError.code,
    statusCode: appError.statusCode,
    context,
    details: appError.details,
  });
}
