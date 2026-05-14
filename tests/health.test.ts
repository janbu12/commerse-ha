import { buildApp } from '../src/app.js';
import { FakeCheckoutRepository, FakeDatabase, FakePaymentRepository, FakeProductRepository, FakeQueue, FakeRedis } from './helpers/fakes.js';

function createApp(database = new FakeDatabase(), redis = new FakeRedis()) {
  return buildApp({
    database,
    redis,
    checkoutRepository: new FakeCheckoutRepository(),
    paymentRepository: new FakePaymentRepository(),
    productRepository: new FakeProductRepository(),
    queue: new FakeQueue(),
    config: {
      appInstanceId: 'test-api',
      midtransWebhookSecret: 'secret'
    }
  });
}

describe('GET /health', () => {
  it('returns ok when database and redis are connected', async () => {
    const app = createApp();

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      database: 'connected',
      redis: 'connected',
      instanceId: 'test-api'
    });
  });

  it('returns 503 when a dependency is disconnected', async () => {
    const database = new FakeDatabase();
    database.connected = false;
    const app = createApp(database);

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      status: 'error',
      database: 'disconnected',
      redis: 'connected'
    });
  });
});
