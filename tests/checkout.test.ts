import { buildApp } from '../src/app.js';
import { FakeCartRepository, FakeCheckoutRepository, FakeDatabase, FakeOrderRepository, FakePaymentRepository, FakeProductRepository, FakeQueue, FakeRedis } from './helpers/fakes.js';

function createApp(repository = new FakeCheckoutRepository(), queue = new FakeQueue()) {
  return {
    app: buildApp({
      database: new FakeDatabase(),
      redis: new FakeRedis(),
      checkoutRepository: repository,
      paymentRepository: new FakePaymentRepository(),
      productRepository: new FakeProductRepository(),
      cartRepository: new FakeCartRepository(),
      orderRepository: new FakeOrderRepository(),
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

describe('POST /checkout', () => {
  it('creates pending order, decrements stock, creates payment, and queues notification', async () => {
    const { app, repository, queue } = createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      payload: { userId: 'user-1' }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      orderId: 'order-1',
      paymentReference: 'PAY-1',
      paymentUrl: expect.stringContaining('PAY-1')
    });
    expect(repository.inventory.get('variant-1')).toBe(1);
    expect(queue.jobs).toContainEqual({
      name: 'checkout.created',
      data: { orderId: 'order-1', userId: 'user-1' }
    });
  });

  it('rejects checkout when stock is insufficient and leaves inventory unchanged', async () => {
    const repository = new FakeCheckoutRepository();
    repository.inventory.set('variant-1', 0);
    const { app } = createApp(repository);

    const response = await app.inject({
      method: 'POST',
      url: '/checkout',
      payload: { userId: 'user-1' }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'insufficient stock' });
    expect(repository.inventory.get('variant-1')).toBe(0);
    expect(repository.orderCount).toBe(0);
  });
});
