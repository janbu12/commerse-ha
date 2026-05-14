import type { PgDatabase } from '../../shared/database/pg-database.js';

export type ProductVariant = {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  price: number;
  stock: number;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  categoryName: string | null;
  variants: ProductVariant[];
  createdAt: Date;
};

export type ProductRepository = {
  findMany(params: { categoryId?: string; limit?: number; offset?: number }): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
};

export class PgProductRepository implements ProductRepository {
  constructor(private readonly database: PgDatabase) {}

  async findMany(params: { categoryId?: string; limit?: number; offset?: number }) {
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    
    let query = `
      SELECT 
        p.id, p.name, p.description, p.price, p.created_at,
        c.name as category_name,
        json_agg(json_build_object(
          'id', pv.id,
          'sku', pv.sku,
          'size', pv.size,
          'color', pv.color,
          'price', pv.price,
          'stock', i.stock_quantity
        )) as variants
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_variants pv ON p.id = pv.product_id
      LEFT JOIN inventory i ON pv.id = i.product_variant_id
    `;

    const values: any[] = [];
    if (params.categoryId) {
      query += ` WHERE p.category_id = $1 `;
      values.push(params.categoryId);
    }

    query += `
      GROUP BY p.id, c.name
      ORDER BY p.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    values.push(limit, offset);

    const result = await this.database.query<any>(query, values);

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      categoryName: row.category_name,
      variants: row.variants.map((v: any) => ({
        ...v,
        price: Number(v.price),
        stock: Number(v.stock)
      })),
      createdAt: row.created_at
    }));
  }

  async findById(id: string) {
    const query = `
      SELECT 
        p.id, p.name, p.description, p.price, p.created_at,
        c.name as category_name,
        json_agg(json_build_object(
          'id', pv.id,
          'sku', pv.sku,
          'size', pv.size,
          'color', pv.color,
          'price', pv.price,
          'stock', i.stock_quantity
        )) as variants
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_variants pv ON p.id = pv.product_id
      LEFT JOIN inventory i ON pv.id = i.product_variant_id
      WHERE p.id = $1
      GROUP BY p.id, c.name
    `;

    const result = await this.database.query<any>(query, [id]);

    if (result.rowCount === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      categoryName: row.category_name,
      variants: row.variants.map((v: any) => ({
        ...v,
        price: Number(v.price),
        stock: Number(v.stock)
      })),
      createdAt: row.created_at
    };
  }
}
