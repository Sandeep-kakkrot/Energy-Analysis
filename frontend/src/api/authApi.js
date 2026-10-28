import axios from 'axios'

const authApi = axios.create({
  baseURL: '/api/auth',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

/** POST /api/auth/login */
export const login = (username, password) =>
  authApi.post('/login', { username, password }).then(r => r.data)

/** POST /api/auth/refresh */
export const refreshToken = (refresh_token) =>
  authApi.post('/refresh', { refresh_token }).then(r => r.data)

/** POST /api/auth/logout */
export const logout = (access_token, refresh_token) =>
  authApi.post(
    '/logout',
    { refresh_token },
    { headers: { Authorization: `Bearer ${access_token}` } }
  ).then(r => r.data)

/** GET /api/auth/me */
export const getMe = (access_token) =>
  authApi.get('/me', {
    headers: { Authorization: `Bearer ${access_token}` },
  }).then(r => r.data)
