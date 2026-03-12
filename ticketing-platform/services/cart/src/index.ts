import { z } from 'zod';

import { withTransaction, query } from '@ticketing/db';
import { AppError, authGuard, createServiceApp, readEnv, requireUser } from '@ticketing/shared';

const env = readEnv({
  PORT: z.string().default('4003'),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(16)
});

const app = createServiceApp('cart');

const legacyTicketItemSchema = z
  .object({
    ticketTypeId: z.string().uuid(),
    quantity: z.number().int().positive()
  })
  .transform((value) => ({
    itemKind: 'ticket' as const,
    ticketTypeId: value.ticketTypeId,
    quantity: value.quantity
  }));

const addTicketItemSchema = z.object({
  itemKind: z.literal('ticket'),
  ticketTypeId: z.string().uuid(),
  quantity: z.number().int().positive()
});

const addOnItemSchema = z.object({
  itemKind: z.literal('add_on'),
  addOnId: z.string().uuid(),
  quantity: z.number().int().positive()
});

const addItemSchema = z.union([legacyTicketItemSchema, addTicketItemSchema, addOnItemSchema]);

const updateItemSchema = z.object({
  quantity: z.number().int().positive()
});

async function getOrCreateCartId(userId: string): Promise<string> {
  const existing = await query<{ id: string }>('SELECT id FROM carts WHERE user_id = $1 AND status = $2', [
    userId,
    'active'
  ]);

  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const inserted = await query<{ id: string }>('INSERT INTO carts(user_id, status) VALUES($1, $2) RETURNING id', [
    userId,
    'active'
  ]);

  return inserted.rows[0].id;
}

async function buildCart(userId: string) {
  const cartId = await getOrCreateCartId(userId);

  const items = await query<{
    id: string;
    cart_id: string;
    item_kind: 'ticket' | 'add_on';
    ticket_type_id: string | null;
    add_on_id: string | null;
    quantity: number;
    unit_price_cents: number;
    event_id: string;
    item_name: string;
    item_category: string | null;
  }>(
    `
      SELECT
        ci.id,
        ci.cart_id,
        ci.item_kind,
        ci.ticket_type_id,
        ci.add_on_id,
        ci.quantity,
        ci.unit_price_cents,
        COALESCE(tt.event_id, ao.event_id) AS event_id,
        COALESCE(tt.name, ao.name) AS item_name,
        ao.category AS item_category
      FROM cart_items ci
      LEFT JOIN ticket_types tt ON tt.id = ci.ticket_type_id
      LEFT JOIN event_add_ons ao ON ao.id = ci.add_on_id
      WHERE ci.cart_id = $1
      ORDER BY ci.created_at ASC
    `,
    [cartId]
  );

  const totalCents = items.rows.reduce((sum, item) => sum + item.quantity * item.unit_price_cents, 0);

  return {
    cartId,
    items: items.rows,
    totalCents
  };
}

app.get('/cart', { preHandler: authGuard(env.JWT_SECRET, 'cart:manage') }, async (request) => {
  const user = requireUser(request);
  return buildCart(user.sub);
});

app.post('/cart/items', { preHandler: authGuard(env.JWT_SECRET, 'cart:manage') }, async (request, reply) => {
  const user = requireUser(request);
  const body = addItemSchema.parse(request.body);

  await withTransaction(async (client) => {
    const cartResult = await client.query<{ id: string }>(
      'SELECT id FROM carts WHERE user_id = $1 AND status = $2 FOR UPDATE',
      [user.sub, 'active']
    );

    let cartId = cartResult.rows[0]?.id;
    if (!cartId) {
      const inserted = await client.query<{ id: string }>(
        'INSERT INTO carts(user_id, status) VALUES($1, $2) RETURNING id',
        [user.sub, 'active']
      );
      cartId = inserted.rows[0].id;
    }

    if (body.itemKind === 'ticket') {
      const inventory = await client.query<{
        price_cents: number;
        available: number;
      }>(
        `
          SELECT tt.price_cents, inv.available
          FROM ticket_types tt
          INNER JOIN inventory inv ON inv.ticket_type_id = tt.id
          WHERE tt.id = $1
          FOR UPDATE
        `,
        [body.ticketTypeId]
      );

      const stock = inventory.rows[0];
      if (!stock) {
        throw new AppError(404, 'Ticket type not found', 'TICKET_TYPE_NOT_FOUND');
      }

      const existing = await client.query<{ quantity: number }>(
        'SELECT quantity FROM cart_items WHERE cart_id = $1 AND ticket_type_id = $2 FOR UPDATE',
        [cartId, body.ticketTypeId]
      );

      const nextQuantity = (existing.rows[0]?.quantity ?? 0) + body.quantity;

      if (nextQuantity > stock.available) {
        throw new AppError(409, 'Not enough inventory available', 'INSUFFICIENT_INVENTORY');
      }

      await client.query(
        `
          INSERT INTO cart_items(cart_id, item_kind, ticket_type_id, add_on_id, quantity, unit_price_cents)
          VALUES($1, 'ticket', $2, NULL, $3, $4)
          ON CONFLICT (cart_id, ticket_type_id) WHERE ticket_type_id IS NOT NULL
          DO UPDATE SET quantity = EXCLUDED.quantity,
                        unit_price_cents = EXCLUDED.unit_price_cents,
                        updated_at = NOW()
        `,
        [cartId, body.ticketTypeId, nextQuantity, stock.price_cents]
      );
    } else {
      const addOn = await client.query<{
        price_cents: number;
        total_quantity: number;
        reserved_quantity: number;
        sold_quantity: number;
        is_active: boolean;
      }>(
        `
          SELECT price_cents, total_quantity, reserved_quantity, sold_quantity, is_active
          FROM event_add_ons
          WHERE id = $1
          FOR UPDATE
        `,
        [body.addOnId]
      );

      const stock = addOn.rows[0];
      if (!stock || !stock.is_active) {
        throw new AppError(404, 'Add-on not found', 'ADD_ON_NOT_FOUND');
      }

      const existing = await client.query<{ quantity: number }>(
        'SELECT quantity FROM cart_items WHERE cart_id = $1 AND add_on_id = $2 FOR UPDATE',
        [cartId, body.addOnId]
      );

      const nextQuantity = (existing.rows[0]?.quantity ?? 0) + body.quantity;
      const available = Math.max(stock.total_quantity - stock.reserved_quantity - stock.sold_quantity, 0);

      if (nextQuantity > available) {
        throw new AppError(409, 'Not enough add-on inventory available', 'INSUFFICIENT_ADD_ON_INVENTORY');
      }

      await client.query(
        `
          INSERT INTO cart_items(cart_id, item_kind, ticket_type_id, add_on_id, quantity, unit_price_cents)
          VALUES($1, 'add_on', NULL, $2, $3, $4)
          ON CONFLICT (cart_id, add_on_id) WHERE add_on_id IS NOT NULL
          DO UPDATE SET quantity = EXCLUDED.quantity,
                        unit_price_cents = EXCLUDED.unit_price_cents,
                        updated_at = NOW()
        `,
        [cartId, body.addOnId, nextQuantity, stock.price_cents]
      );
    }

    await client.query('UPDATE carts SET updated_at = NOW() WHERE id = $1', [cartId]);
  });

  const cart = await buildCart(user.sub);
  return reply.status(201).send(cart);
});

app.patch('/cart/items/:itemId', { preHandler: authGuard(env.JWT_SECRET, 'cart:manage') }, async (request) => {
  const user = requireUser(request);
  const params = z.object({ itemId: z.string().uuid() }).parse(request.params);
  const body = updateItemSchema.parse(request.body);

  await withTransaction(async (client) => {
    const row = await client.query<{
      id: string;
      cart_id: string;
      item_kind: 'ticket' | 'add_on';
      ticket_type_id: string | null;
      add_on_id: string | null;
    }>(
      `
        SELECT ci.id, ci.cart_id, ci.item_kind, ci.ticket_type_id, ci.add_on_id
        FROM cart_items ci
        INNER JOIN carts c ON c.id = ci.cart_id
        WHERE ci.id = $1 AND c.user_id = $2
        FOR UPDATE
      `,
      [params.itemId, user.sub]
    );

    const item = row.rows[0];
    if (!item) {
      throw new AppError(404, 'Cart item not found', 'CART_ITEM_NOT_FOUND');
    }

    if (item.item_kind === 'ticket') {
      const inventory = await client.query<{ available: number }>(
        'SELECT available FROM inventory WHERE ticket_type_id = $1 FOR UPDATE',
        [item.ticket_type_id]
      );

      const available = inventory.rows[0]?.available ?? 0;
      if (body.quantity > available) {
        throw new AppError(409, 'Not enough inventory available', 'INSUFFICIENT_INVENTORY');
      }
    } else {
      const addOn = await client.query<{
        total_quantity: number;
        reserved_quantity: number;
        sold_quantity: number;
        is_active: boolean;
      }>(
        `
          SELECT total_quantity, reserved_quantity, sold_quantity, is_active
          FROM event_add_ons
          WHERE id = $1
          FOR UPDATE
        `,
        [item.add_on_id]
      );

      const stock = addOn.rows[0];
      if (!stock || !stock.is_active) {
        throw new AppError(404, 'Add-on not found', 'ADD_ON_NOT_FOUND');
      }

      const available = Math.max(stock.total_quantity - stock.reserved_quantity - stock.sold_quantity, 0);
      if (body.quantity > available) {
        throw new AppError(409, 'Not enough add-on inventory available', 'INSUFFICIENT_ADD_ON_INVENTORY');
      }
    }

    await client.query('UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2', [
      body.quantity,
      params.itemId
    ]);

    await client.query('UPDATE carts SET updated_at = NOW() WHERE id = $1', [item.cart_id]);
  });

  return buildCart(user.sub);
});

app.delete('/cart/items/:itemId', { preHandler: authGuard(env.JWT_SECRET, 'cart:manage') }, async (request) => {
  const user = requireUser(request);
  const params = z.object({ itemId: z.string().uuid() }).parse(request.params);

  const result = await query(
    `
      DELETE FROM cart_items ci
      USING carts c
      WHERE ci.cart_id = c.id
        AND ci.id = $1
        AND c.user_id = $2
    `,
    [params.itemId, user.sub]
  );

  if (!result.rowCount) {
    throw new AppError(404, 'Cart item not found', 'CART_ITEM_NOT_FOUND');
  }

  return buildCart(user.sub);
});

app.delete('/cart/clear', { preHandler: authGuard(env.JWT_SECRET, 'cart:manage') }, async (request) => {
  const user = requireUser(request);
  const cartId = await getOrCreateCartId(user.sub);

  await query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
  await query('UPDATE carts SET updated_at = NOW() WHERE id = $1', [cartId]);

  return {
    cartId,
    items: [],
    totalCents: 0
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
