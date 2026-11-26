'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import useSWR from 'swr'
import { ArrowLeft, ArrowUpRight, Check, CirclePlus, Flower2, LoaderCircle, LogOut, PackagePlus, Pencil, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

type Variant = { id?: string; name: string; price: number; stock: number; active?: boolean }
type Product = { id: string; name: string; slug: string; description: string; category: string; imageUrl: string; skinType: string; active: boolean; variants: Variant[] }
type ProductForm = Omit<Product, 'id' | 'slug' | 'active'>

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Data belum dapat dimuat.')
  return data
}
const money = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
const blankForm: ProductForm = { name: '', description: '', category: 'Perawatan kulit', imageUrl: '/images/product-cleansing.png', skinType: 'Semua jenis', variants: [{ name: '', price: 0, stock: 0 }] }

export function AdminDashboard() {
  const { data: session, isPending } = authClient.useSession()
  const { data: products = [], error, isLoading, mutate } = useSWR<Product[]>('/api/admin/products', fetcher)
  const [form, setForm] = useState<ProductForm>(blankForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  function openCreate() {
    setEditingId(null)
    setForm({ ...blankForm, variants: [{ ...blankForm.variants[0] }] })
    setDialogOpen(true)
  }
  function openEdit(product: Product) {
    setEditingId(product.id)
    setForm({ name: product.name, description: product.description, category: product.category, imageUrl: product.imageUrl, skinType: product.skinType, variants: product.variants.filter((variant) => variant.active).map((variant) => ({ ...variant })) })
    setDialogOpen(true)
  }
  function updateVariant(index: number, key: 'name' | 'price' | 'stock', value: string) {
    setForm((current) => ({ ...current, variants: current.variants.map((variant, position) => position === index ? { ...variant, [key]: key === 'name' ? value : Math.max(0, Number(value)) } : variant) }))
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    try {
      const response = await fetch(editingId ? `/api/admin/products/${editingId}` : '/api/admin/products', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Produk belum tersimpan.')
      await mutate()
      setDialogOpen(false)
      setNotice(editingId ? 'Perubahan produk tersimpan.' : 'Produk baru berhasil ditambahkan.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Produk belum tersimpan.')
    } finally {
      setBusy(false)
    }
  }

  async function archiveProduct(product: Product) {
    if (!window.confirm(`Arsipkan ${product.name}? Produk akan disembunyikan dari katalog.`)) return
    const response = await fetch(`/api/admin/products/${product.id}`, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok) setNotice(data.error ?? 'Produk belum dapat diarsipkan.')
    else { setNotice(`${product.name} diarsipkan.`); await mutate() }
  }

  const totalStock = products.reduce((sum, product) => sum + product.variants.filter((variant) => variant.active).reduce((variantSum, variant) => variantSum + variant.stock, 0), 0)
  const inStockVariants = products.flatMap((product) => product.variants).filter((variant) => variant.active && variant.stock > 0).length

  if (isPending || isLoading) return <main className="admin-loading"><LoaderCircle className="spin" size={22} /> Memuat panel admin…</main>
  if (!session?.user) return <main className="access-state"><div className="access-card"><ShieldCheck size={32} /><span className="eyebrow muted">ADMIN ACCESS</span><h1>Masuk untuk<br /><em>melanjutkan.</em></h1><p>Panel ini hanya tersedia untuk akun admin Lumière Skin.</p><Link className="primary-button" href="/login?redirectTo=%2Fadmin">Masuk ke akun <ArrowUpRight size={16} /></Link></div></main>
  if (error?.message.includes('Akses khusus admin')) return <main className="access-state"><div className="access-card"><ShieldCheck size={32} /><span className="eyebrow muted">AREA TERBATAS</span><h1>Panel ini khusus<br /><em>admin.</em></h1><p>Akun {session.user.email} belum memiliki hak akses admin.</p><p className="setup-note">Tambahkan email akun admin ke variabel server <code>ADMIN_EMAILS</code> (pisahkan beberapa email dengan koma), lalu masuk ulang.</p><Link className="secondary-button" href="/">Kembali ke katalog</Link></div></main>

  return <main className="admin-shell">
    <header className="admin-topbar"><Link href="/" className="brand"><span className="brand-mark"><Flower2 size={18} /></span><span>LUMIÈRE<span className="brand-sub">SKIN</span></span></Link><div className="admin-top-actions"><span className="admin-user"><span className="online-dot" />{session.user.email}</span><Link href="/" className="back-store"><ArrowLeft size={15} /> Lihat toko</Link><button className="icon-button" onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => { window.location.href = '/' } } })} aria-label="Keluar"><LogOut size={16} /></button></div></header>
    <div className="admin-content"><div className="admin-heading"><div><span className="eyebrow muted">LUMIÈRE SKIN / CONTROL ROOM</span><h1>Selamat pagi,<br /><em>Admin.</em></h1><p>Kelola koleksi, varian, dan ketersediaan produkmu.</p></div><button className="primary-button" onClick={openCreate}><CirclePlus size={17} /> Tambah produk</button></div>
      {notice && <div className="notice" role="status"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Tutup pesan"><X size={15} /></button></div>}
      <section className="stat-grid" aria-label="Ringkasan katalog"><article className="stat-card"><span>Produk aktif</span><strong>{products.filter((product) => product.active).length.toString().padStart(2, '0')}</strong><small>Produk dalam katalog</small></article><article className="stat-card"><span>Varian tersedia</span><strong>{inStockVariants.toString().padStart(2, '0')}</strong><small>Varian dengan stok</small></article><article className="stat-card"><span>Total inventori</span><strong>{totalStock.toString().padStart(2, '0')}</strong><small>Unit dalam stok</small></article></section>
      <section className="admin-products"><div className="admin-section-title"><div><span className="eyebrow muted">INVENTORY / 01</span><h2>Koleksi produk</h2></div><span className="count-label">{products.length} produk</span></div>
        {products.length === 0 ? <div className="empty-state"><PackagePlus size={28} /><p>Belum ada produk. Mulai dengan menambah produk pertamamu.</p></div> : <div className="admin-product-list">{products.filter((product) => product.active).map((product) => <article className="admin-product-row" key={product.id}><div className="admin-product-visual"><Image src={product.imageUrl} alt="" fill sizes="80px" /></div><div className="admin-product-main"><div className="admin-product-title"><div><span className="eyebrow muted">{product.category} · {product.skinType}</span><h3>{product.name}</h3></div><span className="status-pill status-paid">Aktif</span></div><div className="variant-table"><div className="variant-table-head"><span>Varian</span><span>Harga</span><span>Stok</span><span>Status</span></div>{product.variants.filter((variant) => variant.active).map((variant) => <div className="variant-table-row" key={variant.id}><span>{variant.name}</span><span>{money(variant.price)}</span><span>{variant.stock}</span><span className={variant.stock > 0 ? 'stock-good' : 'stock-empty'}>{variant.stock > 0 ? 'Tersedia' : 'Habis'}</span></div>)}</div></div><div className="admin-row-actions"><button className="icon-button" onClick={() => openEdit(product)} aria-label={`Edit ${product.name}`}><Pencil size={16} /></button><button className="icon-button danger-icon" onClick={() => archiveProduct(product)} aria-label={`Arsipkan ${product.name}`}><Trash2 size={16} /></button></div></article>)}</div>}
      </section><div className="admin-footnote"><ShieldCheck size={15} /> Stok per varian hanya berkurang ketika simulasi pembayaran berhasil.</div>
    </div>
    {dialogOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) setDialogOpen(false) }}><section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title"><header className="modal-heading"><div><span className="eyebrow muted">PRODUCT / EDITION</span><h2 id="product-modal-title">{editingId ? 'Edit produk' : 'Produk baru'}</h2></div><button className="icon-button" type="button" onClick={() => setDialogOpen(false)} aria-label="Tutup form"><X size={19} /></button></header><form onSubmit={saveProduct} className="product-form"><div className="form-grid"><label>Nama produk<input required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Contoh: Cleansing Balm" /></label><label>Kategori<input required value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Pembersih" /></label><label>Jenis kulit<select value={form.skinType} onChange={(event) => setForm((current) => ({ ...current, skinType: event.target.value }))}><option>Semua jenis</option><option>Kering</option><option>Berminyak</option><option>Kombinasi</option><option>Sensitif</option></select></label></div><label>Deskripsi<textarea rows={3} maxLength={600} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Ceritakan manfaat dan tekstur produk." /></label><label>Path gambar<input value={form.imageUrl} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="/images/product.png" /></label><div className="variant-editor"><div className="variant-editor-heading"><div><span className="eyebrow muted">VARIANTS</span><h3>Varian, harga & stok</h3></div><button type="button" className="text-link" onClick={() => setForm((current) => ({ ...current, variants: [...current.variants, { name: '', price: 0, stock: 0 }] }))}><Plus size={14} /> Tambah varian</button></div>{form.variants.map((variant, index) => <div className="variant-edit-row" key={variant.id ?? `new-${index}`}><label>Nama varian<input required value={variant.name} onChange={(event) => updateVariant(index, 'name', event.target.value)} placeholder="Almond" /></label><label>Harga (Rp)<input required type="number" min="0" step="1000" value={variant.price} onChange={(event) => updateVariant(index, 'price', event.target.value)} /></label><label>Stok<input required type="number" min="0" step="1" value={variant.stock} onChange={(event) => updateVariant(index, 'stock', event.target.value)} /></label><button type="button" className="remove-variant" disabled={form.variants.length < 2} onClick={() => setForm((current) => ({ ...current, variants: current.variants.filter((_, position) => position !== index) }))} aria-label={`Hapus varian ${variant.name || index + 1}`}><X size={15} /></button></div>)}</div><div className="modal-footer"><button type="button" className="secondary-button" onClick={() => setDialogOpen(false)} disabled={busy}>Batal</button><button className="primary-button" disabled={busy}><Save size={15} />{busy ? 'Menyimpan...' : 'Simpan produk'}</button></div></form></section></div>}
  </main>
}
