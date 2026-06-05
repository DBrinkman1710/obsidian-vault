import { create } from 'zustand'
import { api } from '../api/client'

interface User {
  id: string
  email: string
  full_name: string
  role: string
  tenant_id: string
}

interface AuthState {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const storedUser = localStorage.getItem('auth_user')

export const useAuth = create<AuthState>((set) => ({
  user: storedUser ? JSON.parse(storedUser) : null,
  token: localStorage.getItem('access_token'),

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('auth_user', JSON.stringify(data.user))
    set({ token: data.access_token, user: data.user })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('auth_user')
    set({ token: null, user: null })
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
}))
