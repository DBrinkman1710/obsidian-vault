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
const LoginPage       = lazy(() => import('./auth/LoginPage'))
const DepartmentsPage = lazy(() => import('./modules/admin/pages/DepartmentsPage'))
const SuperAdminPage  = lazy(() => import('./modules/admin/pages/SuperAdminPage'))

const TenantConfigContext = createContext<TenantConfig | null>(null)
export const useTenantConfig = () => useContext(TenantConfigContext)

function PagePad({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 h-full overflow-auto p-8">{children}</div>
}

export default function App() {
  const { token } = useAuth()
  const [config, setConfig] = useState<TenantConfig | null>(null)

  useEffect(() => {
    if (token) fetchTenantConfig().then(setConfig)
  }, [token])

  if (!token) {
    return (
      <Suspense fallback={null}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <TenantConfigContext.Provider value={config}>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar />
        <main className="flex-1 overflow-hidden flex flex-col">
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

              <Route path="/inbox" element={
                <ModuleGate module="inbox"><PagePad><InboxQueue /></PagePad></ModuleGate>
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
              <Route path="/superadmin/clients" element={<PagePad><SuperAdminPage /></PagePad>} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </TenantConfigContext.Provider>
  )
}
