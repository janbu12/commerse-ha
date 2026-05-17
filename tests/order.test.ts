import { buildApp } from '../src/app.js';
import {
  FakeCartRepository,
  FakeCheckoutRepository,
  FakeDatabase,
  FakeOrderRepository,
  FakePaymentRepository,
  FakeProductRepository,
  FakeQueue,
  FakeRedis
} from './helpers/fakes.js';

function createApp(repository = new FakeOrderRepository()) {
  return {
    app: buildApp({
      database: new FakeDatabase(),
      redis: new FakeRedis(),
      checkoutRepository: new FakeCheckoutRepository(),
      paymentRepository: new FakePaymentRepository(),
      productRepository: new FakeProductRepository(),
      cartRepository: new FakeCartRepository(),
      orderRepository: repository,
      queue: new FakeQueue(),
      config: {
        appInstanceId: 'test-api',
        midtransWebhookSecret: 'secret'
      }
    }),
    repository
  };
}

describe('order routes', () => {
  it('lists orders for a user', async () => {
    const { app } = createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/orders?userId=user-1'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      userId: 'user-1',
      orders: [
        {
          id: 'order-1',
          status: 'paid',
          totalAmount: 200000,
          paymentStatus: 'success',
          itemCount: 2
        }
      ]
    });
  });

  it('returns order detail with items, payment, and shipment', async () => {
    const { app } = createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/orders/order-1'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: 'order-1',
      userId: 'user-1',
      status: 'paid',
      payment: {
        paymentReference: 'PAY-1',
        status: 'success'
      },
      shipment: {
        courier: 'JNE',
        status: 'delivered'
      },
      items: [
        {
          productVariantId: 'variant-1',
          productName: 'Sample Product',
          quantity: 2,
          unitPrice: 100000,
          lineTotal: 200000
        }
      ]
    });
  });

  it('returns 404 when order is missing', async () => {
    const { app } = createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/orders/missing-order'
    });

    expect(response.statusCode).toBe(404);
  });
});
