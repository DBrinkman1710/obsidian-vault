import { createContext, lazy, Suspense, useContext, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { fetchTenantConfig, TenantConfig } from './api/tenant'
import { useAuth } from './auth/useAuth'
import { ModuleGate } from './shell/ModuleGate'
import { Sidebar } from './shell/Sidebar'

const ContactList   = lazy(() => import('./modules/contacts/pages/ContactList'))
const ContactDetail = lazy(() => import('./modules/contacts/pages/ContactDetail'))
const ContactNew    = lazy(() => import('./modules/contacts/pages/ContactNew'))
const TicketList    = lazy(() => import('./modules/tickets/pages/TicketList'))
const TicketDetail  = lazy(() => import('./modules/tickets/pages/TicketDetail'))
const TicketNew     = lazy(() => import('./modules/tickets/pages/TicketNew'))
const InboxQueue    = lazy(() => import('./modules/inbox/pages/InboxQueue'))
const DraftReview   = lazy(() => import('./modules/inbox/pages/DraftReview'))
const ChatPage      = lazy(() => import('./modules/chat/pages/ChatPage'))
const InvoiceList   = lazy(() => import('./modules/billing/pages/InvoiceList'))
const ActivityFeed  = lazy(() => import('./modules/activity/pages/ActivityFeed'))
const LoginPage          = lazy(() => import('./auth/LoginPage'))
const RegisterPage       = lazy(() => import('./auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./auth/ForgotPasswordPage'))
const ResetPasswordPage  = lazy(() => import('./auth/ResetPasswordPage'))
const TeamSettingsPage   = lazy(() => import('./modules/admin/pages/TeamSettingsPage'))
const DepartmentsPage          = lazy(() => import('./modules/admin/pages/DepartmentsPage'))
const SuperAdminPage           = lazy(() => import('./modules/admin/pages/SuperAdminPage'))
const SuperadminsSettingsPage  = lazy(() => import('./modules/admin/pages/SuperadminsSettingsPage'))
const ProfileSettingsPage      = lazy(() => import('./modules/admin/pages/ProfileSettingsPage'))

const TenantConfigContext = createContext<TenantConfig | null>(null)
export const useTenantConfig = () => useContext(TenantConfigContext)

function PagePad({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 h-full overflow-auto p-8">{children}</div>
}

export default function App() {
  const { token, refreshUser, impersonating, exitImpersonation } = useAuth()
  const [config, setConfig] = useState<TenantConfig | null>(null)
  const [configError, setConfigError] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    refreshUser()
    setConfigError(false)
    fetchTenantConfig()
      .then((cfg) => { if (!cancelled) setConfig(cfg) })
      .catch(() => { if (!cancelled) setConfigError(true) })
    return () => { cancelled = true }
  }, [token])

  if (!token) {
    return (
      <Suspense fallback={null}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    )
  }

  if (configError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-8 text-center">
        <div>
          <p className="text-slate-700 font-medium">Couldn’t load your workspace.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 rounded bg-slate-800 px-4 py-2 text-sm text-white"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <TenantConfigContext.Provider value={config}>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar />
        <main className="flex-1 overflow-hidden flex flex-col">
          {impersonating && (
            <div className="shrink-0 bg-amber-500 text-white text-xs font-semibold text-center py-1.5 px-4 flex items-center justify-center gap-3">
              <span>
                Viewing as {impersonating.tenantName} ({impersonating.userEmail})
              </span>
              <button
                onClick={() => exitImpersonation()}
                className="underline underline-offset-2 hover:text-amber-100"
              >
                Exit
              </button>
            </div>
          )}
          {config?.is_demo && (
            <div className="shrink-0 bg-amber-500 text-white text-xs font-semibold text-center py-1.5 px-4">
              Demo environment — data may be reset at any time. Contact support to go live.
            </div>
          )}
          <Suspense fallback={<div className="p-8 text-slate-400">Loading…</div>}>
            <Routes>
              <Route path="/" element={<Navigate to="/inbox" replace />} />

              <Route path="/contacts" element={
                <ModuleGate module="contacts"><PagePad><ContactList /></PagePad></ModuleGate>
              } />
              <Route path="/contacts/new" element={
                <ModuleGate module="contacts"><PagePad><ContactNew /></PagePad></ModuleGate>
              } />
              <Route path="/contacts/:id" element={
                <ModuleGate module="contacts"><PagePad><ContactDetail /></PagePad></ModuleGate>
              } />

              <Route path="/tickets" element={
                <ModuleGate module="tickets"><PagePad><TicketList /></PagePad></ModuleGate>
              } />
              <Route path="/tickets/new" element={
                <ModuleGate module="tickets"><PagePad><TicketNew /></PagePad></ModuleGate>
              } />
              <Route path="/tickets/:id" element={
                <ModuleGate module="tickets"><PagePad><TicketDetail /></PagePad></ModuleGate>
              } />

              {/* InboxQueue manages its own scroll layout — no PagePad wrapper */}
              <Route path="/inbox" element={
                <ModuleGate module="inbox"><InboxQueue /></ModuleGate>
              } />
              {/* DraftReview fills full height — no padding wrapper */}
              <Route path="/inbox/drafts/:id" element={
                <ModuleGate module="inbox"><DraftReview /></ModuleGate>
              } />

              <Route path="/chat" element={
                <ModuleGate module="chat"><PagePad><ChatPage /></PagePad></ModuleGate>
              } />

              <Route path="/billing" element={
                <ModuleGate module="billing"><PagePad><InvoiceList /></PagePad></ModuleGate>
              } />

              <Route path="/activity" element={
                <ModuleGate module="activity"><PagePad><ActivityFeed /></PagePad></ModuleGate>
              } />

              <Route path="/settings/departments" element={<PagePad><DepartmentsPage /></PagePad>} />
              <Route path="/settings/superadmins" element={<PagePad><SuperadminsSettingsPage /></PagePad>} />
              <Route path="/settings/profile" element={<PagePad><ProfileSettingsPage /></PagePad>} />
              <Route path="/settings/team" element={<PagePad><TeamSettingsPage /></PagePad>} />
              <Route path="/superadmin/clients" element={<PagePad><SuperAdminPage /></PagePad>} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </TenantConfigContext.Provider>
  )
}
