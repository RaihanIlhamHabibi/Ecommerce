import { eq, asc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { productVariants, products } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/server/auth'

export const dynamic = 'force-dynamic'

const productInput = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(600),
  category: z.string().trim().min(2).max(60),
  skinType: z.string().trim().min(2).max(60),
  imageUrl: z.string().trim().max(500),
  variants: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    price: z.number().int().nonnegative().max(100_000_000),
    stock: z.number().int().nonnegative().max(1_000_000),
  })).min(1).max(20),
}).superRefine((value, context) => {
  const names = value.variants.map((variant) => variant.name.toLowerCase())
  if (new Set(names).size !== names.length) context.addIssue({ code: 'custom', message: 'Nama varian tidak boleh duplikat.', path: ['variants'] })
})

export async function GET(request: Request) {
  const access = await requireAdmin(request)
  if ('response' in access) return access.response

  const rows = await db.select({
    id: products.id,
    name: products.name,
    slug: products.slug,
    description: products.description,
    category: products.category,
    imageUrl: products.imageUrl,
    skinType: products.skinType,
    active: products.active,
    variantId: productVariants.id,
    variantName: productVariants.name,
    price: productVariants.price,
    stock: productVariants.stock,
    variantActive: productVariants.active,
  }).from(products)
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .orderBy(asc(products.createdAt), asc(productVariants.createdAt))

  const grouped = new Map<string, { id: string; name: string; slug: string; description: string; category: string; imageUrl: string; skinType: string; active: boolean; variants: Array<{ id: string; name: string; price: number; stock: number; active: boolean }> }>()
  for (const row of rows) {
    const product = grouped.get(row.id) ?? { id: row.id, name: row.name, slug: row.slug, description: row.description, category: row.category, imageUrl: row.imageUrl, skinType: row.skinType, active: row.active, variants: [] }
    if (row.variantId) product.variants.push({ id: row.variantId, name: row.variantName!, price: row.price!, stock: row.stock!, active: row.variantActive! })
    grouped.set(row.id, product)
  }
  return NextResponse.json([...grouped.values()], { headers: { 'cache-control': 'no-store' } })
}

export async function POST(request: Request) {
  const access = await requireAdmin(request)
  if ('response' in access) return access.response

  const parsed = productInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data produk tidak valid.' }, { status: 400 })

  const values = parsed.data
  const baseSlug = values.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`
  const { variants, ...productValues } = values
  const created = await db.transaction(async (tx) => {
    const [product] = await tx.insert(products).values({ ...productValues, slug }).returning()
    await tx.insert(productVariants).values(variants.map((variant) => ({ ...variant, productId: product.id })))
    return product
  })
  return NextResponse.json(created, { status: 201 })
}
