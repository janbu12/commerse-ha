import client from 'prom-client';
import type { FastifyInstance } from 'fastify';

type MetricsRequest = {
  metricsStartTime?: bigint;
};

export type AppMetrics = {
  recordCheckoutAttempt: () => void;
  recordCheckoutSuccess: () => void;
  recordCheckoutFailure: (reason: string) => void;
  recordPaymentWebhookSuccess: () => void;
  recordPaymentWebhookFailure: (reason: string) => void;
  recordPaymentWebhookIgnored: (reason: string) => void;
};

export function registerMetrics(app: FastifyInstance, instanceId: string) {
  const register = new client.Registry();
  client.collectDefaultMetrics({ register, labels: { instance: instanceId } });

  const requestCounter = new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code', 'instance'],
    registers: [register]
  });

  const requestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code', 'instance'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register]
  });

  const checkoutAttempts = new client.Counter({
    name: 'checkout_attempts_total',
    help: 'Total checkout attempts',
    labelNames: ['instance'],
    registers: [register]
  });

  const checkoutSuccess = new client.Counter({
    name: 'checkout_success_total',
    help: 'Total successful checkouts',
    labelNames: ['instance'],
    registers: [register]
  });

  const checkoutFailure = new client.Counter({
    name: 'checkout_failure_total',
    help: 'Total failed checkouts by reason',
    labelNames: ['reason', 'instance'],
    registers: [register]
  });

  const paymentWebhooks = new client.Counter({
    name: 'payment_webhooks_total',
    help: 'Total payment webhooks by result',
    labelNames: ['result', 'reason', 'instance'],
    registers: [register]
  });

  const paymentSuccess = new client.Counter({
    name: 'payment_success_total',
    help: 'Total successful payment webhook state transitions',
    labelNames: ['instance'],
    registers: [register]
  });

  const paymentFailure = new client.Counter({
    name: 'payment_failure_total',
    help: 'Total failed payment webhooks by reason',
    labelNames: ['reason', 'instance'],
    registers: [register]
  });

  app.addHook('onRequest', async (request) => {
    (request as MetricsRequest).metricsStartTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url ?? request.url;
    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode),
      instance: instanceId
    };

    requestCounter.inc({
      ...labels
    });

    const startTime = (request as MetricsRequest).metricsStartTime;
    if (startTime) {
      requestDuration.observe(labels, Number(process.hrtime.bigint() - startTime) / 1_000_000_000);
    }
  });

  app.get('/metrics', async (_request, reply) => {
    reply.header('content-type', register.contentType);
    return register.metrics();
  });

  return {
    recordCheckoutAttempt: () => checkoutAttempts.inc({ instance: instanceId }),
    recordCheckoutSuccess: () => checkoutSuccess.inc({ instance: instanceId }),
    recordCheckoutFailure: (reason: string) => checkoutFailure.inc({ reason, instance: instanceId }),
    recordPaymentWebhookSuccess: () => {
      paymentWebhooks.inc({ result: 'success', reason: 'none', instance: instanceId });
      paymentSuccess.inc({ instance: instanceId });
    },
    recordPaymentWebhookFailure: (reason: string) => {
      paymentWebhooks.inc({ result: 'failure', reason, instance: instanceId });
      paymentFailure.inc({ reason, instance: instanceId });
    },
    recordPaymentWebhookIgnored: (reason: string) => paymentWebhooks.inc({ result: 'ignored', reason, instance: instanceId })
  } satisfies AppMetrics;
}
