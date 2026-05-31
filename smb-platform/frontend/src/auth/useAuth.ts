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
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('access_token'),

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('access_token', data.access_token)
    set({ token: data.access_token, user: data.user })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    set({ token: null, user: null })
  },
}))
