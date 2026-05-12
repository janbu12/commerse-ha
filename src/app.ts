import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import type { AppConfig } from './config/app.config.js';
import { errorHandler } from './shared/errors/error-handler.js';
import type { SqlDatabase } from './shared/database/database.port.js';
import type { RedisPort } from './shared/redis/redis.port.js';
import type { QueuePort } from './shared/queue/queue.port.js';
import type { CheckoutRepository } from './modules/checkout/checkout.repository.js';
import type { PaymentRepository } from './modules/payments/payment.repository.js';
import { CheckoutService } from './modules/checkout/checkout.service.js';
import { registerCheckoutRoute } from './modules/checkout/checkout.route.js';
import { PaymentWebhookHandler } from './modules/payments/webhook.handler.js';
import { registerPaymentRoute } from './modules/payments/payment.route.js';
import { registerHealthRoute } from './health.route.js';
import { registerMetrics } from './metrics/prometheus.js';

export type AppDependencies = {
  database: SqlDatabase;
  redis: RedisPort;
  queue: QueuePort;
  checkoutRepository: CheckoutRepository;
  paymentRepository: PaymentRepository;
  config: Pick<AppConfig, 'appInstanceId' | 'midtransWebhookSecret'> &
    Partial<Pick<AppConfig, 'cookieSecret' | 'logLevel'>>;
};

export function buildApp(dependencies: AppDependencies) {
  const app = Fastify({
    logger: {
      level: dependencies.config.logLevel ?? 'info',
      base: { instance: dependencies.config.appInstanceId }
    }
  });

  app.setErrorHandler(errorHandler);
  app.register(cookie, { secret: dependencies.config.cookieSecret ?? 'test-cookie-secret' });
  app.register(cors, { origin: true, credentials: true });
  app.register(swagger, {
    openapi: {
      info: {
        title: 'E-Commerce HA API',
        version: '0.1.0'
      }
    }
  });

  registerHealthRoute(app, {
    database: dependencies.database,
    redis: dependencies.redis,
    instanceId: dependencies.config.appInstanceId
  });
  const metrics = registerMetrics(app, dependencies.config.appInstanceId);

  const checkoutService = new CheckoutService(
    dependencies.database,
    dependencies.checkoutRepository,
    dependencies.queue,
    metrics
  );
  registerCheckoutRoute(app, checkoutService);

  const paymentWebhookHandler = new PaymentWebhookHandler(
    dependencies.database,
    dependencies.paymentRepository,
    dependencies.queue,
    dependencies.config.midtransWebhookSecret,
    metrics
  );
  registerPaymentRoute(app, paymentWebhookHandler);

  return app;
}
