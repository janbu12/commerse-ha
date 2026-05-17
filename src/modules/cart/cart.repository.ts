import type { PgDatabase } from '../../shared/database/pg-database.js';

export type CartItem = {
  id: string;
  productVariantId: string;
  sku: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  availableStock: number;
};

export type Cart = {
  id: string;
  userId: string;
  totalAmount: number;
  items: CartItem[];
};

export type ProductVariantForCart = {
  id: string;
  price: number;
  stockQuantity: number;
};

export type CartRepository = {
  findByUserId(userId: string): Promise<Cart | null>;
  findItemById(itemId: string): Promise<CartItem | null>;
  findVariantById(productVariantId: string): Promise<ProductVariantForCart | null>;
  addItem(input: { userId: string; productVariantId: string; quantity: number }): Promise<CartItem | null>;
  updateItemQuantity(itemId: string, quantity: number): Promise<CartItem | null>;
  deleteItem(itemId: string): Promise<boolean>;
};

type CartItemRow = {
  cart_id: string;
  user_id: string;
  item_id: string;
  product_variant_id: string;
  sku: string;
  product_name: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price: string;
  stock_quantity: number;
};

function toVariantLabel(row: Pick<CartItemRow, 'size' | 'color'>) {
  return [row.size, row.color].filter(Boolean).join(' / ');
}

function toCartItem(row: CartItemRow): CartItem {
  const unitPrice = Number(row.unit_price);
  const quantity = Number(row.quantity);

  return {
    id: row.item_id,
    productVariantId: row.product_variant_id,
    sku: row.sku,
    productName: row.product_name,
    variantLabel: toVariantLabel(row),
    quantity,
    unitPrice,
    lineTotal: unitPrice * quantity,
    availableStock: Number(row.stock_quantity)
  };
}

export class PgCartRepository implements CartRepository {
  constructor(private readonly database: PgDatabase) {}

  async findByUserId(userId: string) {
    const result = await this.database.query<CartItemRow>(
      `
      SELECT
        c.id AS cart_id,
        c.user_id,
        ci.id AS item_id,
        ci.product_variant_id,
        pv.sku,
        p.name AS product_name,
        pv.size,
        pv.color,
        ci.quantity,
        pv.price AS unit_price,
        COALESCE(i.stock_quantity, 0) AS stock_quantity
      FROM carts c
      LEFT JOIN cart_items ci ON ci.cart_id = c.id
      LEFT JOIN product_variants pv ON pv.id = ci.product_variant_id
      LEFT JOIN products p ON p.id = pv.product_id
      LEFT JOIN inventory i ON i.product_variant_id = pv.id
      WHERE c.user_id = $1
      ORDER BY ci.id ASC
      `,
      [userId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    const rows = result.rows.filter((row) => row.item_id);
    const items = rows.map(toCartItem);

    return {
      id: result.rows[0].cart_id,
      userId,
      totalAmount: items.reduce((sum, item) => sum + item.lineTotal, 0),
      items
    };
  }

  async findVariantById(productVariantId: string) {
    const result = await this.database.query<{
      id: string;
      price: string;
      stock_quantity: number;
    }>(
      `
      SELECT pv.id, pv.price, COALESCE(i.stock_quantity, 0) AS stock_quantity
      FROM product_variants pv
      LEFT JOIN inventory i ON i.product_variant_id = pv.id
      WHERE pv.id = $1
      `,
      [productVariantId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      price: Number(row.price),
      stockQuantity: Number(row.stock_quantity)
    };
  }

  async addItem(input: { userId: string; productVariantId: string; quantity: number }) {
    const existingCart = await this.database.query<{ id: string }>(
      'SELECT id FROM carts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [input.userId]
    );

    const cartId =
      existingCart.rowCount === 0
        ? (
            await this.database.query<{ id: string }>(
              'INSERT INTO carts (user_id) VALUES ($1) RETURNING id',
              [input.userId]
            )
          ).rows[0].id
        : existingCart.rows[0].id;

    const itemResult = await this.database.query<CartItemRow>(
      `
      WITH variant_stock AS (
        SELECT pv.id AS product_variant_id, COALESCE(i.stock_quantity, 0) AS stock_quantity
        FROM product_variants pv
        LEFT JOIN inventory i ON i.product_variant_id = pv.id
        WHERE pv.id = $2
      ),
      upserted AS (
        INSERT INTO cart_items (cart_id, product_variant_id, quantity)
        SELECT $1, product_variant_id, $3
        FROM variant_stock
        WHERE $3 <= stock_quantity
        ON CONFLICT (cart_id, product_variant_id)
        DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
        WHERE cart_items.quantity + EXCLUDED.quantity <= (
          SELECT stock_quantity FROM variant_stock
        )
        RETURNING id, cart_id, product_variant_id, quantity
      )
      SELECT
        c.id AS cart_id,
        c.user_id,
        u.id AS item_id,
        u.product_variant_id,
        pv.sku,
        p.name AS product_name,
        pv.size,
        pv.color,
        u.quantity,
        pv.price AS unit_price,
        COALESCE(i.stock_quantity, 0) AS stock_quantity
      FROM upserted u
      JOIN carts c ON c.id = u.cart_id
      JOIN product_variants pv ON pv.id = u.product_variant_id
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN inventory i ON i.product_variant_id = pv.id
      `,
      [cartId, input.productVariantId, input.quantity]
    );

    return itemResult.rowCount === 0 ? null : toCartItem(itemResult.rows[0]);
  }

  async updateItemQuantity(itemId: string, quantity: number) {
    const result = await this.database.query<CartItemRow>(
      `
      WITH target_stock AS (
        SELECT ci.id AS item_id, COALESCE(i.stock_quantity, 0) AS stock_quantity
        FROM cart_items ci
        JOIN product_variants pv ON pv.id = ci.product_variant_id
        LEFT JOIN inventory i ON i.product_variant_id = pv.id
        WHERE ci.id = $1
      ),
      updated AS (
        UPDATE cart_items ci
        SET quantity = $2
        FROM target_stock ts
        WHERE ci.id = ts.item_id AND $2 <= ts.stock_quantity
        RETURNING ci.id, ci.cart_id, ci.product_variant_id, ci.quantity
      )
      SELECT
        c.id AS cart_id,
        c.user_id,
        u.id AS item_id,
        u.product_variant_id,
        pv.sku,
        p.name AS product_name,
        pv.size,
        pv.color,
        u.quantity,
        pv.price AS unit_price,
        COALESCE(i.stock_quantity, 0) AS stock_quantity
      FROM updated u
      JOIN carts c ON c.id = u.cart_id
      JOIN product_variants pv ON pv.id = u.product_variant_id
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN inventory i ON i.product_variant_id = pv.id
      `,
      [itemId, quantity]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return toCartItem(result.rows[0]);
  }

  async deleteItem(itemId: string) {
    const result = await this.database.query('DELETE FROM cart_items WHERE id = $1', [itemId]);
    return (result.rowCount ?? 0) > 0;
  }

  async findItemById(itemId: string) {
    const result = await this.database.query<CartItemRow>(
      `
      SELECT
        c.id AS cart_id,
        c.user_id,
        ci.id AS item_id,
        ci.product_variant_id,
        pv.sku,
        p.name AS product_name,
        pv.size,
        pv.color,
        ci.quantity,
        pv.price AS unit_price,
        COALESCE(i.stock_quantity, 0) AS stock_quantity
      FROM cart_items ci
      JOIN carts c ON c.id = ci.cart_id
      JOIN product_variants pv ON pv.id = ci.product_variant_id
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN inventory i ON i.product_variant_id = pv.id
      WHERE ci.id = $1
      `,
      [itemId]
    );

    return result.rowCount === 0 ? null : toCartItem(result.rows[0]);
  }
}
