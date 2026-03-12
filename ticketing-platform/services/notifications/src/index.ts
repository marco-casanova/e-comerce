import { QueueEvents, Worker, type Job } from 'bullmq';
import { z } from 'zod';

import { createServiceApp, readEnv } from '@ticketing/shared';

const env = readEnv({
  PORT: z.string().default('4010'),
  HOST: z.string().default('0.0.0.0'),
  REDIS_URL: z.string().default('redis://localhost:6379')
});

const app = createServiceApp('notifications');
const redisUrl = new URL(env.REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  password: redisUrl.password || undefined,
  db: Number(redisUrl.pathname.slice(1) || 0)
};

const worker = new Worker(
  'notifications',
  async (job: Job) => {
    if (job.name === 'ticket.purchased') {
      app.log.info(
        {
          jobId: job.id,
          orderId: job.data.orderId,
          userId: job.data.userId
        },
        'Placeholder email: ticket purchased notification processed'
      );
      return;
    }

    app.log.warn({ jobName: job.name, jobId: job.id }, 'Received unknown notification job');
  },
  {
    connection
  }
);

const queueEvents = new QueueEvents('notifications', { connection });

worker.on('failed', (job, error) => {
  app.log.error({ jobId: job?.id, err: error }, 'Notification job failed');
});

queueEvents.on('error', (error) => {
  app.log.error({ err: error }, 'Queue events error');
});

app.addHook('onClose', async () => {
  await worker.close();
  await queueEvents.close();
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
