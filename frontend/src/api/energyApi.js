import axios from 'axios'

const STORAGE_KEY = 'campus_energy_auth'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

/* ── Request interceptor: inject Bearer token ─────────────── */
api.interceptors.request.use(config => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (stored?.accessToken) {
      config.headers.Authorization = `Bearer ${stored.accessToken}`
    }
  } catch {}

  // Strip headers explicitly set to `undefined` so per-request overrides
  // (e.g. 'Content-Type': undefined for FormData uploads) actually remove
  // the global default instead of sending the string "undefined".
  Object.keys(config.headers).forEach(key => {
    if (config.headers[key] === undefined) {
      delete config.headers[key]
    }
  })

  return config
})

/* ── Response interceptor ─────────────────────────────────── */
api.interceptors.response.use(
  // Unwrap data from { status, message, data } envelope
  (response) => response.data.data,
  (error) => {
    const resp = error.response
    const body = resp?.data || {}

    // 401 Unauthorized — token expired or missing → send to login
    if (resp?.status === 401) {
      localStorage.removeItem(STORAGE_KEY)
      // Only navigate if not already on login
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
      return Promise.reject(new Error('Session expired. Please log in again.'))
    }

    // Build a descriptive message, including CLI hint when available (503 case)
    let msg = body.message || body.error || error.message || 'Network error. Is the backend running?'
    const hint = body.details?.run_hint

    const err = new Error(msg)
    err.hint   = hint || null
    err.status = resp?.status || 0
    return Promise.reject(err)
  }
)

export const fetchDashboardSummary   = () => api.get('/dashboard/summary')
export const fetchBuildingComparison = () => api.get('/buildings/comparison')
export const fetchDailyTrends        = (days = 30) => api.get(`/trends/daily?days=${days}`)
export const fetchMonthlyTrends      = (year)      => api.get(`/trends/monthly${year ? `?year=${year}` : ''}`)
export const fetchPeakUsage          = () => api.get('/peaks/usage')
export const fetchWastageIndicators  = () => api.get('/wastage/indicators')
export const fetchHostelClosureConfig  = () => api.get('/wastage/hostel-closure')
export const updateHostelClosureConfig = (config) => api.post('/wastage/hostel-closure', config)
export const fetchHealth             = () => api.get('/health')

export default api
