import crypto from 'node:crypto';
import type { PgDatabase } from '../../shared/database/pg-database.js';

export type CheckoutItemSnapshot = {
  productVariantId: string;
  quantity: number;
  unitPrice: number;
  stockQuantity: number;
};

export type CheckoutSnapshot = {
  cartId: string;
  userId: string;
  items: CheckoutItemSnapshot[];
};

export type PendingOrder = {
  id: string;
  userId: string;
  status: string;
  totalAmount: number;
};

export type PendingPayment = {
  id: string;
  orderId: string;
  paymentReference: string;
  status: string;
  amount: number;
};

export type CheckoutRepository = {
  getCartForUser(userId: string): Promise<CheckoutSnapshot | null>;
  createPendingOrder(input: { userId: string; totalAmount: number }): Promise<PendingOrder>;
  addOrderItem(input: { orderId: string; productVariantId: string; quantity: number; unitPrice: number }): Promise<void>;
  decrementInventory(productVariantId: string, quantity: number): Promise<void>;
  createPendingPayment(input: { orderId: string; amount: number }): Promise<PendingPayment>;
};

export class PgCheckoutRepository implements CheckoutRepository {
  constructor(private readonly database: PgDatabase) {}

  async getCartForUser(userId: string) {
    const result = await this.database.query<{
      cart_id: string;
      user_id: string;
      product_variant_id: string;
      quantity: number;
      unit_price: string;
      stock_quantity: number;
    }>(
      `
      SELECT
        c.id AS cart_id,
        c.user_id,
        ci.product_variant_id,
        ci.quantity,
        pv.price AS unit_price,
        i.stock_quantity
      FROM carts c
      JOIN cart_items ci ON ci.cart_id = c.id
      JOIN product_variants pv ON pv.id = ci.product_variant_id
      JOIN inventory i ON i.product_variant_id = pv.id
      WHERE c.user_id = $1
      FOR UPDATE OF i
      `,
      [userId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return {
      cartId: result.rows[0].cart_id,
      userId,
      items: result.rows.map((row) => ({
        productVariantId: row.product_variant_id,
        quantity: Number(row.quantity),
        unitPrice: Number(row.unit_price),
        stockQuantity: Number(row.stock_quantity)
      }))
    };
  }

  async createPendingOrder(input: { userId: string; totalAmount: number }) {
    const result = await this.database.query<{
      id: string;
      user_id: string;
      status: string;
      total_amount: string;
    }>(
      `INSERT INTO orders (user_id, status, total_amount)
       VALUES ($1, 'pending_payment', $2)
       RETURNING id, user_id, status, total_amount`,
      [input.userId, input.totalAmount]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      status: row.status,
      totalAmount: Number(row.total_amount)
    };
  }

  async addOrderItem(input: { orderId: string; productVariantId: string; quantity: number; unitPrice: number }) {
    await this.database.query(
      `INSERT INTO order_items (order_id, product_variant_id, quantity, unit_price)
       VALUES ($1, $2, $3, $4)`,
      [input.orderId, input.productVariantId, input.quantity, input.unitPrice]
    );
  }

  async decrementInventory(productVariantId: string, quantity: number) {
    await this.database.query(
      `UPDATE inventory
       SET stock_quantity = stock_quantity - $2
       WHERE product_variant_id = $1 AND stock_quantity >= $2`,
      [productVariantId, quantity]
    );
  }

  async createPendingPayment(input: { orderId: string; amount: number }) {
    const result = await this.database.query<{
      id: string;
      order_id: string;
      payment_reference: string;
      status: string;
      amount: string;
    }>(
      `INSERT INTO payments (order_id, payment_reference, gateway, amount, status)
       VALUES ($1, $2, 'midtrans', $3, 'pending')
       RETURNING id, order_id, payment_reference, status, amount`,
      [input.orderId, `MID-${crypto.randomUUID()}`, input.amount]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      orderId: row.order_id,
      paymentReference: row.payment_reference,
      status: row.status,
      amount: Number(row.amount)
    };
  }
}
