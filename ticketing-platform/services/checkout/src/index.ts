import { randomUUID } from 'node:crypto';

import { hasPermission } from '@ticketing/authz';
import { query, withTransaction } from '@ticketing/db';
import { AppError, authGuard, createServiceApp, readEnv, requireUser } from '@ticketing/shared';
import { Queue } from 'bullmq';
import rawBody from 'fastify-raw-body';
import Stripe from 'stripe';
import { z } from 'zod';

const env = readEnv({
  PORT: z.string().default('4005'),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(16),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_EPHEMERAL_KEY_API_VERSION: z.string().default('2024-06-20'),
  REDIS_URL: z.string().default('redis://localhost:6379')
});

const app = createServiceApp('checkout');
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const redisUrl = new URL(env.REDIS_URL);
const notificationsQueue = new Queue('notifications', {
  connection: {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    password: redisUrl.password || undefined,
    db: Number(redisUrl.pathname.slice(1) || 0)
  }
});

app.register(rawBody, {
  field: 'rawBody',
  global: false,
  encoding: false,
  runFirst: true,
  routes: ['/checkout/webhook']
});

const paymentIntentSchema = z.object({
  orderId: z.string().uuid()
});

async function getOrCreateStripeCustomerId(userId: string, email: string) {
  const userResult = await query<{ stripe_customer_id: string | null }>(
    'SELECT stripe_customer_id FROM users WHERE id = $1',
    [userId]
  );

  const userRecord = userResult.rows[0];
  if (!userRecord) {
    throw new AppError(404, 'Order owner not found', 'ORDER_OWNER_NOT_FOUND');
  }

  if (userRecord.stripe_customer_id) {
    return userRecord.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: {
      userId
    }
  });

  await query('UPDATE users SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2', [customer.id, userId]);
  return customer.id;
}

async function createPaymentIntentForOrder(order: {
  id: string;
  user_id: string;
  total_cents: number;
  currency: string;
}, customerId: string) {
  return stripe.paymentIntents.create(
    {
      amount: order.total_cents,
      currency: order.currency,
      customer: customerId,
      automatic_payment_methods: {
        enabled: true
      },
      metadata: {
        orderId: order.id,
        userId: order.user_id
      }
    },
    {
      idempotencyKey: order.id
    }
  );
}

app.post('/checkout/payment-intent', { preHandler: authGuard(env.JWT_SECRET, 'orders:own') }, async (request) => {
  const user = requireUser(request);
  const body = paymentIntentSchema.parse(request.body);

  const orderResult = await query<{
    id: string;
    user_id: string;
    status: string;
    total_cents: number;
    currency: string;
    payment_intent_id: string | null;
    owner_email: string;
  }>(
    `
      SELECT o.id, o.user_id, o.status, o.total_cents, o.currency, o.payment_intent_id, u.email AS owner_email
      FROM orders o
      INNER JOIN users u ON u.id = o.user_id
      WHERE o.id = $1
    `,
    [body.orderId]
  );

  const order = orderResult.rows[0];
  if (!order) {
    throw new AppError(404, 'Order not found', 'ORDER_NOT_FOUND');
  }

  const canManageAllOrders = hasPermission(user.roles, 'orders:manage');
  if (order.user_id !== user.sub && !canManageAllOrders) {
    throw new AppError(403, 'Not allowed to pay this order', 'FORBIDDEN');
  }

  if (order.status === 'paid' && order.payment_intent_id) {
    return {
      orderId: order.id,
      paymentIntentId: order.payment_intent_id,
      status: 'already_paid'
    };
  }

  if (order.status !== 'pending') {
    throw new AppError(409, 'Order is not payable in its current state', 'ORDER_NOT_PAYABLE');
  }

  const customerId = await getOrCreateStripeCustomerId(order.user_id, order.owner_email);
  let paymentIntent: Stripe.PaymentIntent;

  if (order.payment_intent_id) {
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(order.payment_intent_id);
    } catch {
      paymentIntent = await createPaymentIntentForOrder(order, customerId);
    }
  } else {
    paymentIntent = await createPaymentIntentForOrder(order, customerId);
  }

  if (!paymentIntent.customer) {
    paymentIntent = await stripe.paymentIntents.update(paymentIntent.id, {
      customer: customerId
    });
  }

  if (!paymentIntent.client_secret) {
    throw new AppError(500, 'Stripe payment intent missing client secret', 'MISSING_CLIENT_SECRET');
  }

  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: env.STRIPE_EPHEMERAL_KEY_API_VERSION as Stripe.LatestApiVersion }
  );

  if (!ephemeralKey.secret) {
    throw new AppError(500, 'Stripe ephemeral key missing secret', 'MISSING_EPHEMERAL_KEY_SECRET');
  }

  if (order.payment_intent_id !== paymentIntent.id) {
    await query('UPDATE orders SET payment_intent_id = $1, updated_at = NOW() WHERE id = $2', [
      paymentIntent.id,
      order.id
    ]);
  }

  return {
    orderId: order.id,
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    customerId,
    customerEphemeralKeySecret: ephemeralKey.secret,
    status: paymentIntent.status
  };
});

app.post('/checkout/webhook', async (request, reply) => {
  const signature = request.headers['stripe-signature'];

  if (!signature || Array.isArray(signature)) {
    throw new AppError(400, 'Missing stripe-signature header', 'MISSING_SIGNATURE');
  }

  const body = (request as unknown as { rawBody?: Buffer }).rawBody;
  if (!body) {
    throw new AppError(400, 'Missing raw request body', 'MISSING_RAW_BODY');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    throw new AppError(400, 'Invalid Stripe webhook signature', 'INVALID_WEBHOOK_SIGNATURE', error);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId = paymentIntent.metadata.orderId;

    if (orderId) {
      const orderData = await withTransaction(async (client) => {
        const orderResult = await client.query<{ id: string; user_id: string }>(
          `
            UPDATE orders
            SET status = 'paid',
                paid_at = NOW(),
                payment_intent_id = $1,
                updated_at = NOW()
            WHERE id = $2
              AND status = 'pending'
            RETURNING id, user_id
          `,
          [paymentIntent.id, orderId]
        );

        const order = orderResult.rows[0];
        if (!order) {
          return null;
        }

        const items = await client.query<{
          id: string;
          item_kind: 'ticket' | 'add_on';
          ticket_type_id: string | null;
          add_on_id: string | null;
          quantity: number;
          event_id: string | null;
        }>(
          `
            SELECT
              oi.id,
              oi.item_kind,
              oi.ticket_type_id,
              oi.add_on_id,
              oi.quantity,
              COALESCE(tt.event_id, ao.event_id) AS event_id
            FROM order_items oi
            LEFT JOIN ticket_types tt ON tt.id = oi.ticket_type_id
            LEFT JOIN event_add_ons ao ON ao.id = oi.add_on_id
            WHERE oi.order_id = $1
          `,
          [orderId]
        );

        for (const item of items.rows) {
          if (item.item_kind === 'ticket' && item.ticket_type_id && item.event_id) {
            await client.query(
              `
                UPDATE inventory
                SET reserved = GREATEST(reserved - $1, 0),
                    updated_at = NOW()
                WHERE ticket_type_id = $2
              `,
              [item.quantity, item.ticket_type_id]
            );

            for (let index = 0; index < item.quantity; index += 1) {
              await client.query(
                `
                  INSERT INTO tickets(order_item_id, order_id, event_id, ticket_type_id, user_id, code, status)
                  VALUES($1, $2, $3, $4, $5, $6, 'valid')
                `,
                [item.id, orderId, item.event_id, item.ticket_type_id, order.user_id, `TK_${randomUUID()}`]
              );
            }

            await client.query(
              `
                INSERT INTO analytics_events(event_id, actor_user_id, name, payload)
                VALUES($1, $2, $3, $4::jsonb)
              `,
              [
                item.event_id,
                order.user_id,
                'checkout_completed',
                JSON.stringify({ orderId, ticketTypeId: item.ticket_type_id })
              ]
            );
          }

          if (item.item_kind === 'add_on' && item.add_on_id && item.event_id) {
            await client.query(
              `
                UPDATE event_add_ons
                SET reserved_quantity = GREATEST(reserved_quantity - $1, 0),
                    sold_quantity = sold_quantity + $1,
                    updated_at = NOW()
                WHERE id = $2
              `,
              [item.quantity, item.add_on_id]
            );

            await client.query(
              `
                INSERT INTO analytics_events(event_id, actor_user_id, name, payload)
                VALUES($1, $2, $3, $4::jsonb)
              `,
              [item.event_id, order.user_id, 'add_on_purchased', JSON.stringify({ orderId, addOnId: item.add_on_id })]
            );
          }
        }

        return order;
      });

      if (orderData) {
        await notificationsQueue.add('ticket.purchased', {
          orderId,
          userId: orderData.user_id
        });
      }
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId = paymentIntent.metadata.orderId;

    if (orderId) {
      await withTransaction(async (client) => {
        const orderResult = await client.query<{ id: string }>(
          `
            UPDATE orders
            SET status = 'payment_failed',
                payment_intent_id = $1,
                updated_at = NOW()
            WHERE id = $2
              AND status = 'pending'
            RETURNING id
          `,
          [paymentIntent.id, orderId]
        );

        if (!orderResult.rows[0]) {
          return;
        }

        const items = await client.query<{
          item_kind: 'ticket' | 'add_on';
          ticket_type_id: string | null;
          add_on_id: string | null;
          quantity: number;
        }>(
          `
            SELECT item_kind, ticket_type_id, add_on_id, quantity
            FROM order_items
            WHERE order_id = $1
          `,
          [orderId]
        );

        for (const item of items.rows) {
          if (item.item_kind === 'ticket' && item.ticket_type_id) {
            await client.query(
              `
                UPDATE inventory
                SET available = available + $1,
                    reserved = GREATEST(reserved - $1, 0),
                    updated_at = NOW()
                WHERE ticket_type_id = $2
              `,
              [item.quantity, item.ticket_type_id]
            );

            await client.query(
              `
                UPDATE ticket_types
                SET sold_quantity = GREATEST(sold_quantity - $1, 0),
                    updated_at = NOW()
                WHERE id = $2
              `,
              [item.quantity, item.ticket_type_id]
            );
          }

          if (item.item_kind === 'add_on' && item.add_on_id) {
            await client.query(
              `
                UPDATE event_add_ons
                SET reserved_quantity = GREATEST(reserved_quantity - $1, 0),
                    updated_at = NOW()
                WHERE id = $2
              `,
              [item.quantity, item.add_on_id]
            );
          }
        }
      });
    }
  }

  return reply.status(200).send({ received: true });
});

app.addHook('onClose', async () => {
  await notificationsQueue.close();
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
