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

const TenantConfigContext = createContext<TenantConfig | null>(null)
export const useTenantConfig = () => useContext(TenantConfigContext)

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
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ flex: 1, padding: 32 }}>
          <Suspense fallback={<div>Loading...</div>}>
            <Routes>
              <Route path="/" element={<Navigate to="/contacts" replace />} />

              <Route path="/contacts" element={
                <ModuleGate module="contacts"><ContactList /></ModuleGate>
              } />
              <Route path="/contacts/new" element={
                <ModuleGate module="contacts"><ContactNew /></ModuleGate>
              } />
              <Route path="/contacts/:id" element={
                <ModuleGate module="contacts"><ContactDetail /></ModuleGate>
              } />

              <Route path="/tickets" element={
                <ModuleGate module="tickets"><TicketList /></ModuleGate>
              } />
              <Route path="/tickets/new" element={
                <ModuleGate module="tickets"><TicketNew /></ModuleGate>
              } />
              <Route path="/tickets/:id" element={
                <ModuleGate module="tickets"><TicketDetail /></ModuleGate>
              } />

              <Route path="/inbox" element={
                <ModuleGate module="inbox"><InboxQueue /></ModuleGate>
              } />
              <Route path="/inbox/drafts/:id" element={
                <ModuleGate module="inbox"><DraftReview /></ModuleGate>
              } />

              <Route path="/chat" element={
                <ModuleGate module="chat"><ChatPage /></ModuleGate>
              } />

              <Route path="/billing" element={
                <ModuleGate module="billing"><InvoiceList /></ModuleGate>
              } />

              <Route path="/activity" element={
                <ModuleGate module="activity"><ActivityFeed /></ModuleGate>
              } />

              <Route path="/settings/departments" element={<DepartmentsPage />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </TenantConfigContext.Provider>
  )
}
