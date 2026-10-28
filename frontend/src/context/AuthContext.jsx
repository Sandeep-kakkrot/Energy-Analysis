import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as authApi from '../api/authApi'

/* ── Storage helpers ─────────────────────────────────────────── */
const STORAGE_KEY = 'campus_energy_auth'

function saveAuth(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
}
function loadAuth() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
}
function clearAuth() {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

/* ── Context ─────────────────────────────────────────────────── */
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [state, setState] = useState(() => {
    const stored = loadAuth()
    return stored || { user: null, accessToken: null, refreshToken: null }
  })
  const [loading, setLoading]   = useState(true)   // true while verifying stored token on boot
  const [error,   setError]     = useState(null)

  const navigate   = useNavigate()
  const refreshRef = useRef(null)  // timeout handle for silent refresh

  /* ── Verify stored token on mount ───────────────────────────── */
  useEffect(() => {
    const verify = async () => {
      const stored = loadAuth()
      if (!stored?.accessToken) { setLoading(false); return }

      try {
        const res = await authApi.getMe(stored.accessToken)
        setState({ ...stored, user: res.user })
      } catch {
        // Access token expired — try refresh
        if (stored.refreshToken) {
          try {
            const res = await authApi.refreshToken(stored.refreshToken)
            const next = {
              user:         res.user,
              accessToken:  res.access_token,
              refreshToken: res.refresh_token,
            }
            setState(next)
            saveAuth(next)
            scheduleRefresh(res.expires_in)
          } catch {
            // Refresh also failed — force logout
            clearAuth()
            setState({ user: null, accessToken: null, refreshToken: null })
          }
        } else {
          clearAuth()
          setState({ user: null, accessToken: null, refreshToken: null })
        }
      } finally {
        setLoading(false)
      }
    }
    verify()
    return () => clearTimeout(refreshRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Silent token refresh (fires 2 min before expiry) ───────── */
  const scheduleRefresh = useCallback((expiresInSeconds) => {
    clearTimeout(refreshRef.current)
    const delay = Math.max((expiresInSeconds - 120) * 1000, 30_000)
    refreshRef.current = setTimeout(async () => {
      const stored = loadAuth()
      if (!stored?.refreshToken) return
      try {
        const res  = await authApi.refreshToken(stored.refreshToken)
        const next = {
          user:         res.user,
          accessToken:  res.access_token,
          refreshToken: res.refresh_token,
        }
        setState(next)
        saveAuth(next)
        scheduleRefresh(res.expires_in)
      } catch {
        doLogout()
      }
    }, delay)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── login ───────────────────────────────────────────────────── */
  const doLogin = useCallback(async (username, password) => {
    setError(null)
    const res  = await authApi.login(username, password) // throws on 401
    const next = {
      user:         res.user,
      accessToken:  res.access_token,
      refreshToken: res.refresh_token,
    }
    setState(next)
    saveAuth(next)
    scheduleRefresh(res.expires_in)
    navigate('/', { replace: true })
  }, [navigate, scheduleRefresh])

  /* ── logout ──────────────────────────────────────────────────── */
  const doLogout = useCallback(async () => {
    const stored = loadAuth()
    clearTimeout(refreshRef.current)
    try {
      if (stored?.accessToken && stored?.refreshToken) {
        await authApi.logout(stored.accessToken, stored.refreshToken)
      }
    } catch {}
    clearAuth()
    sessionStorage.removeItem('cei_login_panel_shown') // reset so panel shows on next login
    setState({ user: null, accessToken: null, refreshToken: null })
    navigate('/login', { replace: true })
  }, [navigate])

  const value = {
    user:         state.user,
    accessToken:  state.accessToken,
    role:         state.user?.role ?? null,
    isAdmin:      state.user?.role === 'admin',
    isLoading:    loading,
    error,
    login:        doLogin,
    logout:       doLogout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Hook — throws if used outside AuthProvider */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
