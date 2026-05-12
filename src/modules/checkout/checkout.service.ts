import { AppError } from '../../shared/errors/app-error.js';
import type { QueuePort } from '../../shared/queue/queue.port.js';
import type { SqlDatabase } from '../../shared/database/database.port.js';
import type { AppMetrics } from '../../metrics/prometheus.js';
import type { CheckoutRepository } from './checkout.repository.js';

export class CheckoutService {
  constructor(
    private readonly database: SqlDatabase,
    private readonly repository: CheckoutRepository,
    private readonly queue: QueuePort,
    private readonly metrics?: Pick<
      AppMetrics,
      'recordCheckoutAttempt' | 'recordCheckoutSuccess' | 'recordCheckoutFailure'
    >
  ) {}

  async checkout(userId: string) {
    this.metrics?.recordCheckoutAttempt();

    try {
      const result = await this.database.transaction(async () => {
        const cart = await this.repository.getCartForUser(userId);
        if (!cart || cart.items.length === 0) {
          throw new AppError('cart is empty', 400, 'cart_empty');
        }

        for (const item of cart.items) {
          if (item.stockQuantity < item.quantity) {
            throw new AppError('insufficient stock', 409, 'insufficient_stock');
          }
        }

        const totalAmount = cart.items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
        const order = await this.repository.createPendingOrder({ userId, totalAmount });

        for (const item of cart.items) {
          await this.repository.addOrderItem({
            orderId: order.id,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          });
          await this.repository.decrementInventory(item.productVariantId, item.quantity);
        }

        const payment = await this.repository.createPendingPayment({ orderId: order.id, amount: totalAmount });
        await this.queue.add('checkout.created', { orderId: order.id, userId });

        return {
          orderId: order.id,
          paymentReference: payment.paymentReference,
          paymentUrl: `https://app.sandbox.midtrans.com/snap/v2/vtweb/${payment.paymentReference}`
        };
      });

      this.metrics?.recordCheckoutSuccess();
      return result;
    } catch (error) {
      this.metrics?.recordCheckoutFailure(error instanceof AppError ? error.code : 'unexpected_error');
      throw error;
    }
  }
}
