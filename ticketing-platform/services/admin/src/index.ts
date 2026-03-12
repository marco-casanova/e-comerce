import Redis from 'ioredis';
import { z } from 'zod';

import { query } from '@ticketing/db';
import { AppError, authGuard, createServiceApp, readEnv, requireUser } from '@ticketing/shared';

const env = readEnv({
  PORT: z.string().default('4007'),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(16),
  REDIS_URL: z.string().default('redis://localhost:6379')
});

const app = createServiceApp('admin');
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1 });

const paramsSchema = z.object({ eventId: z.string().uuid() });
const patchOpsSchema = z.object({
  status: z.string().min(1),
  notes: z.string().optional()
});

async function cacheJson<T>(key: string, ttlSeconds: number, resolver: () => Promise<T>): Promise<T> {
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached) as T;
  }

  const value = await resolver();
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
  return value;
}

async function clearAdminCache(eventId: string) {
  await redis.del(`admin:metrics:${eventId}`, `admin:funnel:${eventId}`, `admin:ops:${eventId}`);
}

app.get('/admin/events/:eventId/metrics', { preHandler: authGuard(env.JWT_SECRET, 'metrics:read') }, async (request) => {
  const { eventId } = paramsSchema.parse(request.params);

  return cacheJson(`admin:metrics:${eventId}`, 20, async () => {
    const registeredResult = await query<{ count: string }>(
      `
        SELECT COALESCE(SUM(oi.quantity), 0)::text AS count
        FROM order_items oi
        INNER JOIN ticket_types tt ON tt.id = oi.ticket_type_id
        WHERE tt.event_id = $1
      `,
      [eventId]
    );

    const paidResult = await query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM tickets
        WHERE event_id = $1
      `,
      [eventId]
    );

    const checkinResult = await query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM checkins
        WHERE event_id = $1
      `,
      [eventId]
    );

    const registered = Number(registeredResult.rows[0]?.count ?? 0);
    const paid = Number(paidResult.rows[0]?.count ?? 0);
    const checkedIn = Number(checkinResult.rows[0]?.count ?? 0);

    const paidRate = registered > 0 ? Number(((paid / registered) * 100).toFixed(2)) : 0;
    const checkedInRate = paid > 0 ? Number(((checkedIn / paid) * 100).toFixed(2)) : 0;

    return {
      eventId,
      registered,
      paid,
      checkedIn,
      paidRate,
      checkedInRate
    };
  });
});

app.get('/admin/events/:eventId/funnel', { preHandler: authGuard(env.JWT_SECRET, 'metrics:read') }, async (request) => {
  const { eventId } = paramsSchema.parse(request.params);

  return cacheJson(`admin:funnel:${eventId}`, 20, async () => {
    const result = await query<{ name: string; count: string }>(
      `
        SELECT name, COUNT(*)::text AS count
        FROM analytics_events
        WHERE event_id = $1
          AND name IN ('event_viewed', 'add_to_cart', 'checkout_started', 'checkout_completed')
        GROUP BY name
      `,
      [eventId]
    );

    const counts = Object.fromEntries(result.rows.map((row) => [row.name, Number(row.count)]));

    const viewed = counts.event_viewed ?? 0;
    const added = counts.add_to_cart ?? 0;
    const checkoutStarted = counts.checkout_started ?? 0;
    const checkoutCompleted = counts.checkout_completed ?? 0;

    return {
      eventId,
      viewed,
      added,
      checkoutStarted,
      checkoutCompleted,
      addToCartRate: viewed ? Number(((added / viewed) * 100).toFixed(2)) : 0,
      checkoutStartRate: added ? Number(((checkoutStarted / added) * 100).toFixed(2)) : 0,
      conversionRate: viewed ? Number(((checkoutCompleted / viewed) * 100).toFixed(2)) : 0
    };
  });
});

app.get('/admin/events/:eventId/ops-status', { preHandler: authGuard(env.JWT_SECRET, 'ops:read') }, async (request) => {
  const { eventId } = paramsSchema.parse(request.params);

  return cacheJson(`admin:ops:${eventId}`, 10, async () => {
    const result = await query<{
      event_id: string;
      status: string;
      notes: string | null;
      updated_by: string | null;
      updated_at: string;
    }>(
      `
        SELECT event_id, status, notes, updated_by, updated_at
        FROM event_ops_status
        WHERE event_id = $1
      `,
      [eventId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, 'Ops status not found for event', 'OPS_STATUS_NOT_FOUND');
    }

    return row;
  });
});

app.patch('/admin/events/:eventId/ops-status', { preHandler: authGuard(env.JWT_SECRET, 'ops:write') }, async (request) => {
  const user = requireUser(request);
  const { eventId } = paramsSchema.parse(request.params);
  const body = patchOpsSchema.parse(request.body);

  const result = await query<{
    event_id: string;
    status: string;
    notes: string | null;
    updated_by: string | null;
    updated_at: string;
  }>(
    `
      INSERT INTO event_ops_status(event_id, status, notes, updated_by)
      VALUES($1, $2, $3, $4)
      ON CONFLICT (event_id)
      DO UPDATE SET status = EXCLUDED.status,
                    notes = EXCLUDED.notes,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = NOW()
      RETURNING event_id, status, notes, updated_by, updated_at
    `,
    [eventId, body.status, body.notes ?? null, user.sub]
  );

  await clearAdminCache(eventId);
  return result.rows[0];
});

app.addHook('onClose', async () => {
  await redis.quit();
});

async function start() {
  try {
    await app.listen({
      port: Number(env.PORT),
      host: env.HOST
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
