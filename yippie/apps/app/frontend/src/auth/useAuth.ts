import { create } from 'zustand'
import { api } from '../api/client'

interface User {
  id: string
  email: string
  full_name: string
  role: string
  tenant_id: string
  reply_from_email?: string | null
}

interface Impersonation {
  tenantName: string
  userEmail: string
}

interface AuthState {
  user: User | null
  token: string | null
  impersonating: Impersonation | null
  login: (email: string, password: string) => Promise<void>
  setSession: (token: string, user: User) => void
  logout: () => void
  refreshUser: () => Promise<void>
  startImpersonation: (token: string, tenantName: string, userEmail: string) => Promise<void>
  exitImpersonation: () => Promise<void>
}

const storedUser = localStorage.getItem('auth_user')
const storedImpersonation = sessionStorage.getItem('impersonation')

export const useAuth = create<AuthState>((set, get) => ({
  user: storedUser ? JSON.parse(storedUser) : null,
  token: localStorage.getItem('access_token'),
  impersonating: storedImpersonation ? JSON.parse(storedImpersonation) : null,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('auth_user', JSON.stringify(data.user))
    set({ token: data.access_token, user: data.user })
  },

  setSession: (token, user) => {
    localStorage.setItem('access_token', token)
    localStorage.setItem('auth_user', JSON.stringify(user))
    set({ token, user })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('auth_user')
    sessionStorage.removeItem('superadmin_token')
    sessionStorage.removeItem('impersonation')
    set({ token: null, user: null, impersonating: null })
  },

  refreshUser: async () => {
    try {
      const { data } = await api.get('/auth/me')
      localStorage.setItem('auth_user', JSON.stringify(data))
      set({ user: data })
    } catch {
      // Silently fail — let the existing token/logout flow handle expired sessions
    }
  },

  startImpersonation: async (token, tenantName, userEmail) => {
    const current = localStorage.getItem('access_token')
    if (current) sessionStorage.setItem('superadmin_token', current)
    const imp = { tenantName, userEmail }
    sessionStorage.setItem('impersonation', JSON.stringify(imp))
    localStorage.setItem('access_token', token)
    set({ token, impersonating: imp })
    await get().refreshUser()
  },

  exitImpersonation: async () => {
    const original = sessionStorage.getItem('superadmin_token')
    sessionStorage.removeItem('superadmin_token')
    sessionStorage.removeItem('impersonation')
    if (!original) {
      get().logout()
      return
    }
    localStorage.setItem('access_token', original)
    set({ token: original, impersonating: null })
    await get().refreshUser()
  },
}))
