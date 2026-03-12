import Redis from 'ioredis';
import { z } from 'zod';

import { query } from '@ticketing/db';
import { AppError, authGuard, createServiceApp, readEnv } from '@ticketing/shared';

const env = readEnv({
  PORT: z.string().default('4002'),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(16),
  REDIS_URL: z.string().default('redis://localhost:6379')
});

const app = createServiceApp('catalog');
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1 });

const eventSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  venue: z.string().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  capacity: z.number().int().nonnegative(),
  status: z.enum(['draft', 'published', 'cancelled']).default('draft')
}).superRefine((value, context) => {
  if (!value.endsAt) {
    return;
  }

  if (new Date(value.endsAt).getTime() <= new Date(value.startsAt).getTime()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endsAt'],
      message: 'endsAt must be later than startsAt'
    });
  }
});

const ticketTypeSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().default('usd'),
  totalQuantity: z.number().int().positive()
});

const addOnSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.enum(['merch', 'food', 'drink', 'combo', 'other']).default('other'),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().default('usd'),
  totalQuantity: z.number().int().nonnegative(),
  isActive: z.boolean().default(true)
});

async function cacheJson<T>(key: string, ttlSeconds: number, resolver: () => Promise<T>): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    app.log.warn({ err: error, key }, 'Catalog cache read failed; serving uncached response');
    return resolver();
  }

  const value = await resolver();

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    app.log.warn({ err: error, key }, 'Catalog cache write failed; continuing without cache');
  }

  return value;
}

async function clearEventCache(eventId?: string) {
  const keys = ['catalog:events'];
  if (eventId) {
    keys.push(`catalog:event:${eventId}`);
  }
  if (keys.length) {
    try {
      await redis.del(...keys);
    } catch (error) {
      app.log.warn({ err: error, keys }, 'Catalog cache invalidation failed');
    }
  }
}

async function ensureEventExists(eventId: string) {
  const result = await query<{ id: string }>('SELECT id FROM events WHERE id = $1', [eventId]);
  if (!result.rows[0]) {
    throw new AppError(404, 'Event not found', 'EVENT_NOT_FOUND');
  }
}

async function ensurePublishedEventExists(eventId: string) {
  const result = await query<{ id: string }>(
    `
      SELECT id
      FROM events
      WHERE id = $1
        AND status = 'published'
    `,
    [eventId]
  );

  if (!result.rows[0]) {
    throw new AppError(404, 'Event not found', 'EVENT_NOT_FOUND');
  }
}

function isForeignKeyViolation(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23503'
  );
}

app.get('/events', async () => {
  return cacheJson('catalog:events', 15, async () => {
    const result = await query<{
      id: string;
      title: string;
      description: string | null;
      venue: string | null;
      starts_at: string;
      ends_at: string | null;
      capacity: number;
      status: string;
    }>(
      `
        SELECT id, title, description, venue, starts_at, ends_at, capacity, status
        FROM events
        WHERE status = 'published'
        ORDER BY starts_at ASC
      `
    );

    return result.rows;
  });
});

app.get('/events/:id', async (request) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params);

  return cacheJson(`catalog:event:${params.id}`, 15, async () => {
    const eventResult = await query<{
      id: string;
      title: string;
      description: string | null;
      venue: string | null;
      starts_at: string;
      ends_at: string | null;
      capacity: number;
      status: string;
    }>(
      `
        SELECT id, title, description, venue, starts_at, ends_at, capacity, status
        FROM events
        WHERE id = $1
          AND status = 'published'
      `,
      [params.id]
    );

    const event = eventResult.rows[0];
    if (!event) {
      throw new AppError(404, 'Event not found', 'EVENT_NOT_FOUND');
    }

    const ticketTypesResult = await query<{
      id: string;
      event_id: string;
      name: string;
      description: string | null;
      price_cents: number;
      currency: string;
      total_quantity: number;
      sold_quantity: number;
    }>(
      `
        SELECT id, event_id, name, description, price_cents, currency, total_quantity, sold_quantity
        FROM ticket_types
        WHERE event_id = $1
        ORDER BY created_at ASC
      `,
      [params.id]
    );

    const addOnsResult = await query<{
      id: string;
      event_id: string;
      name: string;
      description: string | null;
      category: string;
      price_cents: number;
      currency: string;
      total_quantity: number;
      reserved_quantity: number;
      sold_quantity: number;
      is_active: boolean;
    }>(
      `
        SELECT
          id,
          event_id,
          name,
          description,
          category,
          price_cents,
          currency,
          total_quantity,
          reserved_quantity,
          sold_quantity,
          is_active
        FROM event_add_ons
        WHERE event_id = $1
          AND is_active = TRUE
        ORDER BY created_at ASC
      `,
      [params.id]
    );

    return {
      ...event,
      ticketTypes: ticketTypesResult.rows,
      addOns: addOnsResult.rows
    };
  });
});

app.get('/events/:id/ticket-types', async (request) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params);
  await ensurePublishedEventExists(params.id);

  const result = await query<{
    id: string;
    event_id: string;
    name: string;
    description: string | null;
    price_cents: number;
    currency: string;
    total_quantity: number;
    sold_quantity: number;
  }>(
    `
      SELECT id, event_id, name, description, price_cents, currency, total_quantity, sold_quantity
      FROM ticket_types
      WHERE event_id = $1
      ORDER BY created_at ASC
    `,
    [params.id]
  );

  return result.rows;
});

app.get('/events/:id/add-ons', async (request) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params);
  await ensurePublishedEventExists(params.id);

  const result = await query<{
    id: string;
    event_id: string;
    name: string;
    description: string | null;
    category: string;
    price_cents: number;
    currency: string;
    total_quantity: number;
    reserved_quantity: number;
    sold_quantity: number;
    is_active: boolean;
  }>(
    `
      SELECT
        id,
        event_id,
        name,
        description,
        category,
        price_cents,
        currency,
        total_quantity,
        reserved_quantity,
        sold_quantity,
        is_active
      FROM event_add_ons
      WHERE event_id = $1
        AND is_active = TRUE
      ORDER BY created_at ASC
    `,
    [params.id]
  );

  return result.rows;
});

app.post('/admin/events', { preHandler: authGuard(env.JWT_SECRET, 'catalog:write') }, async (request, reply) => {
  const body = eventSchema.parse(request.body);
  const userId = request.user?.sub ?? null;

  const result = await query<{ id: string }>(
    `
      INSERT INTO events(title, description, venue, starts_at, ends_at, capacity, status, created_by)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `,
    [
      body.title,
      body.description ?? null,
      body.venue ?? null,
      body.startsAt,
      body.endsAt ?? null,
      body.capacity,
      body.status,
      userId
    ]
  );

  await query(
    'INSERT INTO event_ops_status(event_id, status, updated_by) VALUES($1, $2, $3) ON CONFLICT DO NOTHING',
    [result.rows[0].id, 'normal', userId]
  );

  await clearEventCache(result.rows[0].id);

  return reply.status(201).send({ id: result.rows[0].id });
});

app.put('/admin/events/:id', { preHandler: authGuard(env.JWT_SECRET, 'catalog:write') }, async (request) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params);
  const body = eventSchema.parse(request.body);

  const result = await query(
    `
      UPDATE events
      SET title = $1,
          description = $2,
          venue = $3,
          starts_at = $4,
          ends_at = $5,
          capacity = $6,
          status = $7,
          updated_at = NOW()
      WHERE id = $8
    `,
    [
      body.title,
      body.description ?? null,
      body.venue ?? null,
      body.startsAt,
      body.endsAt ?? null,
      body.capacity,
      body.status,
      params.id
    ]
  );

  if (!result.rowCount) {
    throw new AppError(404, 'Event not found', 'EVENT_NOT_FOUND');
  }

  await clearEventCache(params.id);

  return { updated: true };
});

app.delete('/admin/events/:id', { preHandler: authGuard(env.JWT_SECRET, 'catalog:write') }, async (request) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params);

  let result: { rowCount: number | null };
  try {
    result = await query('DELETE FROM events WHERE id = $1', [params.id]);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new AppError(
        409,
        'Cannot delete event with existing transactional records. Set status to cancelled instead.',
        'EVENT_IN_USE'
      );
    }
    throw error;
  }

  if (!result.rowCount) {
    throw new AppError(404, 'Event not found', 'EVENT_NOT_FOUND');
  }

  await clearEventCache(params.id);
  return { deleted: true };
});

app.post(
  '/admin/events/:id/ticket-types',
  { preHandler: authGuard(env.JWT_SECRET, 'catalog:write') },
  async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = ticketTypeSchema.parse(request.body);
    await ensureEventExists(params.id);

    const insert = await query<{ id: string }>(
      `
        INSERT INTO ticket_types(event_id, name, description, price_cents, currency, total_quantity, sold_quantity)
        VALUES($1, $2, $3, $4, $5, $6, 0)
        RETURNING id
      `,
      [params.id, body.name, body.description ?? null, body.priceCents, body.currency, body.totalQuantity]
    );

    await query(
      `
        INSERT INTO inventory(event_id, ticket_type_id, available, reserved)
        VALUES($1, $2, $3, 0)
        ON CONFLICT (ticket_type_id)
        DO UPDATE SET available = EXCLUDED.available, updated_at = NOW()
      `,
      [params.id, insert.rows[0].id, body.totalQuantity]
    );

    await clearEventCache(params.id);

    return reply.status(201).send({ id: insert.rows[0].id });
  }
);

app.put('/admin/ticket-types/:id', { preHandler: authGuard(env.JWT_SECRET, 'catalog:write') }, async (request) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params);
  const body = ticketTypeSchema.parse(request.body);

  const existing = await query<{ event_id: string; sold_quantity: number }>(
    `
      SELECT event_id, sold_quantity
      FROM ticket_types
      WHERE id = $1
    `,
    [params.id]
  );

  const current = existing.rows[0];
  if (!current) {
    throw new AppError(404, 'Ticket type not found', 'TICKET_TYPE_NOT_FOUND');
  }

  if (body.totalQuantity < current.sold_quantity) {
    throw new AppError(
      409,
      'Total quantity cannot be lower than already sold or reserved tickets',
      'TICKET_TYPE_QUANTITY_LOCKED'
    );
  }

  await query(
    `
      UPDATE ticket_types
      SET name = $1,
          description = $2,
          price_cents = $3,
          currency = $4,
          total_quantity = $5,
          updated_at = NOW()
      WHERE id = $6
    `,
    [body.name, body.description ?? null, body.priceCents, body.currency, body.totalQuantity, params.id]
  );

  await query(
    `
      INSERT INTO inventory(event_id, ticket_type_id, available, reserved)
      VALUES($1, $2, GREATEST($3 - $4, 0), 0)
      ON CONFLICT (ticket_type_id)
      DO UPDATE SET available = EXCLUDED.available, updated_at = NOW()
    `,
    [current.event_id, params.id, body.totalQuantity, current.sold_quantity]
  );

  await clearEventCache(current.event_id);
  return { updated: true };
});

app.delete('/admin/ticket-types/:id', { preHandler: authGuard(env.JWT_SECRET, 'catalog:write') }, async (request) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params);

  let result: { rows: Array<{ event_id: string }> };
  try {
    result = await query<{ event_id: string }>('DELETE FROM ticket_types WHERE id = $1 RETURNING event_id', [params.id]);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new AppError(409, 'Cannot delete ticket type with existing orders or issued tickets', 'TICKET_TYPE_IN_USE');
    }
    throw error;
  }

  const row = result.rows[0];
  if (!row) {
    throw new AppError(404, 'Ticket type not found', 'TICKET_TYPE_NOT_FOUND');
  }

  await clearEventCache(row.event_id);
  return { deleted: true };
});

app.post(
  '/admin/events/:id/add-ons',
  { preHandler: authGuard(env.JWT_SECRET, 'catalog:write') },
  async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = addOnSchema.parse(request.body);
    await ensureEventExists(params.id);

    const insert = await query<{ id: string }>(
      `
        INSERT INTO event_add_ons(
          event_id,
          name,
          description,
          category,
          price_cents,
          currency,
          total_quantity,
          reserved_quantity,
          sold_quantity,
          is_active
        )
        VALUES($1, $2, $3, $4, $5, $6, $7, 0, 0, $8)
        RETURNING id
      `,
      [
        params.id,
        body.name,
        body.description ?? null,
        body.category,
        body.priceCents,
        body.currency,
        body.totalQuantity,
        body.isActive
      ]
    );

    await clearEventCache(params.id);

    return reply.status(201).send({ id: insert.rows[0].id });
  }
);

app.put('/admin/add-ons/:id', { preHandler: authGuard(env.JWT_SECRET, 'catalog:write') }, async (request) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params);
  const body = addOnSchema.parse(request.body);

  const existing = await query<{
    event_id: string;
    reserved_quantity: number;
    sold_quantity: number;
  }>(
    `
      SELECT event_id, reserved_quantity, sold_quantity
      FROM event_add_ons
      WHERE id = $1
    `,
    [params.id]
  );

  const current = existing.rows[0];
  if (!current) {
    throw new AppError(404, 'Add-on not found', 'ADD_ON_NOT_FOUND');
  }

  if (body.totalQuantity < current.reserved_quantity + current.sold_quantity) {
    throw new AppError(409, 'Total quantity cannot be lower than already reserved or sold items', 'ADD_ON_QUANTITY_LOCKED');
  }

  await query(
    `
      UPDATE event_add_ons
      SET name = $1,
          description = $2,
          category = $3,
          price_cents = $4,
          currency = $5,
          total_quantity = $6,
          is_active = $7,
          updated_at = NOW()
      WHERE id = $8
    `,
    [
      body.name,
      body.description ?? null,
      body.category,
      body.priceCents,
      body.currency,
      body.totalQuantity,
      body.isActive,
      params.id
    ]
  );

  await clearEventCache(current.event_id);
  return { updated: true };
});

app.delete('/admin/add-ons/:id', { preHandler: authGuard(env.JWT_SECRET, 'catalog:write') }, async (request) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params);

  const result = await query<{ event_id: string }>(
    `
      UPDATE event_add_ons
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE id = $1
      RETURNING event_id
    `,
    [params.id]
  );

  const row = result.rows[0];
  if (!row) {
    throw new AppError(404, 'Add-on not found', 'ADD_ON_NOT_FOUND');
  }

  await clearEventCache(row.event_id);
  return { deleted: true };
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
