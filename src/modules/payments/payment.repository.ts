import type { PgDatabase } from '../../shared/database/pg-database.js';

export type PaymentRecord = {
  id: string;
  orderId: string;
  paymentReference: string;
  status: string;
};

export type PaymentRepository = {
  findByReference(reference: string): Promise<PaymentRecord | null>;
  markPaymentSuccess(reference: string): Promise<void>;
  markOrderPaid(orderId: string): Promise<void>;
};

export class PgPaymentRepository implements PaymentRepository {
  constructor(private readonly database: PgDatabase) {}

  async findByReference(reference: string) {
    const result = await this.database.query<{
      id: string;
      order_id: string;
      payment_reference: string;
      status: string;
    }>(
      `SELECT id, order_id, payment_reference, status
       FROM payments
       WHERE payment_reference = $1`,
      [reference]
    );

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      orderId: row.order_id,
      paymentReference: row.payment_reference,
      status: row.status
    };
  }

  async markPaymentSuccess(reference: string) {
    await this.database.query(`UPDATE payments SET status = 'success' WHERE payment_reference = $1`, [reference]);
  }

  async markOrderPaid(orderId: string) {
    await this.database.query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [orderId]);
  }
}
