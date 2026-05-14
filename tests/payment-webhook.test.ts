import crypto from 'node:crypto';
import { buildApp } from '../src/app.js';
import { FakeCheckoutRepository, FakeDatabase, FakePaymentRepository, FakeProductRepository, FakeQueue, FakeRedis } from './helpers/fakes.js';

function signature(reference: string, status: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(`${reference}:${status}`).digest('hex');
}

function createApp(repository = new FakePaymentRepository(), queue = new FakeQueue()) {
  return {
    app: buildApp({
      database: new FakeDatabase(),
      redis: new FakeRedis(),
      checkoutRepository: new FakeCheckoutRepository(),
      productRepository: new FakeProductRepository(),
      paymentRepository: repository,
      queue,
      config: {
        appInstanceId: 'test-api',
        midtransWebhookSecret: 'secret'
      }
    }),
    repository,
    queue
  };
}

describe('POST /webhook/payment', () => {
  it('processes a valid webhook once and queues invoice notification', async () => {
    const { app, repository, queue } = createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/webhook/payment',
      payload: {
        paymentReference: 'PAY-1',
        transactionStatus: 'success',
        signature: signature('PAY-1', 'success', 'secret')
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expect(repository.payments.get('PAY-1')?.status).toBe('success');
    expect(repository.orders.get('order-1')?.status).toBe('paid');
    expect(queue.jobs).toEqual([{ name: 'payment.success', data: { orderId: 'order-1', paymentReference: 'PAY-1' } }]);
  });

  it('returns ok without duplicate work when webhook was already processed', async () => {
    const repository = new FakePaymentRepository();
    repository.payments.get('PAY-1')!.status = 'success';
    const { app, queue } = createApp(repository);

    const response = await app.inject({
      method: 'POST',
      url: '/webhook/payment',
      payload: {
        paymentReference: 'PAY-1',
        transactionStatus: 'success',
        signature: signature('PAY-1', 'success', 'secret')
      }
    });

    expect(response.statusCode).toBe(200);
    expect(queue.jobs).toEqual([]);
  });

  it('rejects invalid webhook signatures', async () => {
    const { app } = createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/webhook/payment',
      payload: {
        paymentReference: 'PAY-1',
        transactionStatus: 'success',
        signature: 'bad'
      }
    });

    expect(response.statusCode).toBe(401);
  });
});
