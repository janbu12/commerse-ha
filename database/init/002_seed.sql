INSERT INTO users (id, email, password_hash, name, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'demo@example.com', '$argon2id$v=19$m=65536,t=3,p=4$placeholder$placeholder', 'Demo User', 'customer')
ON CONFLICT (email) DO NOTHING;

INSERT INTO categories (id, name)
VALUES ('10000000-0000-0000-0000-000000000001', 'Default')
ON CONFLICT (name) DO NOTHING;

INSERT INTO products (id, name, description, price, category_id)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  'Sample Product',
  'Seed product for checkout smoke testing',
  100000,
  '10000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_variants (id, product_id, sku, size, color, price)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'SAMPLE-001',
  'M',
  'Black',
  100000
)
ON CONFLICT (sku) DO NOTHING;

INSERT INTO inventory (product_variant_id, stock_quantity, reserved_quantity)
VALUES ('30000000-0000-0000-0000-000000000001', 20, 0)
ON CONFLICT (product_variant_id) DO NOTHING;

INSERT INTO carts (id, user_id)
VALUES (
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO cart_items (cart_id, product_variant_id, quantity)
VALUES (
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  1
)
ON CONFLICT (cart_id, product_variant_id) DO NOTHING;
