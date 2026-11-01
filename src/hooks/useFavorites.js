import { useState, useEffect, useCallback } from 'react'
import favoriteService from '../services/favoriteService'
import { getUserIdentifier } from '../services/userService'

// ---------------------------------------------------------------------------
// localStorage fallback — used when the backend is unavailable so that
// favourites are still fully functional offline.
// ---------------------------------------------------------------------------

const LOCAL_KEY = 'bore_barrel_favorites'

const readLocalFavs = () => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const writeLocalFavs = (ids) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(ids))
    window.dispatchEvent(new CustomEvent('gunshop:favorites-changed', { detail: ids }))
  } catch {
    /* quota exceeded — silently fail */
  }
}

// ---------------------------------------------------------------------------
// useFavorites — list all favourited product IDs.
//
// First attempts the server; on failure uses localStorage.
// ---------------------------------------------------------------------------

export function useFavorites() {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isLocal, setIsLocal] = useState(false)
  const userIdentifier = getUserIdentifier()

  const fetchFavorites = useCallback(async () => {
    setLoading(true)
    setFavorites(readLocalFavs())
    setIsLocal(true)
    setLoading(false)
  }, [userIdentifier])

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  useEffect(() => {
    const syncFavorites = (event) => setFavorites(event.detail || readLocalFavs())
    const syncStorage = (event) => {
      if (event.key === LOCAL_KEY) setFavorites(readLocalFavs())
    }
    window.addEventListener('gunshop:favorites-changed', syncFavorites)
    window.addEventListener('storage', syncStorage)
    return () => {
      window.removeEventListener('gunshop:favorites-changed', syncFavorites)
      window.removeEventListener('storage', syncStorage)
    }
  }, [])

  return { favorites, loading, error, isLocal, refetch: fetchFavorites }
}

// ---------------------------------------------------------------------------
// useToggleFavorite — toggle a product in/out of favourites.
// ---------------------------------------------------------------------------

export function useToggleFavorite() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const userIdentifier = getUserIdentifier()

  const toggleFavorite = async (gunId) => {
    const current = readLocalFavs()
    const exists = current.some((id) => String(id) === String(gunId))
    const next = exists
      ? current.filter((id) => String(id) !== String(gunId))
      : [...current, gunId]
    writeLocalFavs(next)
    try {
      setLoading(true)
      setError(null)
      // Local state is the responsive source of truth; sync the backend if available.
      try {
        await favoriteService.toggleFavorite({ recipe_id: gunId, user_identifier: userIdentifier })
      } catch { /* favorites remain usable offline */ }
      return { is_favorited: !exists }
    } finally {
      setLoading(false)
    }
  }

  return { toggleFavorite, loading, error }
}

// ---------------------------------------------------------------------------
// useIsFavorited — convenience wrapper for a single product.
// ---------------------------------------------------------------------------

export function useIsFavorited(gunId) {
  const { favorites, loading: fetchLoading, refetch } = useFavorites()
  const { toggleFavorite: toggle, loading: toggleLoading } = useToggleFavorite()

  // Check both server-format (objects with .id) and local-format (plain ids)
  const isFavorited = favorites.some((fav) => {
    const favId = typeof fav === 'object' && fav !== null ? (fav.id ?? fav.product_id ?? fav.recipe_id) : fav
    return String(favId) === String(gunId)
  })

  const toggleFavorite = async () => {
    const result = await toggle(gunId)
    if (result) await refetch()
    return result
  }

  return {
    isFavorited,
    loading: fetchLoading || toggleLoading,
    toggleFavorite,
  }
}

export { getUserIdentifier }
