import { hasPermission } from '@ticketing/authz';
import { query, withTransaction } from '@ticketing/db';
import { AppError, authGuard, createServiceApp, readEnv, requireUser } from '@ticketing/shared';
import { z } from 'zod';

const env = readEnv({
  PORT: z.string().default('4006'),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(16)
});

const app = createServiceApp('tickets');

const validateScanSchema = z.object({
  eventId: z.string().uuid(),
  scannedAt: z.string().datetime().optional()
});

const ENTRY_OPENS_BEFORE_START_MINUTES = 120;
const ENTRY_CLOSES_AFTER_END_MINUTES = 60;
const ENTRY_CLOSES_AFTER_START_MINUTES = 360;

app.get('/tickets/my', { preHandler: authGuard(env.JWT_SECRET, 'tickets:own') }, async (request) => {
  const user = requireUser(request);

  const result = await query<{
    id: string;
    order_id: string;
    event_id: string;
    ticket_type_id: string;
    code: string;
    status: string;
    used_at: string | null;
    created_at: string;
    event_title: string;
    event_venue: string | null;
    event_starts_at: string;
    event_ends_at: string | null;
    ticket_type_name: string;
  }>(
    `
      SELECT
        t.id,
        t.order_id,
        t.event_id,
        t.ticket_type_id,
        t.code,
        t.status,
        t.used_at,
        t.created_at,
        e.title AS event_title,
        e.venue AS event_venue,
        e.starts_at AS event_starts_at,
        e.ends_at AS event_ends_at,
        tt.name AS ticket_type_name
      FROM tickets t
      INNER JOIN events e ON e.id = t.event_id
      INNER JOIN ticket_types tt ON tt.id = t.ticket_type_id
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC
    `,
    [user.sub]
  );

  return result.rows;
});

app.get('/tickets/:id', { preHandler: authGuard(env.JWT_SECRET, 'tickets:own') }, async (request) => {
  const user = requireUser(request);
  const params = z.object({ id: z.string().uuid() }).parse(request.params);

  const result = await query<{
    id: string;
    user_id: string;
    order_id: string;
    event_id: string;
    ticket_type_id: string;
    code: string;
    status: string;
    used_at: string | null;
    created_at: string;
    event_title: string;
    event_venue: string | null;
    event_starts_at: string;
    event_ends_at: string | null;
    ticket_type_name: string;
  }>(
    `
      SELECT
        t.id,
        t.user_id,
        t.order_id,
        t.event_id,
        t.ticket_type_id,
        t.code,
        t.status,
        t.used_at,
        t.created_at,
        e.title AS event_title,
        e.venue AS event_venue,
        e.starts_at AS event_starts_at,
        e.ends_at AS event_ends_at,
        tt.name AS ticket_type_name
      FROM tickets t
      INNER JOIN events e ON e.id = t.event_id
      INNER JOIN ticket_types tt ON tt.id = t.ticket_type_id
      WHERE t.id = $1
    `,
    [params.id]
  );

  const ticket = result.rows[0];
  if (!ticket) {
    throw new AppError(404, 'Ticket not found', 'TICKET_NOT_FOUND');
  }

  const canValidate = hasPermission(user.roles, 'tickets:validate');
  if (ticket.user_id !== user.sub && !canValidate) {
    throw new AppError(403, 'Not allowed to access this ticket', 'FORBIDDEN');
  }

  return ticket;
});

app.post('/tickets/:id/validate-scan', { preHandler: authGuard(env.JWT_SECRET, 'tickets:validate') }, async (request) => {
  const user = requireUser(request);
  const params = z.object({ id: z.string().uuid() }).parse(request.params);
  const body = validateScanSchema.parse(request.body);

  const checkedIn = await withTransaction(async (client) => {
    const ticketResult = await client.query<{
      id: string;
      event_id: string;
      user_id: string;
      status: string;
      used_at: string | null;
      starts_at: string;
      ends_at: string | null;
    }>(
      `
        SELECT t.id, t.event_id, t.user_id, t.status, t.used_at, e.starts_at, e.ends_at
        FROM tickets t
        INNER JOIN events e ON e.id = t.event_id
        WHERE t.id = $1
        FOR UPDATE OF t
      `,
      [params.id]
    );

    const ticket = ticketResult.rows[0];
    if (!ticket) {
      throw new AppError(404, 'Ticket not found', 'TICKET_NOT_FOUND');
    }

    if (ticket.event_id !== body.eventId) {
      throw new AppError(409, 'Ticket belongs to a different event', 'WRONG_EVENT', {
        ticketEventId: ticket.event_id,
        requestedEventId: body.eventId
      });
    }

    if (ticket.status !== 'valid') {
      throw new AppError(409, 'Ticket already used or invalid', 'TICKET_ALREADY_USED');
    }

    const eventStartsAt = new Date(ticket.starts_at);
    const eventEndsAt = ticket.ends_at ? new Date(ticket.ends_at) : null;
    const scanTimestamp = body.scannedAt ? new Date(body.scannedAt) : new Date();
    const windowOpensAt = new Date(eventStartsAt.getTime() - ENTRY_OPENS_BEFORE_START_MINUTES * 60 * 1000);
    const windowClosesAt = eventEndsAt
      ? new Date(eventEndsAt.getTime() + ENTRY_CLOSES_AFTER_END_MINUTES * 60 * 1000)
      : new Date(eventStartsAt.getTime() + ENTRY_CLOSES_AFTER_START_MINUTES * 60 * 1000);

    if (scanTimestamp < windowOpensAt) {
      throw new AppError(409, 'Ticket is too early for entry', 'SCAN_TOO_EARLY', {
        windowOpensAt: windowOpensAt.toISOString(),
        windowClosesAt: windowClosesAt.toISOString(),
        scanTimestamp: scanTimestamp.toISOString()
      });
    }

    if (scanTimestamp > windowClosesAt) {
      throw new AppError(409, 'Ticket is too late for entry', 'SCAN_TOO_LATE', {
        windowOpensAt: windowOpensAt.toISOString(),
        windowClosesAt: windowClosesAt.toISOString(),
        scanTimestamp: scanTimestamp.toISOString()
      });
    }

    const checkedInResult = await client.query<{
      id: string;
      event_id: string;
      user_id: string;
      status: string;
      used_at: string | null;
    }>(
      `
        UPDATE tickets
        SET status = 'used', used_at = NOW()
        WHERE id = $1
        RETURNING id, event_id, user_id, status, used_at
      `,
      [params.id]
    );

    const checkedInTicket = checkedInResult.rows[0];

    await client.query(
      `
        INSERT INTO checkins(ticket_id, event_id, scanned_by)
        VALUES($1, $2, $3)
      `,
      [checkedInTicket.id, checkedInTicket.event_id, user.sub]
    );

    await client.query(
      `
        INSERT INTO analytics_events(event_id, actor_user_id, name, payload)
        VALUES($1, $2, $3, $4::jsonb)
      `,
      [checkedInTicket.event_id, user.sub, 'ticket_checked_in', JSON.stringify({ ticketId: checkedInTicket.id })]
    );

    return {
      ...checkedInTicket,
      windowOpensAt: windowOpensAt.toISOString(),
      windowClosesAt: windowClosesAt.toISOString()
    };
  });

  return {
    validated: true,
    ticket: checkedIn
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
