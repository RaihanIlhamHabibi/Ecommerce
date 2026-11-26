CREATE TABLE IF NOT EXISTS app_users (
  auth_user_id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'buyer' CHECK (role IN ('admin', 'buyer')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Perawatan kulit',
  image_url text NOT NULL DEFAULT '',
  skin_type text NOT NULL DEFAULT 'Semua jenis',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS skin_type text NOT NULL DEFAULT 'Semua jenis';

CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  name text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, name)
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_auth_user_id text NOT NULL REFERENCES app_users(auth_user_id),
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'paid', 'cancelled')),
  total integer NOT NULL CHECK (total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  variant_id uuid NOT NULL REFERENCES product_variants(id),
  product_name text NOT NULL,
  variant_name text NOT NULL,
  unit_price integer NOT NULL CHECK (unit_price >= 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  line_total integer NOT NULL CHECK (line_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_buyer_created_at_idx
  ON orders (buyer_auth_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx
  ON order_items (order_id);
CREATE INDEX IF NOT EXISTS product_variants_product_id_idx
  ON product_variants (product_id);
CREATE INDEX IF NOT EXISTS products_skin_type_active_idx
  ON products (skin_type, active);

INSERT INTO products (name, slug, description, category, image_url, skin_type)
VALUES
  ('Cleansing Balm', 'cleansing-balm', 'Balm lembut yang membantu membersihkan sunscreen dan makeup tanpa membuat kulit terasa tertarik.', 'Pembersih', '/images/product-cleansing.png', 'Kering'),
  ('Body Scrub', 'body-scrub', 'Scrub bertekstur halus untuk ritual mandi yang terasa lebih rileks dan menyegarkan.', 'Perawatan tubuh', '/images/product-body-scrub.png', 'Semua jenis'),
  ('Clay Cleanser', 'clay-cleanser', 'Pembersih wajah dengan clay yang membantu mengangkat kotoran untuk kulit terasa bersih dan nyaman.', 'Pembersih', '/images/product-cleanser.png', 'Berminyak'),
  ('Hydrating Cleanser', 'hydrating-cleanser', 'Pembersih lembut dengan tekstur gel yang menjaga kulit tetap terasa nyaman dan terhidrasi.', 'Pembersih', '/images/product-hydrating-cleanser.png', 'Kering'),
  ('Radiance Serum', 'radiance-serum', 'Serum ringan untuk membantu kulit tampak lebih cerah dan segar setiap hari.', 'Serum', '/images/product-radiance-serum.png', 'Semua jenis'),
  ('Velvet Moisturizer', 'velvet-moisturizer', 'Pelembap bertekstur lembut untuk mengunci hidrasi tanpa rasa berat.', 'Pelembap', '/images/product-moisturizer.png', 'Kering'),
  ('Daily Sunscreen SPF 30', 'daily-sunscreen-spf-30', 'Perlindungan harian dengan tekstur ringan yang nyaman dipakai sebelum beraktivitas.', 'Sunscreen', '/images/product-sunscreen.png', 'Semua jenis'),
  ('Hydrating Mist', 'hydrating-mist', 'Face mist dengan sensasi segar untuk membantu kulit terasa lembap sepanjang hari.', 'Toner & Mist', '/images/product-hydrating-mist.png', 'Sensitif'),
  ('Detox Clay Mask', 'detox-clay-mask', 'Masker clay untuk membantu menyerap minyak berlebih dan membersihkan pori.', 'Masker', '/images/product-clay-mask.png', 'Berminyak'),
  ('Nourishing Face Oil', 'nourishing-face-oil', 'Face oil kaya emolien untuk memberi kilau sehat dan kelembapan ekstra.', 'Face Oil', '/images/product-face-oil.png', 'Kering'),
  ('Restorative Eye Cream', 'restorative-eye-cream', 'Krim mata ringan untuk area mata yang terasa lebih lembut dan terawat.', 'Eye Care', '/images/product-eye-cream.png', 'Semua jenis'),
  ('Body Lotion', 'body-lotion', 'Body lotion harian dengan tekstur cepat meresap untuk kulit tubuh terasa halus.', 'Perawatan tubuh', '/images/product-body-lotion.png', 'Semua jenis')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_variants (product_id, name, price, stock)
SELECT p.id, v.name, v.price, v.stock
FROM (VALUES
  ('cleansing-balm', 'Almond', 89000, 23),
  ('cleansing-balm', 'Tutti Fruity', 89000, 18),
  ('body-scrub', 'Almond', 79000, 20),
  ('body-scrub', 'Tutti Fruity', 79000, 16),
  ('clay-cleanser', 'Original', 69000, 30),
  ('clay-cleanser', 'Green Tea', 72000, 14),
  ('hydrating-cleanser', '100 ml', 79000, 50),
  ('hydrating-cleanser', '200 ml', 115000, 24),
  ('radiance-serum', '15 ml', 69000, 36),
  ('radiance-serum', '30 ml', 119000, 20),
  ('velvet-moisturizer', '50 ml', 98000, 30),
  ('velvet-moisturizer', '100 ml', 159000, 18),
  ('daily-sunscreen-spf-30', '50 ml', 85000, 40),
  ('daily-sunscreen-spf-30', '100 ml', 145000, 22),
  ('hydrating-mist', '100 ml', 69000, 35),
  ('detox-clay-mask', '75 g', 79000, 32),
  ('detox-clay-mask', '150 g', 129000, 20),
  ('nourishing-face-oil', '30 ml', 139000, 18),
  ('restorative-eye-cream', '15 ml', 105000, 24),
  ('body-lotion', '250 ml', 89000, 35),
  ('body-lotion', '500 ml', 145000, 20)
) AS v(slug, name, price, stock)
JOIN products p ON p.slug = v.slug
ON CONFLICT (product_id, name) DO NOTHING;
