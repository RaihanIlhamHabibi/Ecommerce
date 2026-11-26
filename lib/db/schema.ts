import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const appUsers = pgTable('app_users', {
  authUserId: text('auth_user_id').primaryKey(),
  email: text('email').notNull().unique(),
  role: text('role').$type<'admin' | 'buyer'>().notNull().default('buyer'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  category: text('category').notNull().default('Perawatan kulit'),
  imageUrl: text('image_url').notNull().default(''),
  skinType: text('skin_type').notNull().default('Semua jenis'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const productVariants = pgTable('product_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull(),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  stock: integer('stock').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  buyerAuthUserId: text('buyer_auth_user_id').notNull(),
  status: text('status').$type<'pending_payment' | 'paid' | 'cancelled'>().notNull().default('pending_payment'),
  total: integer('total').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull(),
  productId: uuid('product_id').notNull(),
  variantId: uuid('variant_id').notNull(),
  productName: text('product_name').notNull(),
  variantName: text('variant_name').notNull(),
  unitPrice: integer('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
  lineTotal: integer('line_total').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
