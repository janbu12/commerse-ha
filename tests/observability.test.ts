import crypto from 'node:crypto';
import { buildApp } from '../src/app.js';
import { FakeCheckoutRepository, FakeDatabase, FakePaymentRepository, FakeQueue, FakeRedis } from './helpers/fakes.js';

function signature(reference: string, status: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(`${reference}:${status}`).digest('hex');
}

function createApp() {
  const checkoutRepository = new FakeCheckoutRepository();
  const paymentRepository = new FakePaymentRepository();

  return {
    app: buildApp({
      database: new FakeDatabase(),
      redis: new FakeRedis(),
      checkoutRepository,
      paymentRepository,
      queue: new FakeQueue(),
      config: {
        appInstanceId: 'test-api',
        midtransWebhookSecret: 'secret'
      }
    }),
    checkoutRepository,
    paymentRepository
  };
}

describe('observability metrics', () => {
  it('exports API request duration histogram with route labels', async () => {
    const { app } = createApp();

    await app.inject({ method: 'GET', url: '/health' });
    const metrics = await app.inject({ method: 'GET', url: '/metrics' });

    expect(metrics.body).toContain('http_request_duration_seconds_bucket');
    expect(metrics.body).toContain('route="/health"');
    expect(metrics.body).toContain('instance="test-api"');
  });

  it('exports checkout success and failure counters', async () => {
    const { app, checkoutRepository } = createApp();

    await app.inject({
      method: 'POST',
      url: '/checkout',
      payload: { userId: 'user-1' }
    });

    checkoutRepository.inventory.set('variant-1', 0);
    await app.inject({
      method: 'POST',
      url: '/checkout',
      payload: { userId: 'user-1' }
    });

    const metrics = await app.inject({ method: 'GET', url: '/metrics' });

    expect(metrics.body).toContain('checkout_attempts_total{instance="test-api"} 2');
    expect(metrics.body).toContain('checkout_success_total{instance="test-api"} 1');
    expect(metrics.body).toContain('checkout_failure_total{reason="insufficient_stock",instance="test-api"} 1');
  });

  it('exports payment webhook success and failure counters', async () => {
    const { app } = createApp();

    await app.inject({
      method: 'POST',
      url: '/webhook/payment',
      payload: {
        paymentReference: 'PAY-1',
        transactionStatus: 'success',
        signature: signature('PAY-1', 'success', 'secret')
      }
    });

    await app.inject({
      method: 'POST',
      url: '/webhook/payment',
      payload: {
        paymentReference: 'PAY-2',
        transactionStatus: 'success',
        signature: 'bad'
      }
    });

    const metrics = await app.inject({ method: 'GET', url: '/metrics' });

    expect(metrics.body).toContain('payment_webhooks_total{result="success",reason="none",instance="test-api"} 1');
    expect(metrics.body).toContain('payment_webhooks_total{result="failure",reason="invalid_signature",instance="test-api"} 1');
    expect(metrics.body).toContain('payment_success_total{instance="test-api"} 1');
    expect(metrics.body).toContain('payment_failure_total{reason="invalid_signature",instance="test-api"} 1');
  });
});
