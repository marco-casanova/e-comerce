import { z } from 'zod';

import { query } from '@ticketing/db';
import { authGuard, createServiceApp, readEnv, requireUser } from '@ticketing/shared';

const env = readEnv({
  PORT: z.string().default('4009'),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(16)
});

const app = createServiceApp('analytics');

const trackSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().min(1),
  payload: z.record(z.any()).optional()
});

app.post('/analytics/track', { preHandler: authGuard(env.JWT_SECRET, 'analytics:write') }, async (request, reply) => {
  const user = requireUser(request);
  const body = trackSchema.parse(request.body);

  const result = await query<{ id: number }>(
    `
      INSERT INTO analytics_events(event_id, actor_user_id, name, payload)
      VALUES($1, $2, $3, $4::jsonb)
      RETURNING id
    `,
    [body.eventId, user.sub, body.name, JSON.stringify(body.payload ?? {})]
  );

  return reply.status(201).send({
    id: result.rows[0].id,
    eventId: body.eventId,
    name: body.name
  });
});

app.get('/analytics/events/:eventId/summary', { preHandler: authGuard(env.JWT_SECRET, 'analytics:read') }, async (request) => {
  const params = z.object({ eventId: z.string().uuid() }).parse(request.params);

  const totalsResult = await query<{ total: string }>(
    `
      SELECT COUNT(*)::text AS total
      FROM analytics_events
      WHERE event_id = $1
    `,
    [params.eventId]
  );

  const byNameResult = await query<{ name: string; count: string }>(
    `
      SELECT name, COUNT(*)::text AS count
      FROM analytics_events
      WHERE event_id = $1
      GROUP BY name
      ORDER BY count DESC
    `,
    [params.eventId]
  );

  const hourlyResult = await query<{ hour_bucket: string; count: string }>(
    `
      SELECT date_trunc('hour', created_at)::text AS hour_bucket, COUNT(*)::text AS count
      FROM analytics_events
      WHERE event_id = $1
      GROUP BY hour_bucket
      ORDER BY hour_bucket DESC
      LIMIT 24
    `,
    [params.eventId]
  );

  return {
    eventId: params.eventId,
    totalEvents: Number(totalsResult.rows[0]?.total ?? 0),
    byName: byNameResult.rows.map((row) => ({ name: row.name, count: Number(row.count) })),
    last24Hours: hourlyResult.rows.map((row) => ({
      hour: row.hour_bucket,
      count: Number(row.count)
    }))
  };
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
