import { and, asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { productVariants, products } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rows = await db.select({
    id: products.id,
    name: products.name,
    slug: products.slug,
    description: products.description,
    category: products.category,
    imageUrl: products.imageUrl,
    skinType: products.skinType,
    variantId: productVariants.id,
    variantName: productVariants.name,
    price: productVariants.price,
    stock: productVariants.stock,
  }).from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .where(and(eq(products.active, true), eq(productVariants.active, true)))
    .orderBy(asc(products.createdAt), asc(productVariants.createdAt))

  const result = new Map<string, { id: string; name: string; slug: string; description: string; category: string; imageUrl: string; skinType: string; variants: Array<{ id: string; name: string; price: number; stock: number }> }>()
  for (const row of rows) {
    const product = result.get(row.id) ?? {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      category: row.category,
      imageUrl: row.imageUrl,
      skinType: row.skinType,
      variants: [],
    }
    product.variants.push({ id: row.variantId, name: row.variantName, price: row.price, stock: row.stock })
    result.set(row.id, product)
  }

  return NextResponse.json([...result.values()], { headers: { 'cache-control': 'no-store' } })
}
