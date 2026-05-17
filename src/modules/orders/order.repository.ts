import type { PgDatabase } from '../../shared/database/pg-database.js';

export type OrderSummary = {
  id: string;
  userId: string;
  status: string;
  totalAmount: number;
  paymentStatus: string | null;
  itemCount: number;
  createdAt: Date;
};

export type OrderItemDetail = {
  productVariantId: string;
  sku: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderPayment = {
  paymentReference: string;
  gateway: string;
  status: string;
  amount: number;
  paidAt: Date | null;
};

export type OrderShipment = {
  courier: string;
  trackingNumber: string | null;
  status: string;
  shippedAt: Date | null;
  deliveredAt: Date | null;
};

export type OrderDetail = OrderSummary & {
  items: OrderItemDetail[];
  payment: OrderPayment | null;
  shipment: OrderShipment | null;
};

export type OrderRepository = {
  findManyByUserId(userId: string): Promise<OrderSummary[]>;
  findById(id: string): Promise<OrderDetail | null>;
};

export class PgOrderRepository implements OrderRepository {
  constructor(private readonly database: PgDatabase) {}

  async findManyByUserId(userId: string) {
    const result = await this.database.query<{
      id: string;
      user_id: string;
      status: string;
      total_amount: string;
      payment_status: string | null;
      item_count: string;
      created_at: Date;
    }>(
      `
      SELECT
        o.id,
        o.user_id,
        o.status,
        o.total_amount,
        p.status AS payment_status,
        COALESCE(SUM(oi.quantity), 0) AS item_count,
        o.created_at
      FROM orders o
      LEFT JOIN payments p ON p.order_id = o.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = $1
      GROUP BY o.id, p.status
      ORDER BY o.created_at DESC
      `,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      status: row.status,
      totalAmount: Number(row.total_amount),
      paymentStatus: row.payment_status,
      itemCount: Number(row.item_count),
      createdAt: row.created_at
    }));
  }

  async findById(id: string) {
    const orderResult = await this.database.query<{
      id: string;
      user_id: string;
      status: string;
      total_amount: string;
      payment_status: string | null;
      item_count: string;
      created_at: Date;
    }>(
      `
      SELECT
        o.id,
        o.user_id,
        o.status,
        o.total_amount,
        p.status AS payment_status,
        COALESCE(SUM(oi.quantity), 0) AS item_count,
        o.created_at
      FROM orders o
      LEFT JOIN payments p ON p.order_id = o.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.id = $1
      GROUP BY o.id, p.status
      `,
      [id]
    );

    if (orderResult.rowCount === 0) {
      return null;
    }

    const order = orderResult.rows[0];
    const [itemsResult, paymentResult, shipmentResult] = await Promise.all([
      this.database.query<{
        product_variant_id: string;
        sku: string;
        product_name: string;
        size: string | null;
        color: string | null;
        quantity: number;
        unit_price: string;
      }>(
        `
        SELECT
          oi.product_variant_id,
          pv.sku,
          p.name AS product_name,
          pv.size,
          pv.color,
          oi.quantity,
          oi.unit_price
        FROM order_items oi
        JOIN product_variants pv ON pv.id = oi.product_variant_id
        JOIN products p ON p.id = pv.product_id
        WHERE oi.order_id = $1
        ORDER BY oi.id ASC
        `,
        [id]
      ),
      this.database.query<{
        payment_reference: string;
        gateway: string;
        status: string;
        amount: string;
        created_at: Date;
      }>(
        `
        SELECT payment_reference, gateway, status, amount, created_at
        FROM payments
        WHERE order_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [id]
      ),
      this.database.query<{
        courier: string;
        tracking_number: string | null;
        status: string;
        shipped_at: Date | null;
      }>(
        `
        SELECT courier, tracking_number, status, shipped_at
        FROM shipments
        WHERE order_id = $1
        LIMIT 1
        `,
        [id]
      )
    ]);

    return {
      id: order.id,
      userId: order.user_id,
      status: order.status,
      totalAmount: Number(order.total_amount),
      paymentStatus: order.payment_status,
      itemCount: Number(order.item_count),
      createdAt: order.created_at,
      items: itemsResult.rows.map((row) => {
        const quantity = Number(row.quantity);
        const unitPrice = Number(row.unit_price);
        return {
          productVariantId: row.product_variant_id,
          sku: row.sku,
          productName: row.product_name,
          variantLabel: [row.size, row.color].filter(Boolean).join(' / '),
          quantity,
          unitPrice,
          lineTotal: quantity * unitPrice
        };
      }),
      payment:
        paymentResult.rowCount === 0
          ? null
          : {
              paymentReference: paymentResult.rows[0].payment_reference,
              gateway: paymentResult.rows[0].gateway,
              status: paymentResult.rows[0].status,
              amount: Number(paymentResult.rows[0].amount),
              paidAt: paymentResult.rows[0].status === 'success' ? paymentResult.rows[0].created_at : null
            },
      shipment:
        shipmentResult.rowCount === 0
          ? null
          : {
              courier: shipmentResult.rows[0].courier,
              trackingNumber: shipmentResult.rows[0].tracking_number,
              status: shipmentResult.rows[0].status,
              shippedAt: shipmentResult.rows[0].shipped_at,
              deliveredAt: shipmentResult.rows[0].status === 'delivered' ? shipmentResult.rows[0].shipped_at : null
            }
    };
  }
}
