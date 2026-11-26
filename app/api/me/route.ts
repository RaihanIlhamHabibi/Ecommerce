import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const user = await getAppUser(request)
  if (!user) return NextResponse.json({ error: 'Silakan masuk untuk melanjutkan.' }, { status: 401 })

  return NextResponse.json(
    { name: user.name, email: user.email, role: user.role },
    { headers: { 'cache-control': 'no-store' } },
  )
}
