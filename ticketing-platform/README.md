# ticketing-platform

PnPM + Turborepo monorepo for a ticketing platform with Fastify microservices, shared contracts/packages, PostgreSQL, Redis, Stripe checkout, RBAC, analytics, and BullMQ notifications.

## Monorepo layout

- `apps/mobile` (empty placeholder for React Native app)
- `services/*`
  - `api-gateway` (optional `/v1/*` route fan-out)
  - `auth`
  - `catalog`
  - `cart`
  - `checkout`
  - `orders`
  - `tickets`
  - `analytics`
  - `admin`
  - `incidents`
  - `notifications` (BullMQ worker + health endpoint)
- `packages/*`
  - `shared` (logger/env/errors/auth helpers + app bootstrap)
  - `contracts` (OpenAPI starter specs + generated TS DTOs)
  - `db` (Postgres migrations + query/transaction layer)
  - `authz` (RBAC roles/permissions utilities)

## RBAC

Roles:

- `customer`
- `staff`
- `admin`
- `super_admin`

JWT includes `sub`, `email`, `roles`, `tokenType` (`access` or `refresh`).

## Local setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy env file:

```bash
cp .env.example .env
```

Host-side commands load `.env` automatically.

3. Start infra (Postgres + Redis):

```bash
docker compose up -d postgres redis
```

Postgres is published on `localhost:5433` to avoid clashing with a local Postgres instance already using `5432`.

4. Run migrations:

```bash
pnpm migrate
```

5. Start all services in dev mode (host machine):

```bash
pnpm dev
```

## Optional: run services in Docker

This compose file includes all services under the `services` profile and mounts the repo into each container. Start Docker Desktop first, then build the reusable dev image once:

```bash
docker compose build
docker compose --profile services up
```

Tip: run `pnpm install` first on host so the mounted workspace already has dependencies available for the service containers.

## Core endpoints implemented

### auth

- `POST /register`
- `POST /login`
- `POST /refresh`
- `GET /me`
- `POST /assign-role` (requires `super_admin` / `roles:assign`)

### catalog

- `GET /events`
- `GET /events/:id`
- `GET /events/:id/ticket-types`
- Admin CRUD:
  - `POST /admin/events`
  - `PUT /admin/events/:id`
  - `DELETE /admin/events/:id`
  - `POST /admin/events/:id/ticket-types`
  - `PUT /admin/ticket-types/:id`
  - `DELETE /admin/ticket-types/:id`

### cart

- `GET /cart`
- `POST /cart/items`
- `PATCH /cart/items/:itemId`
- `DELETE /cart/items/:itemId`
- `DELETE /cart/clear`

### orders

- `POST /orders/create-from-cart`
- `GET /orders`
- `GET /orders/:id`

### checkout

- `POST /checkout/payment-intent` (Stripe + idempotency key = `orderId`)
- `POST /checkout/webhook` (Stripe signature verification using raw body)

### tickets

- `GET /tickets/my`
- `GET /tickets/:id`
- `POST /tickets/:id/validate-scan`

Atomic validation query used:

```sql
UPDATE tickets SET status='used' WHERE id=$1 AND status='valid' RETURNING *;
```

### admin

- `GET /admin/events/:eventId/metrics`
- `GET /admin/events/:eventId/funnel`
- `GET /admin/events/:eventId/ops-status`
- `PATCH /admin/events/:eventId/ops-status`

### incidents

- `GET /incidents?eventId=<uuid>`
- `POST /incidents`
- `PATCH /incidents/:id`

### analytics

- `POST /analytics/track`
- `GET /analytics/events/:eventId/summary`

### notifications

- BullMQ worker on queue `notifications`
- Handles job `ticket.purchased` with placeholder email log action

## Observability and quality defaults

- Fastify health endpoint: `GET /health`
- Basic metrics endpoint: `GET /metrics`
- Structured JSON logging via Fastify/Pino
- Request ID generation per request
- Zod request/env validation
- Centralized error handling

## Database schema

Migration includes:

- `users`
- `user_roles`
- `events`
- `ticket_types`
- `inventory`
- `carts`
- `cart_items`
- `orders`
- `order_items`
- `tickets`
- `checkins`
- `event_ops_status`
- `incidents`
- `analytics_events`
