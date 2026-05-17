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

function createApp(repository = new FakeCartRepository()) {
  return {
    app: buildApp({
      database: new FakeDatabase(),
      redis: new FakeRedis(),
      checkoutRepository: new FakeCheckoutRepository(),
      paymentRepository: new FakePaymentRepository(),
      productRepository: new FakeProductRepository(),
      cartRepository: repository,
      orderRepository: new FakeOrderRepository(),
      queue: new FakeQueue(),
      config: {
        appInstanceId: 'test-api',
        midtransWebhookSecret: 'secret'
      }
    }),
    repository
  };
}

describe('cart routes', () => {
  it('returns the current user cart with item totals', async () => {
    const { app } = createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/cart?userId=user-1'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      userId: 'user-1',
      totalAmount: 200000,
      items: [
        {
          id: 'cart-item-1',
          productVariantId: 'variant-1',
          productName: 'Sample Product',
          quantity: 2,
          unitPrice: 100000,
          lineTotal: 200000
        }
      ]
    });
  });

  it('adds an item to the current user cart', async () => {
    const { app, repository } = createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/cart/items',
      payload: {
        userId: 'user-1',
        productVariantId: 'variant-2',
        quantity: 3
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      id: 'cart-item-2',
      productVariantId: 'variant-2',
      quantity: 3
    });
    expect(repository.items.get('variant-2')?.quantity).toBe(3);
  });

  it('rejects adding beyond available stock without changing the cart', async () => {
    const repository = new FakeCartRepository();
    repository.items.get('variant-1')!.quantity = 20;
    const { app } = createApp(repository);

    const response = await app.inject({
      method: 'POST',
      url: '/cart/items',
      payload: {
        userId: 'user-1',
        productVariantId: 'variant-1',
        quantity: 1
      }
    });

    expect(response.statusCode).toBe(409);
    expect(repository.items.get('variant-1')?.quantity).toBe(20);
  });

  it('updates cart item quantity', async () => {
    const { app, repository } = createApp();

    const response = await app.inject({
      method: 'PATCH',
      url: '/cart/items/cart-item-1',
      payload: { quantity: 4 }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: 'cart-item-1', quantity: 4 });
    expect(repository.items.get('variant-1')?.quantity).toBe(4);
  });

  it('rejects item quantity updates beyond available stock', async () => {
    const { app, repository } = createApp();

    const response = await app.inject({
      method: 'PATCH',
      url: '/cart/items/cart-item-1',
      payload: { quantity: 21 }
    });

    expect(response.statusCode).toBe(409);
    expect(repository.items.get('variant-1')?.quantity).toBe(2);
  });

  it('removes a cart item', async () => {
    const { app, repository } = createApp();

    const response = await app.inject({
      method: 'DELETE',
      url: '/cart/items/cart-item-1'
    });

    expect(response.statusCode).toBe(204);
    expect(repository.items.has('variant-1')).toBe(false);
  });
});
