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
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15,23,42,.04),0 1px 3px rgba(15,23,42,.06)',
        md: '0 4px 12px rgba(15,23,42,.06),0 12px 28px rgba(15,23,42,.08)',
        lg: '0 12px 24px rgba(15,23,42,.08),0 30px 60px rgba(15,23,42,.12)',
        '2xl': '0 25px 50px -12px rgba(15,23,42,.25)',
        brand: '0 10px 30px rgba(91,164,245,.22)',
      },
      maxWidth: {
        container: '1180px',
      },
    },
  },
  plugins: [],
}
