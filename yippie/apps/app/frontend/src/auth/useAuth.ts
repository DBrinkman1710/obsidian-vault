import { create } from 'zustand'
import { api } from '../api/client'
import { queryClient } from '../main'

export interface User {
  id: string
  email: string
  full_name: string
  role: string
  tenant_id: string
  is_root_owner?: boolean
  reply_from_email?: string | null
  inbound_email?: string | null
  email_signature?: string | null
  hotkeys_enabled?: boolean
  shared_inbox_disabled?: boolean
  contact_column_prefs?: ContactColumnPref[] | null
  sidebar_order?: string[] | null
  send_from_aliases?: string[] | null
  tour_completed?: boolean
  setup_checklist_dismissed?: boolean
  ui_language?: string
  jarvis_prefs?: JarvisPrefs | null
  help_tips_enabled?: boolean
  // True while a passwordless signup still has its auto generated password —
  // App renders the mandatory SetPasswordModal until refreshUser clears it.
  needs_password?: boolean
}

export interface JarvisPrefs {
  hotkey_display?: string
  enabled_actions?: string[]
  // [YIP5] morning briefing
  briefing_enabled?: boolean
  briefing_time?: string // "HH:MM" tenant local time
}

export interface ContactColumnPref {
  key: string
  label: string
  visible: boolean
  order: number
}

interface Impersonation {
  tenantName: string
  userEmail: string
}

interface AuthState {
  user: User | null
  impersonating: Impersonation | null
  login: (email: string, password: string) => Promise<void>
  setSession: (user: User) => void
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  startImpersonation: (tenantId: string, tenantName: string, userEmail: string) => Promise<void>
  exitImpersonation: () => Promise<void>
}

const storedUser = localStorage.getItem('auth_user')
const storedImpersonation = sessionStorage.getItem('impersonation')

export const useAuth = create<AuthState>((set: any, get: any) => ({
  user: storedUser ? JSON.parse(storedUser) : null,
  impersonating: storedImpersonation ? JSON.parse(storedImpersonation) : null,

  login: async (email: any, password: any) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('auth_user', JSON.stringify(data.user))
    queryClient.clear()
    set({ user: data.user })
  },

  setSession: (user: any) => {
    localStorage.setItem('auth_user', JSON.stringify(user))
    set({ user })
  },

  logout: async () => {
    try { await api.post('/auth/logout') } catch { /* ignore */ }
    localStorage.removeItem('auth_user')
    sessionStorage.removeItem('impersonation')
    queryClient.clear()
    set({ user: null, impersonating: null })
  },

  // Also serves as the cold bootstrap from the httponly auth cookie (user may
  // be null): the signup entry link 302s into the SPA with only that cookie
  // set, so /?entry=1 calls this to hydrate localStorage + state the same way
  // login does. A 401 is swallowed — /auth/ endpoints are exempt from the
  // global 401 redirect interceptor, so an anonymous visitor just stays on /login.
  refreshUser: async () => {
    try {
      const { data } = await api.get('/auth/me')
      localStorage.setItem('auth_user', JSON.stringify(data))
      set({ user: data })
    } catch {
      // Silently fail — let the existing logout flow handle expired sessions
    }
  },

  startImpersonation: async (_tenantId: any, tenantName: any, userEmail: any) => {
    const imp = { tenantName, userEmail }
    sessionStorage.setItem('impersonation', JSON.stringify(imp))
    queryClient.clear()
    set({ impersonating: imp })
    await get().refreshUser()
  },

  exitImpersonation: async () => {
    try { await api.post('/admin/unimpersonate') } catch { /* ignore */ }
    sessionStorage.removeItem('impersonation')
    queryClient.clear()
    set({ impersonating: null })
    await get().refreshUser()
  },
}))
