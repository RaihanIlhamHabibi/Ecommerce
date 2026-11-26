import { and, eq, gte, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { orderItems, orders, productVariants } from '@/lib/db/schema'
import { requireUser } from '@/lib/server/auth'

const actionInput = z.object({ action: z.enum(['pay', 'cancel']) })
type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireUser(request)
  if ('response' in access) return access.response
  const { id } = await context.params
  const parsed = actionInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Aksi pesanan tidak valid.' }, { status: 400 })

  try {
    const updated = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders)
        .where(and(eq(orders.id, id), eq(orders.buyerAuthUserId, access.user.id)))
        .for('update')
        .limit(1)
      if (!order) throw new Error('Pesanan tidak ditemukan.')
      if (order.status !== 'pending_payment') throw new Error(order.status === 'cancelled' ? 'Pesanan ini sudah dibatalkan.' : 'Pesanan ini sudah dibayar.')

      if (parsed.data.action === 'cancel') {
        const [cancelled] = await tx.update(orders).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(orders.id, id)).returning()
        return cancelled
      }

      const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, id))
      for (const line of lines) {
        const [variant] = await tx.update(productVariants)
          .set({ stock: sql`${productVariants.stock} - ${line.quantity}` })
          .where(and(eq(productVariants.id, line.variantId), eq(productVariants.active, true), gte(productVariants.stock, line.quantity)))
          .returning({ id: productVariants.id })
        if (!variant) throw new Error(`Stok ${line.productName} — ${line.variantName} tidak cukup. Pesanan belum dibayar dan stok tidak berubah.`)
      }

      const [paid] = await tx.update(orders).set({ status: 'paid', updatedAt: new Date() }).where(eq(orders.id, id)).returning()
      return paid
    })
    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Aksi pembayaran gagal.' }, { status: 409 })
  }
}
