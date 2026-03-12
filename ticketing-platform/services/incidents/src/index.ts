import { z } from 'zod';

import { query } from '@ticketing/db';
import { AppError, authGuard, createServiceApp, readEnv, requireUser } from '@ticketing/shared';

const env = readEnv({
  PORT: z.string().default('4008'),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(16)
});

const app = createServiceApp('incidents');

const listSchema = z.object({
  eventId: z.string().uuid()
});

const createSchema = z.object({
  eventId: z.string().uuid(),
  title: z.string().min(3),
  description: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  assignedTo: z.string().uuid().optional()
});

const patchSchema = z
  .object({
    title: z.string().min(3).optional(),
    description: z.string().optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    status: z.enum(['open', 'investigating', 'resolved', 'closed']).optional(),
    assignedTo: z.string().uuid().optional().nullable()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided'
  });

app.get('/incidents', { preHandler: authGuard(env.JWT_SECRET, 'incidents:manage') }, async (request) => {
  const queryParams = listSchema.parse(request.query);

  const result = await query<{
    id: string;
    event_id: string;
    title: string;
    description: string | null;
    severity: string;
    status: string;
    reported_by: string | null;
    assigned_to: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `
      SELECT id, event_id, title, description, severity, status, reported_by, assigned_to, created_at, updated_at
      FROM incidents
      WHERE event_id = $1
      ORDER BY created_at DESC
    `,
    [queryParams.eventId]
  );

  return result.rows;
});

app.post('/incidents', { preHandler: authGuard(env.JWT_SECRET, 'incidents:manage') }, async (request, reply) => {
  const user = requireUser(request);
  const body = createSchema.parse(request.body);

  const result = await query<{
    id: string;
    event_id: string;
    title: string;
    description: string | null;
    severity: string;
    status: string;
    reported_by: string | null;
    assigned_to: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `
      INSERT INTO incidents(event_id, title, description, severity, status, reported_by, assigned_to)
      VALUES($1, $2, $3, $4, 'open', $5, $6)
      RETURNING id, event_id, title, description, severity, status, reported_by, assigned_to, created_at, updated_at
    `,
    [body.eventId, body.title, body.description ?? null, body.severity, user.sub, body.assignedTo ?? null]
  );

  await query(
    `
      INSERT INTO analytics_events(event_id, actor_user_id, name, payload)
      VALUES($1, $2, $3, $4::jsonb)
    `,
    [body.eventId, user.sub, 'incident_created', JSON.stringify({ incidentId: result.rows[0].id })]
  );

  return reply.status(201).send(result.rows[0]);
});

app.patch('/incidents/:id', { preHandler: authGuard(env.JWT_SECRET, 'incidents:manage') }, async (request) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params);
  const body = patchSchema.parse(request.body);

  const existing = await query<{ id: string; event_id: string }>('SELECT id, event_id FROM incidents WHERE id = $1', [
    params.id
  ]);

  if (!existing.rows[0]) {
    throw new AppError(404, 'Incident not found', 'INCIDENT_NOT_FOUND');
  }

  const result = await query<{
    id: string;
    event_id: string;
    title: string;
    description: string | null;
    severity: string;
    status: string;
    reported_by: string | null;
    assigned_to: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `
      UPDATE incidents
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          severity = COALESCE($3, severity),
          status = COALESCE($4, status),
          assigned_to = CASE WHEN $5::text = '__UNSET__' THEN assigned_to ELSE $6 END,
          updated_at = NOW()
      WHERE id = $7
      RETURNING id, event_id, title, description, severity, status, reported_by, assigned_to, created_at, updated_at
    `,
    [
      body.title ?? null,
      body.description ?? null,
      body.severity ?? null,
      body.status ?? null,
      body.assignedTo === undefined ? '__UNSET__' : 'SET',
      body.assignedTo ?? null,
      params.id
    ]
  );

  return result.rows[0];
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
