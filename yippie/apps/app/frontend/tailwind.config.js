/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        yippie: '#5BA4F5',
        brand: {
          DEFAULT: '#5ba4f5',
          50: '#eef5fe',
          100: '#d7e9fd',
          200: '#b4d5fb',
          300: '#8fc0f8',
          400: '#6faef6',
          500: '#5ba4f5',
          600: '#3d8de8',
          700: '#2e74c9',
          deep: '#2e74c9',
        },
        ink: '#0f172a',
        dark: { DEFAULT: '#0b1120', 2: '#111a2e' },
        hairline: '#e7ebf0',
      },
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '22px',
      },
      animation: {
        'msg-enter': 'msg-enter 0.15s ease-out',
        'slide-in-right': 'slide-in-right 0.22s cubic-bezier(0.22,1,0.36,1)',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.22,1,0.36,1)',
        'pop-in': 'pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        // [UX-PSYCH] motion feedback on irreversible actions
        'card-exit': 'card-exit 0.32s cubic-bezier(0.4,0,1,1) forwards',
        'check-pulse': 'check-pulse 0.45s cubic-bezier(0.34,1.56,0.64,1)',
      },
      keyframes: {
        'msg-enter': {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // Card slides out to the right and fades — used when a ticket is
        // resolved or a mail is binned/spammed so the removal feels certain.
        'card-exit': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(48px)' },
        },
        // Green checkmark pulse shown on the card as it leaves.
        'check-pulse': {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '60%': { opacity: '1', transform: 'scale(1.25)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15,23,42,.03),0 2px 4px rgba(15,23,42,.04)',
        md: '0 2px 8px rgba(15,23,42,.04),0 6px 16px rgba(15,23,42,.06)',
        lg: '0 6px 16px rgba(15,23,42,.06),0 16px 32px rgba(15,23,42,.08)',
        '2xl': '0 12px 32px rgba(15,23,42,.12)',
        brand: '0 4px 16px rgba(91,164,245,.14)',
      },
      maxWidth: {
        container: '1180px',
      },
    },
  },
  plugins: [],
}
