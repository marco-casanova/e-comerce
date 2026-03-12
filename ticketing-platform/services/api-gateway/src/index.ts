import { z } from 'zod';

import { AppError, createServiceApp, readEnv } from '@ticketing/shared';

const env = readEnv({
  PORT: z.string().default('4000'),
  HOST: z.string().default('0.0.0.0'),
  AUTH_URL: z.string().default('http://localhost:4001'),
  CATALOG_URL: z.string().default('http://localhost:4002'),
  CART_URL: z.string().default('http://localhost:4003'),
  ORDERS_URL: z.string().default('http://localhost:4004'),
  CHECKOUT_URL: z.string().default('http://localhost:4005'),
  TICKETS_URL: z.string().default('http://localhost:4006'),
  ADMIN_URL: z.string().default('http://localhost:4007'),
  INCIDENTS_URL: z.string().default('http://localhost:4008'),
  ANALYTICS_URL: z.string().default('http://localhost:4009')
});

const app = createServiceApp('api-gateway');

const routeMap: Record<string, string> = {
  auth: env.AUTH_URL,
  catalog: env.CATALOG_URL,
  cart: env.CART_URL,
  orders: env.ORDERS_URL,
  checkout: env.CHECKOUT_URL,
  tickets: env.TICKETS_URL,
  admin: env.ADMIN_URL,
  incidents: env.INCIDENTS_URL,
  analytics: env.ANALYTICS_URL
};

app.get('/routes', async () => routeMap);

app.all('/v1/*', async (request, reply) => {
  const wildcard = (request.params as { '*': string })['*'] ?? '';
  const [service, ...rest] = wildcard.split('/').filter(Boolean);

  if (!service || !routeMap[service]) {
    throw new AppError(404, 'Unknown service route', 'ROUTE_NOT_FOUND');
  }

  const targetPath = rest.join('/');
  const queryString = request.url.includes('?') ? `?${request.url.split('?')[1]}` : '';
  const targetUrl = `${routeMap[service]}/${targetPath}${queryString}`;

  const headers = { ...request.headers } as Record<string, string>;
  delete headers.host;
  delete headers['content-length'];

  let body: string | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.body !== undefined) {
    body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    headers['content-type'] = headers['content-type'] ?? 'application/json';
  }

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body
  });

  for (const [header, value] of upstream.headers.entries()) {
    if (header.toLowerCase() === 'transfer-encoding') {
      continue;
    }
    reply.header(header, value);
  }

  reply.status(upstream.status);

  const responseText = await upstream.text();
  const contentType = upstream.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      return reply.send(JSON.parse(responseText));
    } catch {
      return reply.send({ raw: responseText });
    }
  }

  return reply.send(responseText);
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
