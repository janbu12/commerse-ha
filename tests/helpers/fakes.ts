import type { CheckoutRepository, CheckoutSnapshot } from '../../src/modules/checkout/checkout.repository.js';
import type { Cart, CartItem, CartRepository, ProductVariantForCart } from '../../src/modules/cart/cart.repository.js';
import type { OrderDetail, OrderRepository, OrderSummary } from '../../src/modules/orders/order.repository.js';
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

export class FakeCartRepository implements CartRepository {
  public items = new Map<string, CartItem>([
    [
      'variant-1',
      {
        id: 'cart-item-1',
        productVariantId: 'variant-1',
        sku: 'SAMPLE-001',
        productName: 'Sample Product',
        variantLabel: 'M / Black',
        quantity: 2,
        unitPrice: 100000,
        lineTotal: 200000,
        availableStock: 20
      }
    ]
  ]);
  public variants = new Map<string, ProductVariantForCart>([
    ['variant-1', { id: 'variant-1', price: 100000, stockQuantity: 20 }],
    ['variant-2', { id: 'variant-2', price: 125000, stockQuantity: 12 }]
  ]);

  async findByUserId(userId: string): Promise<Cart | null> {
    const items = Array.from(this.items.values()).map((item) => ({
      ...item,
      lineTotal: item.quantity * item.unitPrice
    }));

    return {
      id: 'cart-1',
      userId,
      totalAmount: items.reduce((sum, item) => sum + item.lineTotal, 0),
      items
    };
  }

  async findVariantById(productVariantId: string) {
    return this.variants.get(productVariantId) ?? null;
  }

  async findItemById(itemId: string) {
    return Array.from(this.items.values()).find((candidate) => candidate.id === itemId) ?? null;
  }

  async addItem(input: { productVariantId: string; quantity: number }) {
    const current = this.items.get(input.productVariantId);
    if (current) {
      if (current.quantity + input.quantity > current.availableStock) {
        return null;
      }

      current.quantity += input.quantity;
      current.lineTotal = current.quantity * current.unitPrice;
      return current;
    }

    const variant = this.variants.get(input.productVariantId)!;
    const item: CartItem = {
      id: 'cart-item-2',
      productVariantId: input.productVariantId,
      sku: 'SAMPLE-002',
      productName: 'Sample Product',
      variantLabel: 'L / White',
      quantity: input.quantity,
      unitPrice: variant.price,
      lineTotal: input.quantity * variant.price,
      availableStock: variant.stockQuantity
    };
    this.items.set(input.productVariantId, item);
    return item;
  }

  async updateItemQuantity(itemId: string, quantity: number) {
    const item = await this.findItemById(itemId);
    if (!item) {
      return null;
    }

    if (quantity > item.availableStock) {
      return null;
    }

    item.quantity = quantity;
    item.lineTotal = item.quantity * item.unitPrice;
    return item;
  }

  async deleteItem(itemId: string) {
    const item = Array.from(this.items.values()).find((candidate) => candidate.id === itemId);
    if (!item) {
      return false;
    }

    return this.items.delete(item.productVariantId);
  }
}

export class FakeOrderRepository implements OrderRepository {
  public summary: OrderSummary = {
    id: 'order-1',
    userId: 'user-1',
    status: 'paid',
    totalAmount: 200000,
    paymentStatus: 'success',
    itemCount: 2,
    createdAt: new Date('2026-05-12T10:00:00.000Z')
  };
  public detail: OrderDetail = {
    ...this.summary,
    items: [
      {
        productVariantId: 'variant-1',
        sku: 'SAMPLE-001',
        productName: 'Sample Product',
        variantLabel: 'M / Black',
        quantity: 2,
        unitPrice: 100000,
        lineTotal: 200000
      }
    ],
    payment: {
      paymentReference: 'PAY-1',
      gateway: 'midtrans',
      status: 'success',
      amount: 200000,
      paidAt: new Date('2026-05-12T10:05:00.000Z')
    },
    shipment: {
      courier: 'JNE',
      trackingNumber: 'JNE-001',
      status: 'delivered',
      shippedAt: new Date('2026-05-12T11:00:00.000Z'),
      deliveredAt: new Date('2026-05-13T11:00:00.000Z')
    }
  };

  async findManyByUserId(userId: string) {
    return this.summary.userId === userId ? [this.summary] : [];
  }

  async findById(id: string) {
    return this.detail.id === id ? this.detail : null;
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
