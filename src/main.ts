import { buildApp } from './app.js';
import { loadConfig } from './config/app.config.js';
import { PgDatabase } from './shared/database/pg-database.js';
import { RedisClient } from './shared/redis/redis-client.js';
import { BullMqQueue } from './shared/queue/bullmq-queue.js';
import { PgCheckoutRepository } from './modules/checkout/checkout.repository.js';
import { PgPaymentRepository } from './modules/payments/payment.repository.js';

const config = loadConfig();
const database = new PgDatabase(config.databaseUrl);
const redis = new RedisClient(config.redisUrl);
const redisUrl = new URL(config.redisUrl);
const queue = new BullMqQueue('ecommerce-notifications', {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379)
});

const app = buildApp({
  database,
  redis,
  queue,
  checkoutRepository: new PgCheckoutRepository(database),
  paymentRepository: new PgPaymentRepository(database),
  config
});

const shutdown = async () => {
  await app.close();
  await database.close();
  await redis.close();
  await queue.close();
};

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ host: '0.0.0.0', port: config.port });
