'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Flower2 } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

export function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = mode === 'sign-in'
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name })
      if (result.error) {
        setError('Email atau kata sandi tidak sesuai. Coba lagi.')
        return
      }

      const profileResponse = await fetch('/api/me', { cache: 'no-store' })
      if (!profileResponse.ok) {
        setError('Login berhasil, tapi profil belum dapat dimuat. Coba masuk lagi.')
        return
      }
      const profile = await profileResponse.json() as { role: 'admin' | 'buyer' }
      const requested = searchParams.get('redirectTo') ?? '/'
      const safeDestination = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/'
      const isAdminDestination = safeDestination === '/admin' || safeDestination.startsWith('/admin/')
      const destination = profile.role === 'admin' ? '/admin' : isAdminDestination ? '/' : safeDestination
      router.replace(destination)
      router.refresh()
    } catch {
      setError('Tidak dapat menyelesaikan proses masuk. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-page"><Link className="back-link" href="/"><ArrowLeft size={16} /> Kembali ke Lumière</Link><div className="auth-card"><Link href="/" className="brand auth-brand"><span className="brand-mark"><Flower2 size={19} /></span><span>LUMIÈRE<span className="brand-sub">SKIN</span></span></Link><span className="eyebrow muted">A QUIETER KIND OF CARE</span><h1>{mode === 'sign-in' ? <>Senang melihatmu<br /><em>kembali.</em></> : <>Mulai ritual<br /><em>barumu.</em></>}</h1><p>{mode === 'sign-in' ? 'Masuk untuk melihat pesanan dan melanjutkan ritual favoritmu.' : 'Buat akun untuk menyimpan pesanan dan memulai ritual perawatanmu.'}</p><form onSubmit={submit} className="auth-fields">{mode === 'sign-up' && <label>Nama lengkap<input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama kamu" /></label>}<label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" /></label><label>Kata sandi<input required type="password" minLength={8} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 8 karakter" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button auth-submit" disabled={busy}>{busy ? 'Memproses...' : mode === 'sign-in' ? 'Masuk ke akun' : 'Buat akun'} <ArrowRight size={16} /></button></form><p className="auth-switch">{mode === 'sign-in' ? 'Belum punya akun?' : 'Sudah pernah bergabung?'} <button onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError('') }}>{mode === 'sign-in' ? 'Buat akun' : 'Masuk'}</button></p><span className="auth-footnote">Akun dikelola dengan aman oleh Neon Auth.</span></div></main>
}
