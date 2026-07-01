import WelcomeTour from './components/WelcomeTour'
import SetupChecklist from './components/SetupChecklist'
import { createContext, lazy, Suspense, useContext, useEffect, useRef, useState } from 'react'
import { ComposeProvider } from './hooks/useCompose'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { fetchTenantConfig, TenantConfig } from './api/tenant'
import { useAuth } from './auth/useAuth'
import { ModuleGate } from './shell/ModuleGate'
import { PlanGate } from './shell/PlanGate'
import { Sidebar } from './shell/Sidebar'
import { BottomNav } from './shell/BottomNav'
import { DesktopOnly } from './shell/DesktopOnly'
import QuickCapturePopup from './components/QuickCapturePopup'

const ContactDetail = lazy(() => import('./modules/contacts/pages/ContactDetail'))
const ContactNew    = lazy(() => import('./modules/contacts/pages/ContactNew'))
const TicketList    = lazy(() => import('./modules/tickets/pages/TicketList'))
const TicketDetail  = lazy(() => import('./modules/tickets/pages/TicketDetail'))
const TicketNew     = lazy(() => import('./modules/tickets/pages/TicketNew'))
const InboxQueue    = lazy(() => import('./modules/inbox/pages/InboxQueue'))
const DraftReview   = lazy(() => import('./modules/inbox/pages/DraftReview'))
const ChatPage      = lazy(() => import('./modules/chat/pages/ChatPage'))
const CalendarPage  = lazy(() => import('./modules/calendar/pages/CalendarPage'))
const PipelinePage  = lazy(() => import('./modules/pipeline/pages/PipelinePage'))
const InvoiceList   = lazy(() => import('./modules/billing/pages/InvoiceList'))
const InvoiceDetail = lazy(() => import('./modules/billing/pages/InvoiceDetail'))
const ActivityFeed  = lazy(() => import('./modules/activity/pages/ActivityFeed'))
const LoginPage          = lazy(() => import('./auth/LoginPage'))
const RegisterPage       = lazy(() => import('./auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./auth/ForgotPasswordPage'))
const ResetPasswordPage  = lazy(() => import('./auth/ResetPasswordPage'))
const TeamSettingsPage   = lazy(() => import('./modules/admin/pages/TeamSettingsPage'))
const WorkspaceSettingsPage = lazy(() => import('./modules/admin/pages/LabelsPage'))
const ContactsPage             = lazy(() => import('./modules/contacts/pages/ContactsPage'))
const SuperAdminPage           = lazy(() => import('./modules/admin/pages/SuperAdminPage'))
const SuperadminsSettingsPage  = lazy(() => import('./modules/admin/pages/SuperadminsSettingsPage'))
const ProfileSettingsPage      = lazy(() => import('./modules/admin/pages/ProfileSettingsPage'))
const TemplatesPage            = lazy(() => import('./modules/admin/pages/TemplatesPage'))
const SubscriptionPage         = lazy(() => import('./modules/admin/pages/SubscriptionPage'))

const ShipmentList   = lazy(() => import('./modules/shipments/pages/ShipmentList'))
const ShipmentDetail = lazy(() => import('./modules/shipments/pages/ShipmentDetail'))

const TrackConfirmPage = lazy(() => import('./pages/TrackConfirmPage'))
const RequestDemoPage = lazy(() => import('./pages/RequestDemoPage'))
const DemoEnterPage = lazy(() => import('./pages/DemoEnterPage'))
const BookingPage = lazy(() => import('./pages/BookingPage'))
const BookingManagePage = lazy(() => import('./pages/BookingManagePage'))
const MeetPage = lazy(() => import('./pages/MeetPage'))
const UnsubscribePage = lazy(() => import('./pages/UnsubscribePage'))
const MarketingPage = lazy(() => import('./modules/marketing/pages/MarketingPage'))
const SalesPage     = lazy(() => import('./modules/sales/pages/SalesPage'))
const SaasPage      = lazy(() => import('./modules/saas/pages/SaasPage'))

const TenantConfigContext = createContext<TenantConfig | null>(null)
export const useTenantConfig = () => useContext(TenantConfigContext)

// Platform token: all tenant sessions fire into this account so the product
// owner can see cross-tenant feature adoption in their own Product Analytics page.
const PLATFORM_TOKEN = import.meta.env.VITE_YIPPIE_PLATFORM_TOKEN

function whenYippie(fn: (y: any) => void) {
  const w = window as any
  if (w.yippie) { fn(w.yippie); return }
  let tries = 0
  const t = setInterval(() => {
    if (w.yippie) { clearInterval(t); fn(w.yippie) }
    else if (++tries > 20) clearInterval(t)
  }, 200)
}

function PagePad({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 min-h-0 overflow-auto p-4 md:p-8">{children}</div>
}

function useGlobalHotkeys() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const lastKey = useRef<string | null>(null)
  const lastKeyTime = useRef(0)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (user?.hotkeys_enabled === false) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const now = Date.now()
      if (e.key === 'g') {
        lastKey.current = 'g'
        lastKeyTime.current = now
        return
      }
      if (e.key === 'i' && lastKey.current === 'g' && now - lastKeyTime.current < 1000) {
        lastKey.current = null
        navigate('/inbox')
        return
      }
      lastKey.current = null
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [user?.hotkeys_enabled, navigate])
}

export default function App() {
  const { user, refreshUser, impersonating, exitImpersonation } = useAuth()
  const [config, setConfig] = useState<TenantConfig | null>(null)
  const [configError, setConfigError] = useState(false)
  useGlobalHotkeys()

  // Public booking pages are standalone — render without the app shell or auth,
  // regardless of whether someone is logged in.
  if (window.location.pathname.startsWith('/book/')) {
    return (
      <Suspense fallback={null}>
        <Routes>
          <Route path="/book/manage/:manageToken" element={<BookingManagePage />} />
          <Route path="/book/:token" element={<BookingPage />} />
        </Routes>
      </Suspense>
    )
  }

  if (window.location.pathname.startsWith('/meet/')) {
    return (
      <Suspense fallback={null}>
        <Routes>
          <Route path="/meet/:slug" element={<MeetPage />} />
        </Routes>
      </Suspense>
    )
  }

  // Public unsubscribe — standalone, no shell or auth.
  if (window.location.pathname.startsWith('/unsubscribe/')) {
    return (
      <Suspense fallback={null}>
        <Routes>
          <Route path="/unsubscribe/:token" element={<UnsubscribePage />} />
        </Routes>
      </Suspense>
    )
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    refreshUser()
    setConfigError(false)
    fetchTenantConfig()
      .then((cfg) => { if (!cancelled) setConfig(cfg) })
      .catch(() => { if (!cancelled) setConfigError(true) })
    return () => { cancelled = true }
  }, [user?.id])

  // Inject saas.js once with the platform token so all tenant sessions post
  // feature-usage events into the product owner's analytics account.
  useEffect(() => {
    if (!PLATFORM_TOKEN || document.getElementById('yippie-platform-saas')) return
    const s = document.createElement('script')
    s.id = 'yippie-platform-saas'
    s.src = 'https://getyippie.com/saas.js'
    s.setAttribute('data-token', PLATFORM_TOKEN)
    s.async = true
    document.head.appendChild(s)
  }, [])

  // Identify the logged-in user once we have both user and config loaded.
  useEffect(() => {
    if (!user || !config || !PLATFORM_TOKEN) return
    whenYippie((y) => y.identify(user.id, {
      email:       user.email,
      name:        user.full_name,
      role:        user.role,
      tenant_id:   config.tenant_id,
      tenant_name: config.tenant_name,
      plan:        config.plan,
    }))
  }, [user?.id, config?.tenant_id])

  // Track module navigation so feature adoption is visible per tenant.
  const location = useLocation()
  useEffect(() => {
    if (!user || !PLATFORM_TOKEN) return
    const module = location.pathname.split('/')[1]
    if (!module) return
    whenYippie((y) => y.track('module_visited', { module, path: location.pathname }))
  }, [location.pathname, user?.id])

  if (!user) {
    return (
      <Suspense fallback={null}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/track/confirm" element={<TrackConfirmPage />} />
          <Route path="/request-demo" element={<RequestDemoPage />} />
          <Route path="/demo-enter" element={<DemoEnterPage />} />
          <Route path="/book/manage/:manageToken" element={<BookingManagePage />} />
          <Route path="/book/:token" element={<BookingPage />} />
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
      <ComposeProvider>
      {user && !user.tour_completed && <WelcomeTour />}
      <SetupChecklist />
      <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-50">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col pb-16 md:pb-0">
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

              {/* Contacts — manages its own scroll/padding like Inbox */}
              <Route path="/contacts" element={
                <ModuleGate module="contacts"><ContactsPage /></ModuleGate>
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

              <Route path="/calendar" element={
                <ModuleGate module="calendar"><PlanGate feature="calendar"><PagePad><CalendarPage /></PagePad></PlanGate></ModuleGate>
              } />

              <Route path="/pipeline" element={
                <ModuleGate module="pipeline"><PlanGate feature="pipeline"><PagePad><PipelinePage /></PagePad></PlanGate></ModuleGate>
              } />

              <Route path="/chat" element={
                <ModuleGate module="chat"><PlanGate feature="chat"><PagePad><ChatPage /></PagePad></PlanGate></ModuleGate>
              } />

              <Route path="/billing" element={
                <ModuleGate module="billing"><PagePad><InvoiceList /></PagePad></ModuleGate>
              } />

              <Route path="/billing/invoices/:invoiceId" element={
                <ModuleGate module="billing"><PagePad><InvoiceDetail /></PagePad></ModuleGate>
              } />

              <Route path="/activity" element={
                <ModuleGate module="activity"><PagePad><ActivityFeed /></PagePad></ModuleGate>
              } />

              {/* MarketingPage manages its own two-panel layout — no PagePad wrapper */}
              <Route path="/marketing" element={
                <ModuleGate module="marketing"><DesktopOnly><MarketingPage /></DesktopOnly></ModuleGate>
              } />

              <Route path="/tracking" element={
                <ModuleGate module="tracking"><PagePad><DesktopOnly><ShipmentList /></DesktopOnly></PagePad></ModuleGate>
              } />
              <Route path="/tracking/:id" element={
                <ModuleGate module="tracking"><PagePad><DesktopOnly><ShipmentDetail /></DesktopOnly></PagePad></ModuleGate>
              } />

              <Route path="/sales" element={
                <ModuleGate module="sales"><PagePad><DesktopOnly><SalesPage /></DesktopOnly></PagePad></ModuleGate>
              } />
              <Route path="/saas" element={
                <ModuleGate module="saas"><PagePad><DesktopOnly><SaasPage /></DesktopOnly></PagePad></ModuleGate>
              } />

              <Route path="/settings" element={<Navigate to="/settings/workspace" replace />} />

              <Route path="/settings/superadmins" element={<PagePad><SuperadminsSettingsPage /></PagePad>} />
              <Route path="/settings/profile" element={<PagePad><ProfileSettingsPage /></PagePad>} />
              <Route path="/settings/workspace" element={<PagePad><WorkspaceSettingsPage /></PagePad>} />
<Route path="/settings/team" element={<PagePad><TeamSettingsPage /></PagePad>} />
              <Route path="/settings/templates" element={<PagePad><TemplatesPage /></PagePad>} />
              {config?.environment === 'sandbox' && (
                <Route path="/settings/subscription" element={<PagePad><SubscriptionPage /></PagePad>} />
              )}
              <Route path="/superadmin/clients" element={<PagePad><SuperAdminPage /></PagePad>} />
              <Route path="/track/confirm" element={<TrackConfirmPage />} />
            </Routes>
          </Suspense>
        </main>
        <BottomNav />
        <QuickCapturePopup />
        <Toaster position="bottom-right" richColors />
      </div>
      </ComposeProvider>
    </TenantConfigContext.Provider>
  )
}
