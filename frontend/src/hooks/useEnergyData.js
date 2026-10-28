import { useState, useEffect, useCallback } from 'react'

/**
 * Generic data-fetching hook with loading/error state.
 *
 * @param {Function} fetcher  - Async function that returns data
 * @param {Array}    deps     - Dependency array (re-fetches when changed)
 *
 * Returns { data, loading, error, hint, refetch }
 *   error  — string message
 *   hint   — optional CLI hint from 503 responses (e.g. "Run spark_runner.py ...")
 */
export function useEnergyData(fetcher, deps = []) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)   // string
  const [hint,    setHint]    = useState(null)   // string | null

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    setHint(null)
    try {
      const result = await fetcher()
      setData(result)
    } catch (err) {
      setError(err.message || 'Failed to fetch data')
      setHint(err.hint || null)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, hint, refetch: fetch }
}
