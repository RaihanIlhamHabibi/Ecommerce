import { NextRequest, NextResponse } from 'next/server'

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const baseUrl = process.env.NEON_AUTH_BASE_URL
  if (!baseUrl) return NextResponse.json({ error: 'Neon Auth belum dikonfigurasi.' }, { status: 503 })

  const requestOrigin = request.headers.get('origin')
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (!requestOrigin || new URL(requestOrigin).origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: 'Permintaan lintas-origin ditolak.' }, { status: 403 })
    }
  }

  const { path } = await context.params
  const upstreamOrigin = new URL(baseUrl).origin
  const upstreamUrl = `${baseUrl.replace(/\/$/, '')}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`
  const headers = new Headers()
  for (const key of ['accept', 'content-type', 'cookie', 'user-agent', 'x-neon-client-info']) {
    const value = request.headers.get(key)
    if (value) headers.set(key, value)
  }
  headers.set('origin', upstreamOrigin)
  headers.set('referer', `${upstreamOrigin}/`)

  const response = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
    cache: 'no-store',
    redirect: 'manual',
  })

  const responseHeaders = new Headers()
  for (const [key, value] of response.headers.entries()) {
    if (!['set-cookie', 'content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) responseHeaders.set(key, value)
  }
  responseHeaders.set('cache-control', 'no-store')

  for (const rawCookie of response.headers.getSetCookie()) {
    let cookie = rawCookie
      .replace(/;\s*Domain=[^;]*/ig, '')
      .replace(/;\s*Path=[^;]*/ig, '; Path=/')
      .replace(/;\s*SameSite=(?:Lax|Strict|None)/ig, '; SameSite=None')
    if (!/;\s*Path=/i.test(cookie)) cookie += '; Path=/'
    if (!/;\s*SameSite=/i.test(cookie)) cookie += '; SameSite=None'
    if (!/;\s*Secure/i.test(cookie)) cookie += '; Secure'
    responseHeaders.append('set-cookie', cookie)
  }

  return new NextResponse(response.body, { status: response.status, headers: responseHeaders })
}

export const GET = forward
export const POST = forward
export const PUT = forward
export const PATCH = forward
export const DELETE = forward
