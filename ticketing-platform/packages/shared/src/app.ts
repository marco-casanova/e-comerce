import { randomUUID } from 'node:crypto';

import Fastify from 'fastify';
import { ZodError } from 'zod';

import { AppError } from './errors';

export interface ServiceMetrics {
  startedAt: number;
  requests: number;
  errors: number;
}

export function createServiceApp(serviceName: string) {
  const metrics: ServiceMetrics = {
    startedAt: Date.now(),
    requests: 0,
    errors: 0
  };

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      base: {
        service: serviceName
      }
    },
    genReqId: () => randomUUID()
  });

  app.addHook('onResponse', async (_request, reply) => {
    metrics.requests += 1;
    if (reply.statusCode >= 400) {
      metrics.errors += 1;
    }
  });

  app.get('/health', async () => ({
    service: serviceName,
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime())
  }));

  app.get('/metrics', async () => ({
    service: serviceName,
    requests: metrics.requests,
    errors: metrics.errors,
    uptimeSeconds: Math.floor((Date.now() - metrics.startedAt) / 1000)
  }));

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      request.log.warn({ err: error, code: error.code }, error.message);
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
        details: error.details ?? null
      });
    }

    if (error instanceof ZodError) {
      request.log.warn({ err: error }, 'Request validation error');
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: error.flatten()
      });
    }

    request.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected error'
    });
  });

  return app;
}
