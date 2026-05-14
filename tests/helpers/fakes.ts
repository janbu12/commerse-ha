import type { CheckoutRepository, CheckoutSnapshot } from '../../src/modules/checkout/checkout.repository.js';
import type { PaymentRepository } from '../../src/modules/payments/payment.repository.js';
import type { ProductRepository } from '../../src/modules/products/product.repository.js';
import type { QueuePort } from '../../src/shared/queue/queue.port.js';
import type { RedisPort } from '../../src/shared/redis/redis.port.js';
import type { SqlDatabase } from '../../src/shared/database/database.port.js';

export class FakeDatabase implements SqlDatabase {
  public connected = true;

  async healthCheck() {
    if (!this.connected) {
      throw new Error('database unavailable');
    }
  }

  async transaction<T>(work: () => Promise<T>) {
    return work();
  }
}

export class FakeRedis implements RedisPort {
  public connected = true;
  public store = new Map<string, string>();

  async healthCheck() {
    if (!this.connected) {
      throw new Error('redis unavailable');
    }
  }

  async get(key: string) {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.store.set(key, value);
  }

  async del(key: string) {
    this.store.delete(key);
  }
}

export class FakeQueue implements QueuePort {
  public jobs: Array<{ name: string; data: unknown }> = [];

  async add(name: string, data: unknown) {
    this.jobs.push({ name, data });
  }
}

export class FakeCheckoutRepository implements CheckoutRepository {
  public cart: CheckoutSnapshot = {
    cartId: 'cart-1',
    userId: 'user-1',
    items: [
      {
        productVariantId: 'variant-1',
        quantity: 1,
        unitPrice: 100000,
        stockQuantity: 2
      }
    ]
  };
  public orderCount = 0;
  public paymentCount = 0;
  public inventory = new Map([['variant-1', 2]]);

  async getCartForUser(userId: string) {
    if (this.cart.userId !== userId) {
      return null;
    }

    return {
      ...this.cart,
      items: this.cart.items.map((item) => ({
        ...item,
        stockQuantity: this.inventory.get(item.productVariantId) ?? 0
      }))
    };
  }

  async createPendingOrder(input: { userId: string; totalAmount: number }) {
    this.orderCount += 1;
    return {
      id: `order-${this.orderCount}`,
      userId: input.userId,
      status: 'pending_payment',
      totalAmount: input.totalAmount
    };
  }

  async addOrderItem() {
    return;
  }

  async decrementInventory(productVariantId: string, quantity: number) {
    const current = this.inventory.get(productVariantId) ?? 0;
    this.inventory.set(productVariantId, current - quantity);
  }

  async createPendingPayment(input: { orderId: string; amount: number }) {
    this.paymentCount += 1;
    return {
      id: `payment-${this.paymentCount}`,
      orderId: input.orderId,
      paymentReference: `PAY-${this.paymentCount}`,
      status: 'pending',
      amount: input.amount
    };
  }
}

export class FakePaymentRepository implements PaymentRepository {
  public payments = new Map([
    [
      'PAY-1',
      {
        id: 'payment-1',
        orderId: 'order-1',
        paymentReference: 'PAY-1',
        status: 'pending'
      }
    ]
  ]);
  public orders = new Map([['order-1', { id: 'order-1', status: 'pending_payment' }]]);

  async findByReference(reference: string) {
    return this.payments.get(reference) ?? null;
  }

  async markPaymentSuccess(reference: string) {
    const payment = this.payments.get(reference);
    if (payment) {
      payment.status = 'success';
    }
  }

  async markOrderPaid(orderId: string) {
    const order = this.orders.get(orderId);
    if (order) {
      order.status = 'paid';
    }
  }
}

export class FakeProductRepository implements ProductRepository {
  public products = [
    {
      id: '20000000-0000-0000-0000-000000000001',
      name: 'Sample Product',
      description: 'Seed product',
      price: 100000,
      categoryName: 'Default',
      createdAt: new Date(),
      variants: [
        {
          id: '30000000-0000-0000-0000-000000000001',
          sku: 'SAMPLE-001',
          size: 'M',
          color: 'Black',
          price: 100000,
          stock: 20
        }
      ]
    }
  ];

  async findMany() {
    return this.products;
  }

  async findById(id: string) {
    return this.products.find((p) => p.id === id) ?? null;
  }
}
