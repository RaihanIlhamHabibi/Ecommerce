'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import useSWR from 'swr'
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronDown, Flower2, LayoutGrid, Leaf, List, Minus, Plus, Search, ShoppingBag, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

type Variant = { id: string; name: string; price: number; stock: number }
type Product = { id: string; name: string; slug: string; description: string; category: string; imageUrl: string; skinType: string; variants: Variant[] }
type OrderItem = { productName: string; variantName: string; quantity: number; unitPrice: number; lineTotal: number }
type Order = { id: string; status: 'pending_payment' | 'paid' | 'cancelled'; total: number; createdAt: string; items: OrderItem[] }
type CartLine = { product: Product; variant: Variant; quantity: number }

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Data belum dapat dimuat.')
  return data
}
const formatPrice = (price: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price)
const startingPrice = (product: Product) => Math.min(...product.variants.map((variant) => variant.price))
const statusText = { pending_payment: 'Menunggu pembayaran', paid: 'Dibayar', cancelled: 'Dibatalkan' }
const PAGE_SIZE = 8

export function LumiereStore() {
  const { data: sessionData } = authClient.useSession()
  const user = sessionData?.user
  const { data: userProfile } = useSWR<{ role: 'admin' | 'buyer' }>(user ? '/api/me' : null, fetcher)
  const isAdmin = userProfile?.role === 'admin'
  const { data: products = [], error: productsError } = useSWR<Product[]>('/api/products', fetcher)
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
  const [cart, setCart] = useState<CartLine[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [view, setView] = useState<'shop' | 'orders'>('shop')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [priceFilter, setPriceFilter] = useState('all')
  const [skinTypeFilter, setSkinTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'name'>('featured')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const { data: orders = [], error: ordersError, mutate: mutateOrders } = useSWR<Order[]>(user && view === 'orders' ? '/api/orders' : null, fetcher)

  const categories = [...new Set(products.map((product) => product.category))].sort((a, b) => a.localeCompare(b, 'id'))
  const skinTypes = [...new Set(products.map((product) => product.skinType))].sort((a, b) => a.localeCompare(b, 'id'))
  const searchTerm = search.trim().toLocaleLowerCase('id')
  const filteredProducts = products.filter((product) => {
    const searchContent = `${product.name} ${product.description} ${product.category} ${product.skinType} ${product.variants.map((variant) => variant.name).join(' ')}`.toLocaleLowerCase('id')
    const price = startingPrice(product)
    const matchesPrice = priceFilter === 'all'
      || (priceFilter === 'under-80000' && price < 80000)
      || (priceFilter === '80000-120000' && price >= 80000 && price <= 120000)
      || (priceFilter === 'over-120000' && price > 120000)
    return searchContent.includes(searchTerm)
      && (categoryFilter === 'all' || product.category === categoryFilter)
      && matchesPrice
      && (skinTypeFilter === 'all' || product.skinType === skinTypeFilter)
  })
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price-asc') return startingPrice(a) - startingPrice(b)
    if (sortBy === 'price-desc') return startingPrice(b) - startingPrice(a)
    if (sortBy === 'name') return a.name.localeCompare(b.name, 'id')
    return 0
  })
  const pageCount = Math.max(1, Math.ceil(sortedProducts.length / PAGE_SIZE))
  const pageProducts = sortedProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const firstProductNumber = sortedProducts.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const lastProductNumber = Math.min(currentPage * PAGE_SIZE, sortedProducts.length)
  const subtotal = cart.reduce((sum, line) => sum + line.variant.price * line.quantity, 0)
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0)

  function addToCart(product: Product) {
    const variant = product.variants.find((item) => item.id === selectedVariants[product.id]) ?? product.variants[0]
    if (!variant || variant.stock < 1) return
    setCart((current) => {
      const existing = current.find((line) => line.variant.id === variant.id)
      if (existing) return current.map((line) => line.variant.id === variant.id ? { ...line, quantity: Math.min(line.quantity + 1, 99) } : line)
      return [...current, { product, variant, quantity: 1 }]
    })
    setNotice(`${product.name} · ${variant.name} ditambahkan ke keranjang.`)
    setCartOpen(true)
  }

  function changeQuantity(variantId: string, amount: number) {
    setCart((current) => current.flatMap((line) => {
      if (line.variant.id !== variantId) return [line]
      const quantity = Math.min(99, line.quantity + amount)
      return quantity < 1 ? [] : [{ ...line, quantity }]
    }))
  }

  async function checkout() {
    if (!user) {
      window.location.href = `/login?redirectTo=${encodeURIComponent('/?view=orders')}`
      return
    }
    setBusy(true)
    setNotice('')
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: cart.map((line) => ({ variantId: line.variant.id, quantity: line.quantity })) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Checkout belum berhasil.')
      setCart([])
      setCartOpen(false)
      setView('orders')
      await mutateOrders()
      setNotice('Pesanan berhasil dibuat. Stok akan diperbarui setelah pembayaran simulasi berhasil.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Checkout belum berhasil.')
    } finally {
      setBusy(false)
    }
  }

  async function updateOrder(orderId: string, action: 'pay' | 'cancel') {
    setBusy(true)
    setNotice('')
    try {
      const response = await fetch(`/api/orders/${orderId}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Status pesanan tidak dapat diperbarui.')
      await mutateOrders()
      setNotice(action === 'pay' ? 'Pembayaran berhasil disimulasikan.' : 'Pesanan berhasil dibatalkan.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Status pesanan tidak dapat diperbarui.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="store-shell">
      <div className="announcement">Ritual kecil, kulit terasa lebih tenang <span aria-hidden="true">·</span> Gratis ongkir mulai Rp250.000</div>
      <header className="site-header">
        <Link href="/" className="brand" aria-label="Lumière Skin, beranda"><span className="brand-mark"><Flower2 size={19} strokeWidth={1.6} /></span><span>LUMIÈRE<span className="brand-sub">SKIN</span></span></Link>
        <nav className="desktop-nav" aria-label="Navigasi utama">
          <button className={view === 'shop' ? 'nav-link active' : 'nav-link'} onClick={() => setView('shop')}>Belanja</button>
          <a className="nav-link" href="#cerita">Cerita kami</a>
          {user && <button className={view === 'orders' ? 'nav-link active' : 'nav-link'} onClick={() => setView('orders')}>Pesanan</button>}
          {isAdmin && <Link className="nav-link" href="/admin">Admin</Link>}
        </nav>
        <div className="header-actions">
          {user ? <><span className="user-greeting"><span className="user-greeting-name">Hai, {user.name?.trim() || user.email}</span>{userProfile?.role && <span className={`role-badge role-${userProfile.role}`}>{userProfile.role === 'admin' ? 'Admin' : 'Pembeli'}</span>}</span><button className="icon-button signout-button" onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => { window.location.href = '/' } } })} aria-label="Keluar">Keluar</button></> : <Link className="login-link" href="/login">Masuk</Link>}
          <button className="bag-button" onClick={() => setCartOpen(true)} aria-label={`Buka keranjang, ${itemCount} item`}><ShoppingBag size={19} strokeWidth={1.7} /><span>Keranjang</span>{itemCount > 0 && <b>{itemCount}</b>}</button>
        </div>
      </header>

      {view === 'shop' ? <>
        <section className="hero-section">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={14} /> SKINCARE, WITH A SOFTER TOUCH</span>
            <h1>Rawat kulitmu,<br /><em>pelan-pelan.</em></h1>
            <p>Formula yang terasa baik, aroma yang menenangkan, dan ritual sederhana untuk kembali dekat dengan diri sendiri.</p>
            <a className="primary-button hero-button" href="#koleksi">Tentukan pilihanmu <ArrowRight size={17} /></a>
            <div className="hero-proof"><span className="proof-icon"><Leaf size={16} /></span><span>Diracik dengan bahan pilihan<br /><strong>lembut untuk keseharian</strong></span></div>
          </div>
          <div className="hero-image-wrap"><Image src="/images/hero-skincare.png" alt="Rangkaian skincare Lumière dengan nuansa sage dan ivory" fill priority sizes="(max-width: 760px) 100vw, 50vw" className="hero-image" /><div className="image-note"><span>01 / 03</span><span>Ritual harian, lebih mindful</span></div></div>
          <span className="hero-index">L / S</span>
        </section>

        <section className="trust-strip" aria-label="Keunggulan Lumière Skin"><div><span>01</span> Bahan pilihan</div><div><span>02</span> Dibuat dengan mindful</div><div><span>03</span> Aman untuk harian</div></section>

        <section className="collection-section" id="koleksi">
          <div className="catalog-intro">
            <div><span className="eyebrow muted">LUMIÈRE SKIN / THE COLLECTION</span><h2>Skincare <em>essentials.</em></h2><p>Formula lembut untuk ritual harian yang terasa lebih mindful.</p></div>
            <span className="catalog-total">{products.length} produk pilihan</span>
          </div>
          <div className="catalog-toolbar">
            <label className="catalog-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Cari produk</span><input value={search} onChange={(event) => { setSearch(event.target.value); setCurrentPage(1) }} placeholder="Cari produk atau kategori..." /></label>
            <div className="catalog-filters">
              <label className="catalog-filter"><span className="sr-only">Filter kategori</span><select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setCurrentPage(1) }}><option value="all">Semua kategori</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></label>
              <label className="catalog-filter"><span className="sr-only">Filter harga</span><select value={priceFilter} onChange={(event) => { setPriceFilter(event.target.value); setCurrentPage(1) }}><option value="all">Semua harga</option><option value="under-80000">Di bawah Rp80.000</option><option value="80000-120000">Rp80.000–Rp120.000</option><option value="over-120000">Di atas Rp120.000</option></select><ChevronDown size={14} aria-hidden="true" /></label>
              <label className="catalog-filter"><span className="sr-only">Filter jenis kulit</span><select value={skinTypeFilter} onChange={(event) => { setSkinTypeFilter(event.target.value); setCurrentPage(1) }}><option value="all">Semua jenis kulit</option>{skinTypes.map((skinType) => <option key={skinType} value={skinType}>{skinType}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></label>
            </div>
          </div>
          <div className="catalog-meta">
            <span className="catalog-result-count"><SlidersHorizontal size={14} /> Menampilkan {firstProductNumber}–{lastProductNumber} dari {sortedProducts.length} produk</span>
            <div className="catalog-sort-view">
              <label className="sort-control"><span>Urutkan:</span><select value={sortBy} onChange={(event) => { setSortBy(event.target.value as typeof sortBy); setCurrentPage(1) }}><option value="featured">Unggulan</option><option value="price-asc">Harga terendah</option><option value="price-desc">Harga tertinggi</option><option value="name">Nama A–Z</option></select><ChevronDown size={14} aria-hidden="true" /></label>
              <div className="view-toggle" role="group" aria-label="Mode tampilan katalog"><button type="button" className={viewMode === 'grid' ? 'selected' : ''} onClick={() => setViewMode('grid')} aria-label="Tampilan grid" aria-pressed={viewMode === 'grid'}><LayoutGrid size={16} /></button><button type="button" className={viewMode === 'list' ? 'selected' : ''} onClick={() => setViewMode('list')} aria-label="Tampilan list" aria-pressed={viewMode === 'list'}><List size={16} /></button></div>
            </div>
          </div>
          {notice && <div className="notice" role="status"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Tutup pesan"><X size={15} /></button></div>}
          {productsError ? <div className="empty-state">Katalog belum dapat dimuat. Coba segarkan halaman.</div> : pageProducts.length === 0 ? <div className="empty-state">Belum ada produk untuk filter ini.</div> : <div className={`product-grid ${viewMode === 'list' ? 'product-list' : ''}`}>
            {pageProducts.map((product, index) => {
              const selected = product.variants.find((variant) => variant.id === selectedVariants[product.id]) ?? product.variants[0]
              return <article className="product-card" key={product.id}>
                <div className={`product-image product-tone-${index % 3}`}><Image src={product.imageUrl} alt={`${product.name} skincare`} fill sizes="(max-width: 620px) 50vw, (max-width: 1000px) 33vw, 25vw" /><span className="product-category">{product.category}</span><span className="product-skin-badge">{product.skinType}</span><button className="quick-add" onClick={() => addToCart(product)} aria-label={`Tambahkan ${product.name} ke keranjang`}><Plus size={18} /></button></div>
                <div className="product-info"><div className="product-title-row"><h3>{product.name}</h3>{selected && <span>{formatPrice(selected.price)}</span>}</div><p>{product.description}</p><div className="product-controls"><label><span className="sr-only">Pilih varian {product.name}</span><select value={selected?.id ?? ''} onChange={(event) => setSelectedVariants((current) => ({ ...current, [product.id]: event.target.value }))}>{product.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name} · {variant.stock > 0 ? `${variant.stock} tersedia` : 'Habis'}</option>)}</select><ChevronDown size={14} /></label><button onClick={() => addToCart(product)} disabled={!selected || selected.stock < 1}>Tambah <ArrowRight size={15} /></button></div></div>
              </article>
            })}
          </div>}
          {sortedProducts.length > 0 && <nav className="product-pagination" aria-label="Halaman katalog"><span>Halaman {currentPage} dari {pageCount}</span><div className="pagination-controls"><button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} aria-label="Halaman sebelumnya"><ArrowLeft size={15} /></button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <button type="button" key={page} className={currentPage === page ? 'active' : ''} aria-current={currentPage === page ? 'page' : undefined} onClick={() => setCurrentPage(page)} aria-label={`Halaman ${page}`}>{page}</button>)}<button type="button" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount} aria-label="Halaman selanjutnya"><ArrowRight size={15} /></button></div></nav>}
        </section>

        <section className="story-section" id="cerita"><div className="story-decoration"><Flower2 size={38} strokeWidth={1} /></div><span className="eyebrow muted">A LITTLE NOTE FROM US</span><h2>Merawat diri tidak harus<br /><em>terasa rumit.</em></h2><p>Kami percaya kulit yang sehat berawal dari kebiasaan yang terasa nyaman. Lumière hadir dengan formula yang thoughtful, aroma yang lembut, dan langkah perawatan yang sederhana.</p><a href="#koleksi" className="text-link">Kenali koleksi kami <ArrowRight size={15} /></a></section>
      </> : <section className="orders-section"><div className="orders-heading"><span className="eyebrow muted">ACCOUNT / ORDER HISTORY</span><h1>Pesanan <em>kamu.</em></h1><p>Pantau status pesanan dan lanjutkan pembayaran simulasi.</p></div>{ordersError ? <div className="notice error">{ordersError.message}</div> : orders.length === 0 ? <div className="empty-state"><ShoppingBag size={27} /><h2>Belum ada pesanan</h2><p>Produk pilihanmu akan muncul di sini setelah checkout.</p><button className="primary-button" onClick={() => setView('shop')}>Mulai belanja <ArrowRight size={16} /></button></div> : <div className="order-list">{orders.map((order) => <article className="order-card" key={order.id}><div className="order-head"><div><span className="order-number">PESANAN / {order.id.slice(0, 8).toUpperCase()}</span><time>{new Date(order.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</time></div><span className={`status-pill status-${order.status}`}>{statusText[order.status]}</span></div><div className="order-lines">{order.items.map((item, index) => <div className="order-line" key={`${order.id}-${index}`}><span>{item.productName} <small>· {item.variantName} × {item.quantity}</small></span><strong>{formatPrice(item.lineTotal)}</strong></div>)}</div><div className="order-total"><span>Total pesanan</span><strong>{formatPrice(order.total)}</strong></div>{order.status === 'pending_payment' && <div className="order-actions"><button className="secondary-button" disabled={busy} onClick={() => updateOrder(order.id, 'cancel')}>Batalkan</button><button className="primary-button" disabled={busy} onClick={() => updateOrder(order.id, 'pay')}>{busy ? 'Memproses...' : 'Simulasi bayar berhasil'} <ArrowRight size={15} /></button></div>}</article>)}</div>}</section>}

      <footer className="site-footer"><Link href="/" className="brand"><span className="brand-mark"><Flower2 size={18} /></span><span>LUMIÈRE<span className="brand-sub">SKIN</span></span></Link><p>Softly made for your everyday.</p><span>© 2026 Lumière Skin Official</span></footer>

      {cartOpen && <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false) }}><section className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title"><div className="drawer-header"><div><span className="eyebrow muted">YOUR EDIT</span><h2 id="cart-title">Keranjang <em>kamu.</em></h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Tutup keranjang"><X size={21} /></button></div>{cart.length === 0 ? <div className="cart-empty"><ShoppingBag size={28} /><p>Keranjangmu masih kosong.</p><button className="text-link" onClick={() => setCartOpen(false)}>Lihat koleksi <ArrowRight size={15} /></button></div> : <><div className="cart-lines">{cart.map((line) => <div className="cart-line" key={line.variant.id}><div className="cart-thumb"><Image src={line.product.imageUrl} alt="" fill sizes="70px" /></div><div className="cart-line-details"><strong>{line.product.name}</strong><span>{line.variant.name}</span><b>{formatPrice(line.variant.price)}</b><div className="quantity-control"><button onClick={() => changeQuantity(line.variant.id, -1)} aria-label={`Kurangi jumlah ${line.product.name}`}><Minus size={13} /></button><span>{line.quantity}</span><button onClick={() => changeQuantity(line.variant.id, 1)} aria-label={`Tambah jumlah ${line.product.name}`}><Plus size={13} /></button></div></div><button className="remove-line" onClick={() => setCart((current) => current.filter((item) => item.variant.id !== line.variant.id))} aria-label={`Hapus ${line.product.name}`}><X size={15} /></button></div>)}</div><div className="cart-summary"><p><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></p><small>Ongkir dihitung setelah pesanan diproses.</small><button className="primary-button checkout-button" disabled={busy} onClick={checkout}>{busy ? 'Memproses...' : 'Buat pesanan'} <ArrowRight size={16} /></button><button className="continue-link" onClick={() => setCartOpen(false)}>Lanjut belanja</button></div></>}</section></div>}
      <a className="back-top" href="#" aria-label="Kembali ke atas"><ArrowDown size={14} /></a>
    </main>
  )
}
