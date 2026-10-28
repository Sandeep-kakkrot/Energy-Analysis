/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Background bases ────────────────────── */
        dark: {
          base:  '#020d14',
          '2':   '#031824',
          '3':   '#042030',
          '4':   '#0a2535',
          '5':   '#0d2e3f',
        },
        light: {
          base:  '#e8f5f3',
          '2':   '#f0faf8',
          '3':   '#f8fffe',
          '4':   '#ffffff',
        },
        /* ── Teal / Cyan accent — from image ─────── */
        teal: {
          50:  '#e0fff8',
          100: '#b3ffe9',
          200: '#7fffdb',
          300: '#4dffd1',
          400: '#00e5b8',   // light theme accent
          500: '#00c4a7',   // primary teal
          600: '#00a893',
          700: '#00897a',
          800: '#006b60',
          900: '#004d45',
        },
        /* ── Neon cyan for dark theme ────────────── */
        cyan: {
          50:  '#e0fffd',
          100: '#b3fefb',
          200: '#7dfff9',
          300: '#40fff5',
          400: '#00ffe8',
          500: '#00d4c2',   // dark theme primary
          600: '#00aaaa',
          700: '#008080',
          800: '#005555',
          900: '#002b2b',
        },
        /* ── Panel neutrals — dark & light ──────── */
        panel: {
          100: '#f5f5f5',
          200: '#e0e0e0',
          300: '#b0b0b0',
          400: '#606060',
          500: '#333333',
          600: '#1e2f38',
          700: '#122030',
          800: '#0a1a24',
          900: '#040e16',
        },
        /* ── Semantic ───────────────────────────── */
        success: { 400: '#4ade80', 500: '#22c55e' },
        warning: { 400: '#fbbf24', 500: '#f59e0b' },
        danger:  { 400: '#f87171', 500: '#ef4444' },
        brand: {
          300: '#7fffd0',
          400: '#00d4aa',
          500: '#00c4a7',
        },
        accent: {
          400: '#00e5b8',
          500: '#00c4a7',
        },
      },
      fontFamily: {
        sans:    ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'teal-glow':  '0 0 32px rgba(0,196,167,0.5)',
        'teal-sm':    '0 0 16px rgba(0,196,167,0.3)',
        'cyan-glow':  '0 0 40px rgba(0,212,193,0.6)',
        'card':       '0 4px 24px rgba(0,0,0,0.8)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.9)',
        'card-light': '0 4px 24px rgba(0,0,0,0.08)',
        'inner-teal': 'inset 0 0 30px rgba(0,196,167,0.06)',
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-up':   'slideUp 0.45s ease-out',
        'slide-in':   'slideIn 0.35s ease-out',
        'scale-in':   'scaleIn 0.3s cubic-bezier(.34,1.56,.64,1)',
        'shimmer':    'shimmer 1.8s infinite linear',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'dot-pulse':  'dotPulse 2s ease-in-out infinite',
        'float':      'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:   { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:  { '0%': { opacity: '0', transform: 'translateY(18px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideIn:  { '0%': { opacity: '0', transform: 'translateX(-16px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        scaleIn:  { '0%': { opacity: '0', transform: 'scale(0.9)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        shimmer:  { '0%': { backgroundPosition: '-600px 0' }, '100%': { backgroundPosition: '600px 0' } },
        glowPulse:{
          '0%, 100%': { boxShadow: '0 0 20px rgba(0,196,167,0.3)' },
          '50%':       { boxShadow: '0 0 55px rgba(0,212,193,0.7)' },
        },
        dotPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%':       { transform: 'scale(1.35)', opacity: '0.5' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-10px)' },
        },
      },
      screens: { xs: '480px' },
    },
  },
  plugins: [],
}
