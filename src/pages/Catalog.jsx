import { useState, useMemo, useEffect } from 'react'
import { RefreshCw, Plus, Loader, AlertCircle, PackageOpen, ChevronLeft, ChevronRight, ShoppingCart, Share2, ArchiveRestore, Trash2 } from 'lucide-react'
import { useGuns, invalidateGunCache } from '../hooks/useGuns'
import GUNS_LOCAL from '../data/guns'
import GunCard from '../components/gun/GunCard'
import GunDetail from '../components/gun/GunDetail'
import AdvancedFilter from '../components/common/AdvancedFilter'
import ConfirmModal from '../components/modals/ConfirmModal'
import gunService from '../services/gunService'
import {
  matchesSearch,
  matchesCategory,
  sortItems,
  extractCategories,
  formatPrice,
} from '../utils/helpers'

/**
 * Catalog page — the main product listing.
 *
 * Data source priority:
 *   1. Live API via useGuns()
 *   2. Local static array (GUNS_LOCAL) when the API is unreachable
 *
 * Features: search, category filter, sort, CRUD actions, detail modal.
 */
export default function Catalog({ onNavigate }) {
  // ---- API data ----
  const { guns: apiGuns, loading, error, refetch } = useGuns({ limit: 200 })
  const [useLocal, setUseLocal] = useState(false)

  // Decide data source
  const rawGuns = useMemo(() => {
    if (useLocal || (error && apiGuns.length === 0)) {
      // Enrich local data with synthetic ids so FavoriteButton and detail work
      return GUNS_LOCAL.map((g, i) => ({ ...g, id: g.id || `local-${i}` }))
    }
    return apiGuns
  }, [apiGuns, error, useLocal])

  // ---- filters / sort ----
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [sortKey, setSortKey] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [page, setPage] = useState(1)
  const [cart, setCart] = useState(() => (JSON.parse(localStorage.getItem('gunshop_cart') || '[]')).map((item) => ({ ...item, quantity: Math.max(1, Number(item.quantity) || 1) })))
  const [showCart, setShowCart] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [archived, setArchived] = useState(() => JSON.parse(localStorage.getItem('gunshop_archived') || '[]'))
  const [pageSize, setPageSize] = useState(3)

  const categories = useMemo(() => extractCategories(rawGuns), [rawGuns])

  const filteredGuns = useMemo(() => {
    let result = rawGuns.filter((g) => showArchived ? archived.some((a) => String(a.id) === String(g.id)) : !archived.some((a) => String(a.id) === String(g.id)))
    result = result.filter(
      (g) => matchesSearch(g, search) && matchesCategory(g, activeCategory),
    )
    return sortItems(result, sortKey, sortOrder)
  }, [rawGuns, search, activeCategory, sortKey, sortOrder, showArchived, archived])
  const pageCount = Math.max(1, Math.ceil(filteredGuns.length / pageSize))
  useEffect(() => { setPage(1) }, [search, activeCategory, sortKey, sortOrder, showArchived, pageSize])
  const pageGuns = filteredGuns.slice((page - 1) * pageSize, page * pageSize)
  const setCartItems = (items) => { setCart(items); localStorage.setItem('gunshop_cart', JSON.stringify(items)) }
  const addToCart = (gun) => {
    const existing = cart.find((item) => String(item.id) === String(gun.id))
    setCartItems(existing
      ? cart.map((item) => String(item.id) === String(gun.id) ? { ...item, quantity: (Number(item.quantity) || 1) + 1 } : item)
      : [...cart, { ...gun, quantity: 1 }])
  }
  const updateCartQuantity = (id, quantity) => {
    const next = quantity <= 0
      ? cart.filter((item) => String(item.id) !== String(id))
      : cart.map((item) => String(item.id) === String(id) ? { ...item, quantity } : item)
    setCartItems(next)
  }
  const checkout = () => {
    if (!cart.length) return
    const message = `Hi aku mau pesan...\n${cart.map((g) => `- ${g.name} x${g.quantity} (${formatPrice((g.price ?? g.cook_time ?? 0) * g.quantity)})`).join('\n')}`
    const phone = localStorage.getItem('gunshop_whatsapp') || '15550100100'
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  // ---- detail view ----
  const [selectedGun, setSelectedGun] = useState(null)
  useEffect(() => {
    const gunId = new URLSearchParams(window.location.search).get('gun')
    if (gunId && rawGuns.length) setSelectedGun(rawGuns.find((g) => String(g.id) === gunId) || null)
  }, [rawGuns])

  // ---- delete ----
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [permanentTarget, setPermanentTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      setDeleteError('')
      const archivedItems = [...archived.filter((g) => String(g.id) !== String(deleteTarget.id)), deleteTarget]
      localStorage.setItem('gunshop_archived', JSON.stringify(archivedItems))
      setArchived(archivedItems)
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete.')
    } finally {
      setDeleting(false)
    }
  }

  const handlePermanentDelete = async () => {
    if (!permanentTarget) return
    try {
      setDeleting(true)
      if (!String(permanentTarget.id).startsWith('local-')) {
        await gunService.deleteGun(permanentTarget.id, { permanent: true })
      }
      const next = archived.filter((item) => String(item.id) !== String(permanentTarget.id))
      localStorage.setItem('gunshop_archived', JSON.stringify(next))
      setArchived(next)
      setPermanentTarget(null)
      invalidateGunCache()
      refetch()
    } catch (err) {
      setDeleteError(err.message || 'Gagal menghapus katalog secara permanen.')
    } finally {
      setDeleting(false)
    }
  }

  // ---- If viewing a single product detail ----
  if (selectedGun) {
    return (
      <GunDetail
        gun={selectedGun}
        onBack={() => setSelectedGun(null)}
        onEdit={(g) => onNavigate && onNavigate('Edit', g)}
        onDelete={(g) => { setSelectedGun(null); setDeleteTarget(g) }}
      />
    )
  }

  // ---- Main catalog view ----
  return (
    <>
      <section className="masthead">
        <h1 className="display">Hardware, by the spec sheet.</h1>
        <p className="lede">
          A small armory of pistols, rifles, and shotguns. Every piece listed
          with its type, caliber, and price — nothing else.
        </p>
      </section>

      <section>
        <div className="list-head">
          <h2>Current stock</h2>
          <div className="list-head-right">
            <span className="count">
              {filteredGuns.length} piece{filteredGuns.length !== 1 ? 's' : ''}
            </span>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Active catalog' : `Archive (${archived.length})`}</button>
            {!showArchived && <><button type="button" className="btn btn--outline btn--sm" onClick={() => setShowCart(true)}><ShoppingCart size={15}/> Keranjang ({cart.reduce((sum, item) => sum + item.quantity, 0)})</button><button type="button" className="btn btn--outline btn--sm" onClick={() => { const link = window.location.href; navigator.clipboard?.writeText(link); alert('Catalog link copied') }}><Share2 size={15}/> Share link</button></>}
            {onNavigate && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => onNavigate('Create')}
              >
                <Plus size={16} /> Add
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <AdvancedFilter
          search={search}
          onSearch={setSearch}
          categories={categories}
          activeCategory={activeCategory}
          onCategory={setActiveCategory}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={({ key, order }) => { setSortKey(key); setSortOrder(order) }}
        />

        {/* States */}
        {loading && (
          <div className="state-box">
            <Loader size={28} className="spin" />
            <p>Loading products…</p>
          </div>
        )}

        {!loading && error && !useLocal && (
          <div className="state-box state-box--error">
            <AlertCircle size={28} />
            <p>{error}</p>
            <div className="state-box__actions">
              <button type="button" className="btn btn--outline" onClick={refetch}>
                <RefreshCw size={16} /> Retry
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setUseLocal(true)}
              >
                View Local Catalog
              </button>
            </div>
          </div>
        )}

        {!loading && filteredGuns.length === 0 && !error && (
          <div className="state-box">
            <PackageOpen size={28} />
            <p>No products match your search.</p>
          </div>
        )}

        {/* Product grid */}
        {filteredGuns.length > 0 && (
          <ul className="stock">
            {pageGuns.map((gun) => (
              <GunCard
                key={gun.id || gun.name}
                gun={gun}
                onSelect={setSelectedGun}
                onEdit={!showArchived && onNavigate ? (g) => onNavigate('Edit', g) : undefined}
                onDelete={!showArchived ? setDeleteTarget : undefined}
                onCart={!showArchived ? () => addToCart(gun) : undefined}
                archived={showArchived}
                onRestore={() => { const next = archived.filter((a) => String(a.id) !== String(gun.id)); localStorage.setItem('gunshop_archived', JSON.stringify(next)); setArchived(next) }}
                onPermanentDelete={() => setPermanentTarget(gun)}
              />
            ))}
          </ul>
        )}
        <nav className="pagination" aria-label="Navigasi halaman katalog">
          <label className="pagination-size">Produk per halaman<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={3}>3</option><option value={6}>6</option></select></label>
          <button type="button" className="pagination-arrow" disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Halaman sebelumnya"><ChevronLeft size={18}/><span>Sebelumnya</span></button>
          <div className="pagination-pages">{Array.from({ length: pageCount }, (_, i) => i + 1).map((number) => <button type="button" key={number} className={`pagination-page ${page === number ? 'is-active' : ''}`} aria-current={page === number ? 'page' : undefined} onClick={() => setPage(number)}>{number}</button>)}</div>
          <button type="button" className="pagination-arrow" disabled={page === pageCount} onClick={() => setPage(page + 1)} aria-label="Halaman berikutnya"><span>Berikutnya</span><ChevronRight size={18}/></button>
        </nav>

        {useLocal && (
          <p className="local-notice">
            Showing local catalog (server unavailable).{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => { setUseLocal(false); refetch() }}
            >
              Retry server
            </button>
          </p>
        )}
      </section>

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Archive Product"
        message={`Arsipkan "${deleteTarget?.name}"? Item dapat dipulihkan kapan saja.`}
        confirmLabel="Archive"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setDeleteError('') }}
      />
      <ConfirmModal
        open={Boolean(permanentTarget)}
        title="Hapus Permanen"
        message={`Hapus "${permanentTarget?.name}" secara permanen? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Permanen"
        danger
        loading={deleting}
        onConfirm={handlePermanentDelete}
        onCancel={() => setPermanentTarget(null)}
      />
      {deleteError && (
        <div className="toast toast--error">{deleteError}</div>
      )}
      {showCart && <div className="cart-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setShowCart(false) }}><section className="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title"><div className="cart-header"><div><h2 id="cart-title">Keranjang</h2><p>{cart.reduce((sum, item) => sum + item.quantity, 0)} barang · {cart.length} produk</p></div><button type="button" className="cart-close" onClick={() => setShowCart(false)} aria-label="Tutup keranjang">×</button></div>{cart.length ? <ul className="cart-list">{cart.map((item) => <li key={item.id}><img src={item.images?.[0]||item.image_url||item.image||'/guns/pistol.svg'} alt="" loading="lazy"/><div className="cart-item-info"><strong>{item.name}</strong><span>{formatPrice((item.price ?? item.cook_time ?? 0) * item.quantity)}</span><div className="cart-quantity"><button type="button" aria-label={`Kurangi ${item.name}`} onClick={() => updateCartQuantity(item.id, item.quantity - 1)}>−</button><span>{item.quantity}</span><button type="button" aria-label={`Tambah ${item.name}`} onClick={() => updateCartQuantity(item.id, item.quantity + 1)}>+</button></div></div><button type="button" className="link-btn" onClick={() => updateCartQuantity(item.id, 0)}>Hapus</button></li>)}</ul> : <p className="cart-empty">Keranjang masih kosong. Tambahkan produk dari katalog.</p>}<div className="cart-footer"><button type="button" className="btn btn--outline" onClick={() => setShowCart(false)}>Lanjut lihat katalog</button><button type="button" className="btn btn--primary" disabled={!cart.length} onClick={checkout}>Checkout via WhatsApp</button></div></section></div>}
    </>
  )
}
