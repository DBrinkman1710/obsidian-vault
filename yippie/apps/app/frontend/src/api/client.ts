import axios from 'axios'

export const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

api.interceptors.response.use(
  (r: any) => r,
  (err: any) => {
    // A 401 from an /auth/ endpoint is the outcome of the call itself (wrong
    // password, expired reset token, ...) — redirecting would reload the page
    // and wipe the error message before the user sees it. Only session-expiry
    // 401s on other endpoints should bounce to /login.
    const isAuthEndpoint = String(err.config?.url ?? '').includes('/auth/')
    const onLoginPage = window.location.pathname === '/login'
    if (err.response?.status === 401 && !isAuthEndpoint && !onLoginPage) {
      localStorage.removeItem('auth_user')
      // Carry the current path through login so a session-expiry bounce still
      // returns the user to where they were, matching the deep-link handling
      // in App.tsx and LoginPage.tsx.
      const dest = window.location.pathname + window.location.search
      window.location.href = dest && dest !== '/' ? `/login?next=${encodeURIComponent(dest)}` : '/login'
    }
    return Promise.reject(err)
  },
)
