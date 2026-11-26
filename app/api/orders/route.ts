import { and, asc, eq, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { orderItems, orders, productVariants, products } from '@/lib/db/schema'
import { requireUser } from '@/lib/server/auth'

export const dynamic = 'force-dynamic'

const checkoutInput = z.object({
  items: z.array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(99) })).min(1).max(30),
})

export async function GET(request: Request) {
  const access = await requireUser(request)
  if ('response' in access) return access.response

  const userOrders = await db.select().from(orders).where(eq(orders.buyerAuthUserId, access.user.id)).orderBy(asc(orders.createdAt))
  if (userOrders.length === 0) return NextResponse.json([])
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, userOrders.map((order) => order.id)))
  return NextResponse.json(userOrders.map((order) => ({ ...order, items: items.filter((item) => item.orderId === order.id) })), { headers: { 'cache-control': 'no-store' } })
}

export async function POST(request: Request) {
  const access = await requireUser(request)
  if ('response' in access) return access.response
  const parsed = checkoutInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Keranjang tidak valid.' }, { status: 400 })

  const quantities = new Map<string, number>()
  for (const item of parsed.data.items) quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity)
  if ([...quantities.values()].some((quantity) => quantity > 99)) return NextResponse.json({ error: 'Maksimal 99 item per varian.' }, { status: 400 })

  const created = await db.transaction(async (tx) => {
    const variantRows = await tx.select({
      variantId: productVariants.id,
      variantName: productVariants.name,
      price: productVariants.price,
      stock: productVariants.stock,
      productId: products.id,
      productName: products.name,
    }).from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(inArray(productVariants.id, [...quantities.keys()]), eq(productVariants.active, true), eq(products.active, true)))

    if (variantRows.length !== quantities.size) throw new Error('Salah satu varian sudah tidak tersedia.')
    const lines = variantRows.map((variant) => {
      const quantity = quantities.get(variant.variantId)!
      if (variant.stock < 1) throw new Error(`${variant.productName} — ${variant.variantName} sedang habis.`)
      return { ...variant, quantity, lineTotal: variant.price * quantity }
    })
    const total = lines.reduce((sum, line) => sum + line.lineTotal, 0)
    const [order] = await tx.insert(orders).values({ buyerAuthUserId: access.user.id, total, status: 'pending_payment' }).returning()
    await tx.insert(orderItems).values(lines.map((line) => ({
      orderId: order.id,
      productId: line.productId,
      variantId: line.variantId,
      productName: line.productName,
      variantName: line.variantName,
      unitPrice: line.price,
      quantity: line.quantity,
      lineTotal: line.lineTotal,
    })))
    return { ...order, items: lines }
  }).catch((error: unknown) => error instanceof Error ? error : new Error('Checkout gagal.'))

  if (created instanceof Error) return NextResponse.json({ error: created.message }, { status: 409 })
  return NextResponse.json(created, { status: 201 })
}
