import { Suspense } from 'react'
import { AuthForm } from '@/components/auth-form'

export default function LoginPage() {
  return <Suspense fallback={<main className="auth-page"><div className="auth-card">Memuat halaman masuk…</div></main>}><AuthForm /></Suspense>
}
