import FavoriteButton from '../common/FavoriteButton'
import { ShoppingCart, Share2, ArchiveRestore, Trash2 } from 'lucide-react'
import { formatPrice, truncate } from '../../utils/helpers'

/**
 * Product card used in the catalog grid.
 *
 * @param {Object}   props
 * @param {Object}   props.gun       — product data
 * @param {Function} props.onSelect  — called with the gun when clicked
 * @param {Function} [props.onEdit]  — called when Edit is clicked (admin)
 * @param {Function} [props.onDelete]— called when Delete is clicked (admin)
 */
export default function GunCard({ gun, onSelect, onEdit, onDelete, onCart, archived, onRestore, onPermanentDelete }) {
  const imgSrc = (gun.images?.[0] || gun.image_url || gun.image || '/guns/pistol.svg')
  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0

  return (
    <li className="card">
      <button
        type="button"
        className="card-btn"
        onClick={() => onSelect(gun)}
        aria-label={`View ${gun.name}`}
      >
        <img
          className="card-img"
          src={imgSrc}
          alt={gun.name}
          width="240"
          height="180"
          loading="lazy"
        />

        <span className="name display">{gun.name}</span>

        <span className="type">
          {category}
          {caliber ? ` · ${caliber}` : ''}
        </span>

        {gun.description && (
          <span className="card-desc">{truncate(gun.description, 72)}</span>
        )}

        <span className="price">{formatPrice(price)}</span>
      </button>

      {/* Floating actions row */}
      <div className="card-actions">
        <FavoriteButton gunId={gun.id || gun.name} />
        {onCart && <button type="button" className="card-act-btn" title="Add to cart" onClick={() => onCart(gun)}><ShoppingCart size={16}/></button>}
        <button type="button" className="card-act-btn" title="Share unique link" onClick={() => { const url = new URL(window.location.href); url.searchParams.set('gun', gun.id); navigator.clipboard?.writeText(url.toString()); alert('Unique product link copied') }}><Share2 size={16}/></button>
        {archived && <><button type="button" className="card-act-btn" onClick={onRestore} title="Restore"><ArchiveRestore size={16}/></button><button type="button" className="card-act-btn card-act-btn--danger" onClick={onPermanentDelete} title="Delete permanently"><Trash2 size={16}/></button></>}

        {onEdit && (
          <button
            type="button"
            className="card-act-btn"
            onClick={(e) => { e.stopPropagation(); onEdit(gun) }}
            aria-label={`Edit ${gun.name}`}
            title="Edit"
          >
            ✏️
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            className="card-act-btn card-act-btn--danger"
            onClick={(e) => { e.stopPropagation(); onDelete(gun) }}
            aria-label={`Delete ${gun.name}`}
            title="Delete"
          >
            🗑️
          </button>
        )}
      </div>
    </li>
  )
}
