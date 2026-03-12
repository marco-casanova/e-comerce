import { randomUUID } from 'node:crypto';

import { hasPermission } from '@ticketing/authz';
import { query, withTransaction } from '@ticketing/db';
import { AppError, authGuard, createServiceApp, readEnv, requireUser } from '@ticketing/shared';
import { z } from 'zod';

const env = readEnv({
  PORT: z.string().default('4004'),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(16)
});

const app = createServiceApp('orders');

app.post('/orders/create-from-cart', { preHandler: authGuard(env.JWT_SECRET, 'orders:own') }, async (request, reply) => {
  const user = requireUser(request);

  const orderId = await withTransaction(async (client) => {
    const cart = await client.query<{ id: string }>(
      'SELECT id FROM carts WHERE user_id = $1 AND status = $2 FOR UPDATE',
      [user.sub, 'active']
    );

    const cartId = cart.rows[0]?.id;
    if (!cartId) {
      throw new AppError(400, 'Active cart not found', 'CART_NOT_FOUND');
    }

    const items = await client.query<{
      id: string;
      item_kind: 'ticket' | 'add_on';
      ticket_type_id: string | null;
      add_on_id: string | null;
      quantity: number;
      unit_price_cents: number;
    }>(
      `
        SELECT id, item_kind, ticket_type_id, add_on_id, quantity, unit_price_cents
        FROM cart_items
        WHERE cart_id = $1
        ORDER BY created_at ASC
        FOR UPDATE
      `,
      [cartId]
    );

    if (!items.rows.length) {
      throw new AppError(400, 'Cart is empty', 'CART_EMPTY');
    }

    const preparedItems: Array<{
      itemKind: 'ticket' | 'add_on';
      ticketTypeId: string | null;
      addOnId: string | null;
      quantity: number;
      unitPriceCents: number;
      eventId: string;
    }> = [];

    for (const item of items.rows) {
      if (item.item_kind === 'ticket') {
        const inventory = await client.query<{
          event_id: string;
          available: number;
        }>(
          `
            SELECT tt.event_id, inv.available
            FROM ticket_types tt
            INNER JOIN inventory inv ON inv.ticket_type_id = tt.id
            WHERE tt.id = $1
            FOR UPDATE OF inv
          `,
          [item.ticket_type_id]
        );

        const stock = inventory.rows[0];
        if (!stock) {
          throw new AppError(404, 'Ticket type not found', 'TICKET_TYPE_NOT_FOUND');
        }

        if (item.quantity > stock.available) {
          throw new AppError(409, 'Insufficient inventory for cart item', 'INSUFFICIENT_INVENTORY');
        }

        preparedItems.push({
          itemKind: item.item_kind,
          ticketTypeId: item.ticket_type_id,
          addOnId: null,
          quantity: item.quantity,
          unitPriceCents: item.unit_price_cents,
          eventId: stock.event_id
        });
      } else {
        const addOn = await client.query<{
          event_id: string;
          total_quantity: number;
          reserved_quantity: number;
          sold_quantity: number;
          is_active: boolean;
        }>(
          `
            SELECT event_id, total_quantity, reserved_quantity, sold_quantity, is_active
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
        if (item.quantity > available) {
          throw new AppError(409, 'Insufficient add-on inventory for cart item', 'INSUFFICIENT_ADD_ON_INVENTORY');
        }

        preparedItems.push({
          itemKind: item.item_kind,
          ticketTypeId: null,
          addOnId: item.add_on_id,
          quantity: item.quantity,
          unitPriceCents: item.unit_price_cents,
          eventId: stock.event_id
        });
      }
    }

    const totalCents = preparedItems.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);

    const orderInsert = await client.query<{ id: string }>(
      `
        INSERT INTO orders(id, user_id, cart_id, status, total_cents, currency)
        VALUES($1, $2, $3, $4, $5, $6)
        RETURNING id
      `,
      [randomUUID(), user.sub, cartId, 'pending', totalCents, 'usd']
    );

    const orderIdValue = orderInsert.rows[0].id;

    for (const item of preparedItems) {
      await client.query(
        `
          INSERT INTO order_items(order_id, item_kind, ticket_type_id, add_on_id, quantity, unit_price_cents)
          VALUES($1, $2, $3, $4, $5, $6)
        `,
        [orderIdValue, item.itemKind, item.ticketTypeId, item.addOnId, item.quantity, item.unitPriceCents]
      );

      if (item.itemKind === 'ticket') {
        await client.query(
          `
            UPDATE inventory
            SET available = available - $1,
                reserved = reserved + $1,
                updated_at = NOW()
            WHERE ticket_type_id = $2
          `,
          [item.quantity, item.ticketTypeId]
        );

        await client.query(
          `
            UPDATE ticket_types
            SET sold_quantity = sold_quantity + $1,
                updated_at = NOW()
            WHERE id = $2
          `,
          [item.quantity, item.ticketTypeId]
        );
      } else {
        await client.query(
          `
            UPDATE event_add_ons
            SET reserved_quantity = reserved_quantity + $1,
                updated_at = NOW()
            WHERE id = $2
          `,
          [item.quantity, item.addOnId]
        );
      }
    }

    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
    await client.query('UPDATE carts SET updated_at = NOW() WHERE id = $1', [cartId]);

    return orderIdValue;
  });

  const order = await query<{
    id: string;
    status: string;
    total_cents: number;
    currency: string;
    created_at: string;
  }>('SELECT id, status, total_cents, currency, created_at FROM orders WHERE id = $1', [orderId]);

  return reply.status(201).send(order.rows[0]);
});

app.get('/orders', { preHandler: authGuard(env.JWT_SECRET, 'orders:own') }, async (request) => {
  const user = requireUser(request);

  const orders = await query<{
    id: string;
    status: string;
    total_cents: number;
    currency: string;
    paid_at: string | null;
    created_at: string;
  }>(
    `
      SELECT id, status, total_cents, currency, paid_at, created_at
      FROM orders
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [user.sub]
  );

  return orders.rows;
});

app.get('/orders/:id', { preHandler: authGuard(env.JWT_SECRET, 'orders:own') }, async (request) => {
  const user = requireUser(request);
  const params = z.object({ id: z.string().uuid() }).parse(request.params);

  const orderResult = await query<{
    id: string;
    user_id: string;
    status: string;
    total_cents: number;
    currency: string;
    payment_intent_id: string | null;
    paid_at: string | null;
    created_at: string;
  }>(
    `
      SELECT id, user_id, status, total_cents, currency, payment_intent_id, paid_at, created_at
      FROM orders
      WHERE id = $1
    `,
    [params.id]
  );

  const order = orderResult.rows[0];
  if (!order) {
    throw new AppError(404, 'Order not found', 'ORDER_NOT_FOUND');
  }

  const canManageAllOrders = hasPermission(user.roles, 'orders:manage');
  if (order.user_id !== user.sub && !canManageAllOrders) {
    throw new AppError(403, 'Not allowed to access this order', 'FORBIDDEN');
  }

  const items = await query<{
    id: string;
    item_kind: 'ticket' | 'add_on';
    ticket_type_id: string | null;
    add_on_id: string | null;
    quantity: number;
    unit_price_cents: number;
  }>(
    `
      SELECT id, item_kind, ticket_type_id, add_on_id, quantity, unit_price_cents
      FROM order_items
      WHERE order_id = $1
      ORDER BY created_at ASC
    `,
    [params.id]
  );

  return {
    ...order,
    items: items.rows
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
