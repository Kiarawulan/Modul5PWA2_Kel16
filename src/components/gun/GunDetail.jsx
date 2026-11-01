import { useState } from 'react'
import { ArrowLeft, Star, Send, Loader, Share2, ShoppingCart, MessageCircle } from 'lucide-react'
import reviewService from '../../services/reviewService'
import FavoriteButton from '../common/FavoriteButton'
import { useReviews, useCreateReview } from '../../hooks/useReviews'
import { getUserIdentifier } from '../../services/userService'
import { formatPrice, averageRating } from '../../utils/helpers'

/**
 * Full-screen product detail view.
 *
 * @param {Object}   props
 * @param {Object}   props.gun       — product data
 * @param {Function} props.onBack    — return to catalog
 * @param {Function} [props.onEdit]  — navigate to edit page
 * @param {Function} [props.onDelete]— trigger delete flow
 */
export default function GunDetail({ gun, onBack, onEdit, onDelete }) {
  const images = gun.images?.length ? gun.images : [gun.image_url || gun.image || '/guns/pistol.svg']
  const [activeImage, setActiveImage] = useState(0)
  const imgSrc = images[activeImage] || images[0]
  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0

  // Reviews
  const { reviews, loading: reviewsLoading, refetch: refetchReviews } = useReviews(gun.id)
  const { createReview, loading: submitting } = useCreateReview()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')
  const [editingReview, setEditingReview] = useState(null)
  const [votes, setVotes] = useState(() => JSON.parse(localStorage.getItem('gun_review_votes') || '{}'))

  const avgRating = gun.average_rating || averageRating(reviews)
  const reviewCount = gun.review_count ?? reviews.length

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    setReviewError('')
    setReviewSuccess('')

    if (rating < 1 || rating > 5) {
      setReviewError('Rating must be between 1 and 5.')
      return
    }

    const reviewData = {
      user_identifier: getUserIdentifier(),
      rating,
      comment: comment.trim(),
    }
    const result = editingReview
      ? await reviewService.updateReview(editingReview.id, reviewData)
      : await createReview(gun.id, reviewData)

    if (result) {
      setReviewSuccess('Review submitted!')
      setComment('')
      setRating(5)
      setEditingReview(null)
      refetchReviews()
    } else {
      setReviewError('Could not submit review. The server may be unavailable.')
    }
  }

  return (
    <div className="detail">
      {/* Back button */}
      <button type="button" className="detail-back" onClick={onBack}>
        <ArrowLeft size={18} /> Back to Catalog
      </button>

      {/* Hero */}
      <div className="detail-hero">
        <div><img className="detail-img" src={imgSrc} alt={gun.name} loading="lazy" />{images.length > 1 && <div className="image-thumbnails">{images.map((src, i) => <button key={src+i} onClick={() => setActiveImage(i)} aria-label={`Image ${i+1}`}><img src={src} loading="lazy" /></button>)}</div>}</div>
        <div className="detail-info">
          <h1 className="display">{gun.name}</h1>
          <p className="type">
            {category}
            {caliber ? ` · ${caliber}` : ''}
          </p>
          <p className="price detail-price">{formatPrice(price)}</p>

          {avgRating > 0 && (
            <p className="detail-rating">
              <Star size={16} fill="var(--brass)" stroke="var(--brass)" />
              {avgRating.toFixed(1)} ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
            </p>
          )}

          <div className="detail-actions">
            <FavoriteButton gunId={gun.id || gun.name} />
            <button type="button" className="btn btn--outline" onClick={() => { const url = new URL(window.location.href); url.searchParams.set('gun', gun.id); navigator.clipboard?.writeText(url.toString()); alert('Unique product link copied') }}><Share2 size={16}/> Share</button>
            <button type="button" className="btn btn--outline" onClick={() => { const items=JSON.parse(localStorage.getItem('gunshop_cart')||'[]'); if(!items.some((i)=>i.id===gun.id)){items.push(gun);localStorage.setItem('gunshop_cart',JSON.stringify(items));alert('Added to cart')} }}><ShoppingCart size={16}/> Add to cart</button>
            <a className="btn btn--primary" href={`https://wa.me/${(localStorage.getItem('gunshop_whatsapp')||'15550100100').replace(/\D/g,'')}?text=${encodeURIComponent(`Hi aku mau pesan ${gun.name}`)}`} target="_blank" rel="noreferrer"><MessageCircle size={16}/> Hubungi penjual</a>
            {onEdit && (
              <button type="button" className="btn btn--outline" onClick={() => onEdit(gun)}>
                Edit
              </button>
            )}
            {onDelete && (
              <button type="button" className="btn btn--danger" onClick={() => onDelete(gun)}>
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <section className="detail-section">
        <h2>Description</h2>
        <p>{gun.description || 'No description available.'}</p>
      </section>

      {/* Specifications (from ingredients / steps if present) */}
      {gun.ingredients && gun.ingredients.length > 0 && (
        <section className="detail-section">
          <h2>Specifications</h2>
          <ul className="detail-specs">
            {gun.ingredients.map((ing, i) => (
              <li key={ing.id || i}>
                <strong>{ing.name}</strong> — {ing.quantity}
              </li>
            ))}
          </ul>
        </section>
      )}

      {gun.steps && gun.steps.length > 0 && (
        <section className="detail-section">
          <h2>Assembly / Maintenance Steps</h2>
          <ol className="detail-steps">
            {gun.steps.map((step, i) => (
              <li key={step.id || i}>
                {step.instruction || step}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Reviews Section */}
      <section className="detail-section">
        <h2>Reviews</h2>

        {/* Submit review */}
        <form className="review-form" onSubmit={handleSubmitReview}>
          <div className="review-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="star-btn"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                <Star
                  size={22}
                  fill={n <= rating ? 'var(--brass)' : 'none'}
                  stroke={n <= rating ? 'var(--brass)' : 'var(--steel)'}
                />
              </button>
            ))}
          </div>

          <textarea
            className="review-input"
            rows="3"
            placeholder="Write a short review (optional)…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
          />

          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || !gun.id}
          >
            {submitting ? (
              <><Loader size={16} className="spin" /> Submitting…</>
            ) : (
              <><Send size={16} /> {editingReview ? 'Update Review' : 'Submit Review'}</>
            )}
          </button>

          {reviewError && <p className="form-error">{reviewError}</p>}
          {reviewSuccess && <p className="form-success">{reviewSuccess}</p>}
          {!gun.id && (
            <p className="form-hint">
              Reviews require a server-generated product ID. This product is local-only.
            </p>
          )}
        </form>

        {/* Existing reviews */}
        {reviewsLoading ? (
          <p className="detail-loading">Loading reviews…</p>
        ) : reviews.length > 0 ? (
          <ul className="review-list">
            {reviews.map((rev) => (
              <li key={rev.id} className="review-item">
                <div className="review-head">
                  <span className="review-user">{rev.user_identifier || 'Anonymous'}</span>
                  <span className="review-stars-display">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={14}
                        fill={i < rev.rating ? 'var(--brass)' : 'none'}
                        stroke={i < rev.rating ? 'var(--brass)' : 'var(--line)'}
                      />
                    ))}
                  </span>
                </div>
                {rev.comment && <p className="review-comment">{rev.comment}</p>}
                <div className="review-actions"><button type="button" onClick={() => { const next={...votes,[rev.id]:votes[rev.id]==='up'?'':'up'};setVotes(next);localStorage.setItem('gun_review_votes',JSON.stringify(next)) }}>👍 {votes[rev.id]==='up'?'1':''}</button><button type="button" onClick={() => { const next={...votes,[rev.id]:votes[rev.id]==='down'?'':'down'};setVotes(next);localStorage.setItem('gun_review_votes',JSON.stringify(next)) }}>👎 {votes[rev.id]==='down'?'1':''}</button>{rev.user_identifier===getUserIdentifier() && <><button type="button" onClick={() => {setEditingReview(rev);setRating(rev.rating);setComment(rev.comment)}}>Edit</button><button type="button" onClick={async()=>{await reviewService.deleteReview(rev.id);refetchReviews()}}>Delete</button></>}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="detail-empty">No reviews yet. Be the first!</p>
        )}
      </section>
    </div>
  )
}
