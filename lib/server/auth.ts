import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { appUsers } from '@/lib/db/schema'
import { db } from '@/lib/db'

type Identity = { id: string; email: string; name: string }

export async function getIdentity(request: Request): Promise<Identity | null> {
  const cookie = request.headers.get('cookie')
  const baseUrl = process.env.NEON_AUTH_BASE_URL
  if (!cookie || !baseUrl) return null

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/get-session`, {
      headers: { cookie, accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) return null
    const payload = await response.json()
    const user = payload?.user
    if (typeof user?.id !== 'string' || typeof user?.email !== 'string') return null
    return { id: user.id, email: user.email, name: typeof user.name === 'string' ? user.name : user.email }
  } catch {
    return null
  }
}

export async function getAppUser(request: Request) {
  const identity = await getIdentity(request)
  if (!identity) return null

  const adminEmails = new Set((process.env.ADMIN_EMAILS ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))
  const isConfiguredAdmin = adminEmails.has(identity.email.toLowerCase())

  await db.insert(appUsers).values({
    authUserId: identity.id,
    email: identity.email,
    role: isConfiguredAdmin ? 'admin' : 'buyer',
  }).onConflictDoNothing()

  if (isConfiguredAdmin) {
    await db.update(appUsers).set({ email: identity.email, role: 'admin' }).where(eq(appUsers.authUserId, identity.id))
  } else {
    await db.update(appUsers).set({ email: identity.email }).where(eq(appUsers.authUserId, identity.id))
  }

  const [profile] = await db.select().from(appUsers).where(eq(appUsers.authUserId, identity.id)).limit(1)
  return profile ? { ...identity, role: profile.role } : null
}

export async function requireUser(request: Request) {
  const user = await getAppUser(request)
  if (!user) return { response: NextResponse.json({ error: 'Silakan masuk untuk melanjutkan.' }, { status: 401 }) }
  return { user }
}

export async function requireAdmin(request: Request) {
  const result = await requireUser(request)
  if ('response' in result) return result
  if (result.user.role !== 'admin') {
    return { response: NextResponse.json({ error: 'Akses khusus admin.' }, { status: 403 }) }
  }
  return result
}
