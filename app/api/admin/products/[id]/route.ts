import { and, eq, ne } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { orderItems, productVariants, products } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/server/auth'

const updateInput = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(600),
  category: z.string().trim().min(2).max(60),
  skinType: z.string().trim().min(2).max(60),
  imageUrl: z.string().trim().max(500),
  variants: z.array(z.object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(80),
    price: z.number().int().nonnegative().max(100_000_000),
    stock: z.number().int().nonnegative().max(1_000_000),
  })).min(1).max(20),
}).superRefine((value, context) => {
  const names = value.variants.map((variant) => variant.name.toLowerCase())
  if (new Set(names).size !== names.length) context.addIssue({ code: 'custom', message: 'Nama varian tidak boleh duplikat.', path: ['variants'] })
})

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireAdmin(request)
  if ('response' in access) return access.response
  const { id } = await context.params
  const parsed = updateInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data produk tidak valid.' }, { status: 400 })

  try {
    await db.transaction(async (tx) => {
      const [product] = await tx.select().from(products).where(eq(products.id, id)).limit(1)
      if (!product) throw new Error('Produk tidak ditemukan.')
      const values = parsed.data
      const slugBase = values.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const slug = product.name === values.name ? product.slug : `${slugBase}-${crypto.randomUUID().slice(0, 6)}`
      await tx.update(products).set({ name: values.name, slug, description: values.description, category: values.category, skinType: values.skinType, imageUrl: values.imageUrl, updatedAt: new Date() }).where(eq(products.id, id))

      const existing = await tx.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.productId, id))
      const retained = new Set<string>()
      for (const variant of values.variants) {
        if (variant.id) {
          const [updated] = await tx.update(productVariants)
            .set({ name: variant.name, price: variant.price, stock: variant.stock, active: true })
            .where(and(eq(productVariants.id, variant.id), eq(productVariants.productId, id)))
            .returning({ id: productVariants.id })
          if (!updated) throw new Error('Varian tidak cocok dengan produk.')
          retained.add(updated.id)
        } else {
          const [created] = await tx.insert(productVariants).values({ ...variant, productId: id }).returning({ id: productVariants.id })
          retained.add(created.id)
        }
      }
      for (const variant of existing) {
        if (!retained.has(variant.id)) await tx.update(productVariants).set({ active: false }).where(and(eq(productVariants.id, variant.id), ne(productVariants.active, false)))
      }
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Produk gagal diperbarui.' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request, context: RouteContext) {
  const access = await requireAdmin(request)
  if ('response' in access) return access.response
  const { id } = await context.params

  const result = await db.transaction(async (tx) => {
    const [product] = await tx.select({ id: products.id }).from(products)
      .where(eq(products.id, id))
      .for('update')
      .limit(1)
    if (!product) return 'not-found'

    const [orderItem] = await tx.select({ id: orderItems.id }).from(orderItems)
      .where(eq(orderItems.productId, id))
      .limit(1)
    if (orderItem) {
      await tx.update(products).set({ active: false, updatedAt: new Date() }).where(eq(products.id, id))
      await tx.update(productVariants).set({ active: false }).where(eq(productVariants.productId, id))
      return 'archived'
    }

    await tx.delete(productVariants).where(eq(productVariants.productId, id))
    await tx.delete(products).where(eq(products.id, id))
    return 'deleted'
  })

  if (result === 'not-found') return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 })
  return NextResponse.json({ ok: true, archived: result === 'archived' })
}
