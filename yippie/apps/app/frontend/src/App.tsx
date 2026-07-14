import WelcomeTour from './components/WelcomeTour'
import SetupChecklist from './components/SetupChecklist'
import SetPasswordModal from './components/SetPasswordModal'
import { ErrorBoundary } from './components/ErrorBoundary'
import { createContext, lazy, Suspense, useContext, useEffect, useRef, useState } from 'react'
import { ComposeProvider } from './hooks/useCompose'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { fetchTenantConfig, TenantConfig } from './api/tenant'
import { api } from './api/client'
import { useAuth } from './auth/useAuth'
import { ModuleGate } from './shell/ModuleGate'
import { PlanGate } from './shell/PlanGate'
import { Sidebar } from './shell/Sidebar'
import { BottomNav } from './shell/BottomNav'
import { DesktopOnly } from './shell/DesktopOnly'
import QuickCapturePopup from './components/QuickCapturePopup'
import HotkeyOverlay from './components/HotkeyOverlay'

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
const ContractList  = lazy(() => import('./modules/contracts/pages/ContractList'))
const ActivityFeed  = lazy(() => import('./modules/activity/pages/ActivityFeed'))
const FlowsPage     = lazy(() => import('./modules/flows/pages/FlowsPage'))
const FlowCanvasPage = lazy(() => import('./modules/flows/canvas/FlowCanvasPage'))
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
const SignContractPage = lazy(() => import('./pages/SignContractPage'))
const BookingManagePage = lazy(() => import('./pages/BookingManagePage'))
const MeetPage = lazy(() => import('./pages/MeetPage'))
const RequestPage = lazy(() => import('./pages/RequestPage'))
const WorkerAvailabilityPage = lazy(() => import('./modules/booking/pages/WorkerAvailabilityPage'))
const WorkerRequestsPage = lazy(() => import('./modules/booking/pages/WorkerRequestsPage'))
const WorkerHome = lazy(() => import('./modules/booking/pages/WorkerHome'))
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

// [TRIAL30] Persistent free trial countdown. Calm brand blue for most of the
// trial; switches to amber loss aversion framing in the final 5 days. The
// deadline comes from tenant config (trial_ends_at); cleared on conversion.
function TrialBanner({ endsAt }: { endsAt: string }) {
  const navigate = useNavigate()
  const msLeft = new Date(endsAt).getTime() - Date.now()
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000))
  const urgent = daysLeft <= 5
  return (
    <div
      className={`shrink-0 text-white text-xs font-semibold text-center py-1.5 px-4 ${
        urgent ? 'bg-amber-500' : 'bg-[#5BA4F5]'
      }`}
    >
      {urgent ? (
        <>
          Your free trial ends in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}. Your contacts, tickets and settings stay when you upgrade.{' '}
        </>
      ) : (
        <>
          Free trial: {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left.{' '}
        </>
      )}
      <button
        onClick={() => navigate('/settings/subscription')}
        className={`underline underline-offset-2 ${urgent ? 'hover:text-amber-100' : 'hover:text-blue-100'}`}
      >
        Upgrade now
      </button>
    </div>
  )
}

function DemoBanner({ expiresAt }: { expiresAt: string | null }) {
  // Loss aversion: a concrete deadline ("ends Friday") beats a vague "may be
  // reset". Falls back to the old copy when no expiry is set.
  if (!expiresAt) {
    return (
      <div className="shrink-0 bg-amber-500 text-white text-xs font-semibold text-center py-1.5 px-4">
        Demo environment. Data may be reset at any time.{' '}
        <a href="mailto:hello@getyippie.com" className="underline hover:text-amber-100">Contact support</a>
        {' '}to go live.
      </div>
    )
  }
  const end = new Date(expiresAt)
  const daysLeft = Math.ceil((end.getTime() - Date.now()) / 86_400_000)
  const deadline = daysLeft >= 0 && daysLeft <= 6
    ? end.toLocaleDateString(undefined, { weekday: 'long' })
    : end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return (
    <div className="shrink-0 bg-amber-500 text-white text-xs font-semibold text-center py-1.5 px-4">
      {daysLeft <= 0
        ? 'Your demo has ended. Your setup is still here.'
        : `Your demo ends ${deadline}. Everything you build stays when you go live.`}{' '}
      <a href="mailto:hello@getyippie.com" className="underline hover:text-amber-100">Contact us</a>
      {' '}to keep it.
    </div>
  )
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
  // Session local dismissal for SetPasswordModal's error escape hatch: the
  // server side needs_password flag stays true, so the modal honestly returns
  // next session — but the user is never trapped behind a failing modal now.
  const [pwModalDismissed, setPwModalDismissed] = useState(false)
  // The signup entry link (verify_email) 302s to /?entry=1 with only the
  // httponly auth cookie set — a fresh browser has no localStorage session
  // yet, so hydrate one from that cookie via GET /auth/me. The flag itself is
  // not sensitive (unlike the old ?set_password reset token); scrub it so a
  // refresh or shared URL doesn't re-trigger the bootstrap.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('entry') !== '1') return
    params.delete('entry')
    const qs = params.toString()
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
    if (!user) refreshUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useGlobalHotkeys()

  // Public booking pages are standalone — render without the app shell or auth,
  // regardless of whether someone is logged in.
  if (window.location.pathname.startsWith('/book/')) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/book/manage/:manageToken" element={<BookingManagePage />} />
            <Route path="/book/:token" element={<BookingPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    )
  }

  if (window.location.pathname.startsWith('/meet/')) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/meet/:slug" element={<MeetPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    )
  }

  // Public "request a time" page — standalone, no shell or auth (reverse booking).
  if (window.location.pathname.startsWith('/request/')) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/request/:slug" element={<RequestPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    )
  }

  // Public contract signing — standalone, no shell or auth ([CONTRACT3]).
  if (window.location.pathname.startsWith('/sign/')) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/sign/:token" element={<SignContractPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    )
  }

  // Public unsubscribe — standalone, no shell or auth.
  if (window.location.pathname.startsWith('/unsubscribe/')) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/unsubscribe/:token" element={<UnsubscribePage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
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

  // Silently re-issue the auth cookie every 4 hours so long sessions never hit
  // the 8-hour JWT expiry while the agent is actively working.
  useEffect(() => {
    if (!user) return
    const id = setInterval(() => {
      api.post('/auth/refresh').catch(() => {
        // 401 here means the token has already expired; the next real API call
        // will trigger the global 401 interceptor and redirect to /login.
      })
    }, 4 * 60 * 60 * 1000)
    return () => clearInterval(id)
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

  // Loss aversion: warn once per session when AI scans are nearly used up, so
  // the tenant can upgrade before auto-drafting silently stops.
  useEffect(() => {
    if (!config) return
    const limit = config.plan_limits?.ai_scans
    if (!limit) return
    const pct = Math.round((config.ai_scans_used_this_period / limit) * 100)
    if (pct < 90) return
    // Scope the once-per-session flag to the tenant so a superadmin switching
    // tenants still gets the warning for each one.
    const warnedKey = `ai_usage_warned_${config.tenant_id}`
    if (sessionStorage.getItem(warnedKey)) return
    sessionStorage.setItem(warnedKey, '1')
    toast.warning(`You’ve used ${Math.min(100, pct)}% of your AI scans this month`, {
      description: 'When they run out, incoming messages stop getting auto-drafted until next month.',
      duration: 8000,
      action: {
        label: 'Upgrade',
        onClick: () => { window.location.href = '/settings/subscription' },
      },
      // Loss-aversion dismissal: acknowledge the choice rather than a soft
      // "maybe later" out.
      cancel: {
        label: "I'll risk it",
        onClick: () => {},
      },
    })
  }, [config?.tenant_id, config?.ai_scans_used_this_period])

  // Track module navigation so feature adoption is visible per tenant.
  // Emitted as feature_used because the saas dashboard and health score only
  // aggregate feature_used / onboarding_step / error_encountered event types.
  const location = useLocation()
  useEffect(() => {
    if (!user || !PLATFORM_TOKEN) return
    const module = location.pathname.split('/')[1]
    if (!module) return
    whenYippie((y) => y.track('feature_used', { feature: module, path: location.pathname }))
  }, [location.pathname, user?.id])

  if (!user) {
    return (
      <ErrorBoundary>
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
      </ErrorBoundary>
    )
  }

  // Contract workers get a stripped-down standalone shell — no sidebar, no
  // modules. This role branch is the single enforcement point for what a worker
  // can see. WorkerHome picks the availability screen or the open-requests
  // screen based on the tenant's booking direction.
  if (user.role === 'worker') {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/availability" element={<WorkerAvailabilityPage />} />
            <Route path="/requests" element={<WorkerRequestsPage />} />
            <Route path="*" element={<WorkerHome />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
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
      {/* First-run surfaces are the impersonated user's — never consume their
          tour/checklist state while a superadmin is viewing as them.
          One anchored column, bottom-right: the tour sits ABOVE the checklist
          while both are visible; when the tour finishes it unmounts and the
          checklist takes its place. */}
      {!impersonating && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 flex flex-col items-end gap-3 max-h-[calc(100dvh-6.5rem)] overflow-y-auto">
          {user && !user.tour_completed && <WelcomeTour />}
          <SetupChecklist />
        </div>
      )}
      {/* Passwordless signup: user.needs_password is a durable server side
          flag, so the mandatory modal survives refreshes and repeat entry
          link clicks. onDone refetches /auth/me so needs_password=false
          propagates into localStorage and state after a successful save; the
          local dismissed bit covers the error path escape hatch, where the
          server flag (still true) would otherwise keep the modal mounted. */}
      {user && user.needs_password && !impersonating && !pwModalDismissed && (
        <SetPasswordModal onDone={() => { setPwModalDismissed(true); refreshUser() }} />
      )}
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
          {config?.is_demo && <DemoBanner expiresAt={config.demo_expires_at} />}
          {config && !config.is_demo && config.trial_ends_at && <TrialBanner endsAt={config.trial_ends_at} />}
          <ErrorBoundary>
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

              <Route path="/contracts" element={
                <ModuleGate module="contracts"><PagePad><ContractList /></PagePad></ModuleGate>
              } />

              <Route path="/activity" element={
                <ModuleGate module="activity"><PagePad><ActivityFeed /></PagePad></ModuleGate>
              } />

              <Route path="/flows" element={
                <ModuleGate module="flows"><PagePad><FlowsPage /></PagePad></ModuleGate>
              } />
              {/* [FLOW3] canvas fills full height — no PagePad wrapper */}
              <Route path="/flows/:id" element={
                <ModuleGate module="flows"><FlowCanvasPage /></ModuleGate>
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
              <Route path="/settings/subscription" element={<PagePad><SubscriptionPage /></PagePad>} />
              <Route path="/superadmin/clients" element={<PagePad><SuperAdminPage /></PagePad>} />
              <Route path="/track/confirm" element={<TrackConfirmPage />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </main>
        <BottomNav />
        <QuickCapturePopup />
        <HotkeyOverlay />
        <Toaster position="bottom-right" richColors />
      </div>
      </ComposeProvider>
    </TenantConfigContext.Provider>
  )
}
