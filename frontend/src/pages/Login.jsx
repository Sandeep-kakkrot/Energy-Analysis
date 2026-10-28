import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, AlertCircle, Sun, Moon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import IntroSequence from '../components/intro/IntroSequence'

export default function Login() {
  const { login, isLoading, user } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const [username,  setUsername]  = useState('')
  const [password,  setPassword]  = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [error,     setError]     = useState(null)
  const [busy,      setBusy]      = useState(false)
  const [replayKey, setReplayKey] = useState(0)

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password) { setError('Please enter both username and password.'); return }
    setBusy(true); setError(null)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Login failed.')
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--border-color)', borderTopColor: 'var(--accent)', animation: 'spin 0.75s linear infinite' }} />
      </div>
    )
  }

  /* ─────────────────────────────────────────────
     Theme-aware design tokens
  ───────────────────────────────────────────── */
  const T = isDark ? {
    /* ── DARK (unchanged) ── */
    cardBg:        'transparent',
    cardBorder:    'rgba(0,196,167,0.18)',
    cardShadow:    'none',
    headingColor:  '#00c4a7',            // accent teal
    labelColor:    '#00c4a7',            // accent teal
    inputBg:       'rgba(0,0,0,0.35)',
    inputBorder:   'rgba(255,255,255,0.10)',
    inputColor:    '#e5e7eb',
    inputPH:       'rgba(100,116,139,0.8)',
    eyeColor:      'rgba(156,163,175,0.7)',
    divider:       'rgba(0,196,167,0.15)',
    stripeGrad:    'linear-gradient(90deg, transparent, #00c4a7, transparent)',
    btnBg:         'linear-gradient(135deg, #00c4a7 0%, #00a896 100%)',
    btnBgBusy:     'rgba(0,196,167,0.15)',
    btnGlow:       '0 0 24px rgba(0,196,167,0.45)',
    btnGlowHover:  '0 0 38px rgba(0,196,167,0.7)',
    errBg:         'rgba(239,68,68,0.10)',
    errBorder:     'rgba(239,68,68,0.28)',
    errColor:      '#f87171',
    focusBorder:   '#00c4a7',
    focusShadow:   '0 0 0 3px rgba(0,196,167,0.15)',
    blurOnBlur:    'rgba(255,255,255,0.10)',
  } : {
    /* ── LIGHT — spectacular deep-teal treatment ── */
    cardBg:        'rgba(0,90,80,0.22)',                 // deep teal wash, barely there
    cardBorder:    'rgba(0,196,167,0.55)',
    cardShadow:    '0 8px 48px rgba(0,150,130,0.28), 0 0 0 1px rgba(0,196,167,0.18)',
    headingColor:  '#006B5E',                            // deep teal for max contrast on light bg
    labelColor:    '#007B6E',
    inputBg:       'rgba(0,196,167,0.07)',
    inputBorder:   'rgba(0,196,167,0.30)',
    inputColor:    '#064E45',
    inputPH:       'rgba(0,100,88,0.45)',
    eyeColor:      'rgba(0,130,115,0.6)',
    divider:       'rgba(0,196,167,0.30)',
    stripeGrad:    'linear-gradient(90deg, transparent, #00c4a7, #00e6d0, #00c4a7, transparent)',
    btnBg:         'linear-gradient(135deg, #00c4a7 0%, #009688 100%)',
    btnBgBusy:     'rgba(0,196,167,0.18)',
    btnGlow:       '0 4px 28px rgba(0,150,130,0.55)',
    btnGlowHover:  '0 4px 44px rgba(0,196,167,0.80)',
    errBg:         'rgba(239,68,68,0.08)',
    errBorder:     'rgba(239,68,68,0.30)',
    errColor:      '#c0392b',
    focusBorder:   '#00c4a7',
    focusShadow:   '0 0 0 3px rgba(0,196,167,0.20)',
    blurOnBlur:    'rgba(0,196,167,0.30)',
  }

  const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    fontSize: 13,
    background: T.inputBg,
    border: `1px solid ${T.inputBorder}`,
    color: T.inputColor,
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  }

  return (
    <div
      className={isDark ? '' : 'light-theme'}
      style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}
    >
      {/* ── Top-right controls ── */}
      <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 10001, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          id="btn-replay-intro"
          onClick={() => setReplayKey(k => k + 1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 12px', borderRadius: 10, fontSize: 11,
            fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            background: 'rgba(0,196,167,0.15)', border: '1px solid rgba(0,196,167,0.3)',
            color: 'var(--accent)', backdropFilter: 'blur(12px)', cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          title="Replay intro"
        >
          ↺ <span>Replay</span>
        </button>

        <button
          id="btn-login-theme-toggle"
          onClick={toggleTheme}
          style={{
            padding: '8px 10px', borderRadius: 10,
            background: 'rgba(0,196,167,0.15)', border: '1px solid rgba(0,196,167,0.3)',
            color: 'var(--accent)', backdropFilter: 'blur(12px)', cursor: 'pointer',
            transition: 'all 0.2s', display: 'flex', alignItems: 'center',
          }}
          title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>

      <IntroSequence key={replayKey}>

        <div style={{ width: '100%', maxWidth: 360, padding: '0 16px', boxSizing: 'border-box' }}>

          {/* ── Card ── */}
          <div style={{
            background:           T.cardBg,
            border:               `1px solid ${T.cardBorder}`,
            borderRadius:         16,
            overflow:             'hidden',
            boxShadow:            T.cardShadow,
            backdropFilter:       isDark ? 'none' : 'blur(20px)',
            WebkitBackdropFilter: isDark ? 'none' : 'blur(20px)',
          }}>

            {/* Teal stripe — thicker & more vivid in light mode */}
            <div style={{
              height:     isDark ? 3 : 4,
              background: T.stripeGrad,
            }} />

            {/* ── Extra ambient glow bar (light mode only) ── */}
            {!isDark && (
              <div style={{
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(0,230,208,0.4), transparent)',
              }} />
            )}

            <div style={{ padding: '28px 28px 30px' }}>

              {/* ── Heading ── */}
              <h1 style={{
                fontSize:      22,
                fontWeight:    800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color:         T.headingColor,
                marginBottom:  22,
                paddingBottom: 14,
                borderBottom:  `1px solid ${T.divider}`,
              }}>
                Sign In
              </h1>

              {/* ── Error ── */}
              {error && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', marginBottom: 16, borderRadius: 9, fontSize: 12,
                  background: T.errBg, border: `1px solid ${T.errBorder}`, color: T.errColor,
                }}>
                  <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* ── Form ── */}
              <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Username */}
                <div>
                  <label style={{
                    display: 'block', fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: T.labelColor, marginBottom: 6,
                  }}>
                    Username
                  </label>
                  <input
                    id="input-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin"
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = T.focusBorder; e.target.style.boxShadow = T.focusShadow }}
                    onBlur={e  => { e.target.style.borderColor = T.blurOnBlur;  e.target.style.boxShadow = 'none' }}
                  />
                </div>

                {/* Password */}
                <div>
                  <label style={{
                    display: 'block', fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: T.labelColor, marginBottom: 6,
                  }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="input-password"
                      type={showPw ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{ ...inputStyle, paddingRight: 42 }}
                      onFocus={e => { e.target.style.borderColor = T.focusBorder; e.target.style.boxShadow = T.focusShadow }}
                      onBlur={e  => { e.target.style.borderColor = T.blurOnBlur;  e.target.style.boxShadow = 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      tabIndex={-1}
                      style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: T.eyeColor, padding: 4,
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#00c4a7'}
                      onMouseLeave={e => e.currentTarget.style.color = T.eyeColor}
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  id="btn-login"
                  type="submit"
                  disabled={busy}
                  style={{
                    marginTop:     4,
                    width:         '100%',
                    display:       'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding:       '12px 20px',
                    borderRadius:  50,
                    fontSize:      12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                    background:    busy ? T.btnBgBusy : T.btnBg,
                    color:         busy ? 'rgba(156,163,175,0.7)' : '#fff',
                    border:        '1px solid',
                    borderColor:   busy ? 'rgba(0,196,167,0.2)' : '#00c4a7',
                    boxShadow:     'none',
                    opacity:       busy ? 0.6 : 1,
                    cursor:        busy ? 'not-allowed' : 'pointer',
                    transition:    'all 0.25s ease',
                  }}
                  onMouseEnter={e => { if (!busy) e.currentTarget.style.boxShadow = T.btnGlowHover }}
                  onMouseLeave={e => { if (!busy) e.currentTarget.style.boxShadow = 'none' }}
                >
                  {busy
                    ? <div style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', animation: 'ceiSpin 0.75s linear infinite' }} />
                    : <LogIn size={14} />
                  }
                  {busy ? 'Signing in…' : 'Sign In'}
                </button>
              </form>

            </div>
          </div>
        </div>

      </IntroSequence>
    </div>
  )
}
