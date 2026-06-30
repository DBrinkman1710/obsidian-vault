import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, MessageSquare, ArrowRight, X, Trash2, AlertOctagon, CheckSquare, ChevronLeft, ChevronRight, Building2, Users, Pencil, Send, Sparkles, Search, ChevronDown, Check, XCircle, UserPlus, User } from 'lucide-react'
import { api } from '../../../api/client'
import { Checkbox, BulkBar } from '../../../components/Selection'
import { useContextMenu, ContextMenu } from '../../../components/ContextMenu'
import { useTenantConfig } from '../../../App'
import { useAuth } from '../../../auth/useAuth'
import { CardListSkeleton } from '../../../shell/Skeleton'
import ComposeModal, { type ComposeInitialState, type SendQueuedPayload } from '../components/ComposeModal'
import { TemplatePicker, htmlToText } from '../components/TemplatePicker'
import { useSignatures, pickDefaultSignature } from '../../../hooks/useSignatures'

const INBOX_FACTS = [
  "Studies show clearing your inbox reduces stress by up to 38%.",
  "The average support ticket takes 12 minutes to resolve. You're on top of it.",
  "Teams that respond within 1 hour are 7× more likely to have meaningful conversations.",
  "You've handled everything. Take a breath — the next message will arrive soon.",
  "Empty inbox = full focus. Use this moment for deep work.",
  "Customers who get fast replies are 3× more likely to recommend a business.",
  "Zero unread. You're in the top 5% of inbox managers.",
  "An organized inbox saves an average of 30 minutes per day.",
  "Quick responses build trust. You're already doing great.",
  "Inbox zero is a superpower. You have it.",
  "Every ticket resolved is a customer relationship strengthened.",
  "Response time under 4 hours boosts customer satisfaction by 25%.",
  "You're making someone's day better, one reply at a time.",
  "The best time to handle a ticket is now. You already did.",
  "Teams using structured inboxes resolve issues 40% faster.",
  "Great support isn't a cost centre — it's a growth engine.",
  "Customer retention is 5× cheaper than acquisition. Your inbox work matters.",
  "You've earned this moment of calm. Enjoy it.",
  "The next great support interaction starts with an empty inbox.",
  "Consistent response time builds brand loyalty. You're building it.",
  "Keyboard tip: press 'j' / 'k' to move between messages, 'r' to open, 'c' to compose.",
  "Power move: hit 'g' then 'i' from anywhere in the app to jump straight to Inbox.",
  "Cmd+Enter (or Ctrl+Enter) sends a reply instantly — no mouse needed.",
  "Did you know? Right-click the sidebar to drag and reorder your modules.",
  "Tip: use the search bar to find messages by subject or sender in any tab.",
]

function AllCaughtUp() {
  const [fact, setFact] = useState(() => INBOX_FACTS[Math.floor(Math.random() * INBOX_FACTS.length)])
  useEffect(() => {
    const id = setInterval(() => {
      setFact(INBOX_FACTS[Math.floor(Math.random() * INBOX_FACTS.length)])
    }, 120_000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
        <CheckSquare size={32} className="text-green-500" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-slate-700">All caught up!</h3>
      <p className="text-sm text-slate-400 max-w-xs leading-relaxed">{fact}</p>
    </div>
  )
}

const SOURCE_ICON: Record<string, React.ReactNode> = {
  email: <Mail size={13} className="text-slate-400" />,
  whatsapp: <MessageSquare size={13} className="text-green-500" />,
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-amber-100 text-amber-700',
  medium: 'bg-blue-100 text-blue-700',
  low:    'bg-slate-100 text-slate-600',
}

const STATUS_STYLES: Record<string, string> = {
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  forwarded: 'bg-violet-100 text-violet-700',
  bin:       'bg-slate-100 text-slate-500',
  spam:      'bg-orange-100 text-orange-700',
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    sent:      { label: 'Sent',      cls: 'bg-slate-100 text-slate-500' },
    delivered: { label: 'Delivered', cls: 'bg-green-50 text-green-600' },
    opened:    { label: 'Opened',    cls: 'bg-blue-50 text-blue-600' },
    clicked:   { label: 'Clicked',   cls: 'bg-purple-50 text-purple-600' },
    bounced:   { label: 'Bounced',   cls: 'bg-red-50 text-red-600' },
  }
  const s = map[status] ?? map['sent']
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${s.cls}`}>{s.label}</span>
}

type Tab = 'pending' | 'processed' | 'sent'
type ProcessedFilter = 'all' | 'approved' | 'rejected' | 'forwarded' | 'spam' | 'bin'
type Mailbox = 'shared' | 'personal'


const PROCESSED_FILTERS: { value: ProcessedFilter; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'approved',  label: 'Approved' },
  { value: 'rejected',  label: 'Rejected' },
  { value: 'forwarded', label: 'Forwarded' },
  { value: 'spam',      label: 'Spam' },
  { value: 'bin',       label: 'Bin' },
]

const RETENTION_NOTES: Partial<Record<ProcessedFilter, string>> = {
  spam: 'Spam is moved to the Bin automatically after 10 working days.',
  bin:  'Items in the Bin are permanently deleted after 20 working days.',
}

const PAGE_SIZE = 9

interface Assignee {
  id: string
  full_name: string
  email: string | null
}

function AssignModal({ ids, onClose, onDone }: { ids: string[]; onClose: () => void; onDone: () => void }) {
  const [tab, setTab] = useState<'users' | 'departments'>('users')
  const qc = useQueryClient()
  const [assigning, setAssigning] = useState(false)

  const { data: assignees = [] } = useQuery({
    queryKey: ['inbox-assignees'],
    queryFn: () => api.get<Assignee[]>('/inbox/drafts/assignees').then((r: any) => r.data),
  })

  const { data: depts = [] } = useQuery({
    queryKey: ['departments', 'my'],
    queryFn: () => api.get<Array<{ id: string; name: string }>>('/departments/my').then((r: any) => r.data),
  })

  async function assignToUser(userId: string) {
    setAssigning(true)
    try {
      await api.post('/inbox/drafts/bulk-assign', { ids, assigned_to_user_id: userId })
      qc.invalidateQueries({ queryKey: ['drafts'] })
      onDone()
    } finally {
      setAssigning(false)
    }
  }

  async function assignToDepartment(deptId: string) {
    setAssigning(true)
    try {
      await api.post('/inbox/drafts/bulk-assign', { ids, department_id: deptId })
      qc.invalidateQueries({ queryKey: ['drafts'] })
      onDone()
    } finally {
      setAssigning(false)
    }
  }

  async function unassign() {
    setAssigning(true)
    try {
      await api.post('/inbox/drafts/bulk-assign', { ids, assigned_to_user_id: null })
      qc.invalidateQueries({ queryKey: ['drafts'] })
      onDone()
    } finally {
      setAssigning(false)
    }
  }

  const tabCls = (t: typeof tab) =>
    `px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-900">Assign to</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex border-b border-slate-100 shrink-0 px-2">
          <button className={tabCls('users')} onClick={() => setTab('users')}>
            <Users size={13} className="inline mr-1.5 -mt-0.5" />
            Users
          </button>
          <button className={tabCls('departments')} onClick={() => setTab('departments')}>
            <Building2 size={13} className="inline mr-1.5 -mt-0.5" />
            Departments
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {tab === 'users' && (
            <>
              {assignees.map((assignee: any) => (
                <button
                  key={assignee.id}
                  type="button"
                  onClick={() => assignToUser(assignee.id)}
                  disabled={assigning}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 disabled:opacity-50 transition-colors text-left"
                >
                  <User size={15} className="text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900">{assignee.full_name}</div>
                    {assignee.email && <div className="text-xs text-slate-400 truncate">{assignee.email}</div>}
                  </div>
                </button>
              ))}
              {assignees.length === 0 && <div className="px-4 py-8 text-sm text-slate-400 text-center">No assignees available</div>}
            </>
          )}

          {tab === 'departments' && (
            <>
              {depts.map((dept: any) => (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => assignToDepartment(dept.id)}
                  disabled={assigning}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 disabled:opacity-50 transition-colors text-left"
                >
                  <Building2 size={15} className="text-slate-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-900">{dept.name}</span>
                </button>
              ))}
              {depts.length === 0 && <div className="px-4 py-8 text-sm text-slate-400 text-center">No departments</div>}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={unassign}
            disabled={assigning}
            className="flex-1 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors disabled:cursor-not-allowed"
          >
            Unassign
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={assigning}
            className="flex-1 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function InboxQueue() {
  const [activeTab, setActiveTab] = useState<Tab>('pending')
  const [mailbox, setMailbox] = useState<Mailbox>('shared')
  const [focusedIdx, setFocusedIdx] = useState<number>(-1)
  const navigate = useNavigate()
  const [activeDeptId, setActiveDeptId] = useState<string | undefined>(undefined)
  const [showDeptDropdown, setShowDeptDropdown] = useState(false)
  const deptDropdownRef = useRef<HTMLDivElement>(null)
  const [processedFilter, setProcessedFilter] = useState<ProcessedFilter>('all')
  const [showCompose, setShowCompose] = useState(false)
  const [composeInitial, setComposeInitial] = useState<ComposeInitialState | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const ctx = useContextMenu()
  const [page, setPage] = useState(0)
  const [selectedSentItem, setSelectedSentItem] = useState<any | null>(null)
  // Shared search query — persists across Pending/Processed/Sent tab switches.
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showProcessedFilter, setShowProcessedFilter] = useState(false)
  const [assignedToMe, setAssignedToMe] = useState(false)
  const [assignedToUser, setAssignedToUser] = useState<string | null>(null)
  const [showAssignedFilter, setShowAssignedFilter] = useState(false)
  const processedFilterRef = useRef<HTMLDivElement>(null)
  const assignedFilterRef = useRef<HTMLDivElement>(null)
  // Undo bar state (lives here so the modal can close immediately on send)
  const [pendingCompose, setPendingCompose] = useState<{ composeId: string; recipientCount: number; restoreData: ComposeInitialState } | null>(null)
  const [undoProgress, setUndoProgress] = useState(0)
  const undoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const qc = useQueryClient()
  const config = useTenantConfig()
  const { user } = useAuth()
  const { data: signatures } = useSignatures()
  const defaultSigBody = pickDefaultSignature(signatures)?.body ?? null
  const aiEnabled = config?.enabled_modules?.includes('ai') ?? true
  const marketingEnabled = config?.enabled_modules?.includes('marketing') ?? true

  useEffect(() => () => { if (undoIntervalRef.current) clearInterval(undoIntervalRef.current) }, [])

  // Auto-open compose with pre-filled recipients from contacts/companies page
  useEffect(() => {
    const raw = sessionStorage.getItem('compose-prefill')
    const autoCompose = new URLSearchParams(window.location.search).get('compose')
    if (raw && autoCompose === '1') {
      try {
        const recipients = JSON.parse(raw)
        setComposeInitial({ recipients, subject: '', body: defaultSigBody ? `\n\n${defaultSigBody}` : '', fromEmail: null })
        setShowCompose(true)
      } catch { /* ignore */ }
      sessionStorage.removeItem('compose-prefill')
      // Remove ?compose=1 from URL without reload
      const url = new URL(window.location.href)
      url.searchParams.delete('compose')
      window.history.replaceState({}, '', url.toString())
    }
  }, [defaultSigBody])

  useEffect(() => { setFocusedIdx(-1) }, [activeTab, mailbox])

  // Debounce the search box so each keystroke doesn't fire a backend query.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // Reset to the first page whenever the search term changes.
  useEffect(() => { setPage(0) }, [debouncedSearch])

  // Close the Processed / assigned / dept filter dropdowns on outside click.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (processedFilterRef.current && !processedFilterRef.current.contains(e.target as Node)) {
        setShowProcessedFilter(false)
      }
      if (assignedFilterRef.current && !assignedFilterRef.current.contains(e.target as Node)) {
        setShowAssignedFilter(false)
      }
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) {
        setShowDeptDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Trending topics — derived from recent draft subjects, refreshed every 15 min.
  const { data: trending } = useQuery({
    queryKey: ['inbox-trending'],
    queryFn: () => api.get<{ topics: string[] }>('/inbox/trending').then((r: any) => r.data.topics),
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
    refetchIntervalInBackground: false,
  })

  // Unread counts for mailbox tabs
  const { data: inboxCounts } = useQuery({
    queryKey: ['inbox-counts', activeDeptId],
    queryFn: () => api.get<{ pending: number; personal: number; unread: number; unread_personal: number }>('/inbox/drafts/count', {
      params: activeDeptId ? { department_id: activeDeptId } : {},
    }).then((r: any) => r.data),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (user?.hotkeys_enabled === false) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'c' && !showCompose) { setShowCompose(true); setComposeInitial(null) }
      if (e.key === 'Escape' && showCompose) { setShowCompose(false); setComposeInitial(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [user?.hotkeys_enabled, showCompose])

  const handleSendQueued = useCallback((payload: SendQueuedPayload) => {
    setPendingCompose({ composeId: payload.composeId, recipientCount: payload.recipientCount, restoreData: payload.restoreData })
    setUndoProgress(0)
    const start = Date.now()
    const duration = 5000
    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current)
    undoIntervalRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / duration) * 100)
      setUndoProgress(pct)
      if (pct >= 100) {
        clearInterval(undoIntervalRef.current!)
        undoIntervalRef.current = null
        setPendingCompose(null)
        qc.invalidateQueries({ queryKey: ['drafts'] })
      }
    }, 100)
  }, [qc])

  async function handleUndoCompose() {
    if (!pendingCompose) return
    const restoreData = pendingCompose.restoreData
    try {
      await api.post(`/inbox/drafts/${pendingCompose.composeId}/undo-send`)
      if (undoIntervalRef.current) { clearInterval(undoIntervalRef.current); undoIntervalRef.current = null }
      setPendingCompose(null)
      setUndoProgress(0)
      setComposeInitial(restoreData)
      setShowCompose(true)
    } catch {
      if (undoIntervalRef.current) { clearInterval(undoIntervalRef.current); undoIntervalRef.current = null }
      setPendingCompose(null)
      setUndoProgress(0)
      qc.invalidateQueries({ queryKey: ['drafts'] })
    }
  }

  const { data: myDepts } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['departments', 'my'],
    queryFn: () => api.get('/departments/my').then((r: any) => r.data),
    staleTime: 60_000,
  })

  // Scope the shared inbox to the user's first department by default.
  // Users with no departments see the full tenant shared inbox.
  useEffect(() => {
    if (myDepts && myDepts.length > 0 && activeDeptId === undefined) {
      setActiveDeptId(myDepts[0].id)
    }
  }, [myDepts, activeDeptId])

  const searchParam = debouncedSearch || undefined

  // Sent tab — single source of truth: the consolidated marketing outbound feed.
  // No module check, no activity-log fallback; one endpoint, one set of columns.
  // Use the module-gate-free emailtracking endpoint so reply emails appear
  // for all tenants regardless of whether the marketing module is enabled.
  const { data: outboundEmails, isLoading: outboundLoading } = useQuery({
    queryKey: ['outbound-emails', searchParam],
    queryFn: () => api.get('/emailtracking/outbound', { params: { limit: 200, q: searchParam } }).then((r: any) => r.data as any[]),
    enabled: activeTab === 'sent',
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })

  const draftParams = (status: string) => ({
    status,
    mailbox,
    q: searchParam,
    ...(activeDeptId ? { department_id: activeDeptId } : {}),
  })
  const draftKey = (status: string) => ['drafts', mailbox, status, searchParam, activeDeptId] as const

  const { data: pendingDrafts, isLoading: pendingLoading } = useQuery({
    queryKey: draftKey('pending'),
    queryFn: () => api.get('/inbox/drafts', { params: draftParams('pending') }).then((r: any) => r.data),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    enabled: activeTab === 'pending',
  })

  const { data: approvedDrafts } = useQuery({
    queryKey: draftKey('approved'),
    queryFn: () => api.get('/inbox/drafts', { params: draftParams('approved') }).then((r: any) => r.data),
    enabled: activeTab === 'processed',
  })

  const { data: rejectedDrafts } = useQuery({
    queryKey: draftKey('rejected'),
    queryFn: () => api.get('/inbox/drafts', { params: draftParams('rejected') }).then((r: any) => r.data),
    enabled: activeTab === 'processed',
  })

  const { data: forwardedDrafts } = useQuery({
    queryKey: draftKey('forwarded'),
    queryFn: () => api.get('/inbox/drafts', { params: draftParams('forwarded') }).then((r: any) => r.data),
    enabled: activeTab === 'processed',
  })

  const { data: spamDrafts } = useQuery({
    queryKey: draftKey('spam'),
    queryFn: () => api.get('/inbox/drafts', { params: draftParams('spam') }).then((r: any) => r.data),
    enabled: activeTab === 'processed',
  })

  const { data: binDrafts } = useQuery({
    queryKey: draftKey('bin'),
    queryFn: () => api.get('/inbox/drafts', { params: draftParams('bin') }).then((r: any) => r.data),
    enabled: activeTab === 'processed',
  })

  const allProcessed = [...(approvedDrafts ?? []), ...(rejectedDrafts ?? []), ...(forwardedDrafts ?? []), ...(spamDrafts ?? []), ...(binDrafts ?? [])]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const processedDrafts = processedFilter === 'all'
    ? allProcessed
    : allProcessed.filter((d: any) => d.status === processedFilter)

  const allDrafts = activeTab === 'pending' ? (pendingDrafts ?? []) : activeTab === 'sent' ? [] : processedDrafts
  const isLoading = activeTab === 'pending' ? pendingLoading : activeTab === 'sent' ? outboundLoading : false

  // Client-side assignment filters — applied before pagination.
  const assignedToMeCount = allDrafts.filter((d: any) => d.assigned_to === user?.id).length
  const visibleDrafts = assignedToMe && user?.id
    ? allDrafts.filter((d: any) => d.assigned_to === user.id)
    : assignedToUser
    ? allDrafts.filter((d: any) => d.assigned_to === assignedToUser)
    : allDrafts

  // Client-side pagination — the full filtered list is already in memory.
  const totalPages = Math.max(1, Math.ceil(visibleDrafts.length / PAGE_SIZE))
  const pageCount = totalPages
  const safePage = Math.min(page, pageCount - 1)
  const pageDrafts = visibleDrafts.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  // Sent tab pagination — 9 mails/page, mirroring the Pending cadence (PAGE_SIZE).
  const sentList: any[] = activeTab === 'sent' ? (outboundEmails ?? []) : []
  const sentPageCount = Math.max(1, Math.ceil(sentList.length / PAGE_SIZE))
  const sentSafePage = Math.min(page, sentPageCount - 1)
  const pageSentList = sentList.slice(sentSafePage * PAGE_SIZE, (sentSafePage + 1) * PAGE_SIZE)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (user?.hotkeys_enabled === false) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'j') setFocusedIdx(i => Math.min(i + 1, pageDrafts.length - 1))
      if (e.key === 'k') setFocusedIdx(i => Math.max(i - 1, 0))
      if (e.key === 'r' && focusedIdx >= 0 && pageDrafts[focusedIdx]) {
        navigate(`/inbox/drafts/${pageDrafts[focusedIdx].id}?mailbox=${mailbox}`)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [user?.hotkeys_enabled, pageDrafts, focusedIdx, navigate])

  const bulkAssignMutation = useMutation({
    mutationFn: ({ ids, assigned_to_user_id }: { ids: string[]; assigned_to_user_id: string | null }) =>
      api.post('/inbox/drafts/bulk-assign', { ids, assigned_to_user_id }).then((r: any) => r.data),
    onSuccess: () => {
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['drafts'] })
    },
  })

  const bulkMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: 'bin' | 'spam' }) =>
      api.post('/inbox/drafts/bulk-action', { ids, action }).then((r: any) => r.data),
    onMutate: async ({ ids }: any) => {
      const key = draftKey('pending')
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      qc.setQueryData(key, (old: any) => (old ?? []).filter((d: any) => !ids.includes(d.id)))
      return { prev, key }
    },
    onError: (_err: any, _vars: any, ctx: any) => {
      if (ctx?.prev !== undefined) qc.setQueryData(ctx.key, ctx.prev)
    },
    onSuccess: () => {
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['drafts'] })
    },
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      api.post(`/inbox/drafts/${id}/review`, { action }).then((r: any) => r.data),
    onMutate: async ({ id }: any) => {
      const key = draftKey('pending')
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      qc.setQueryData(key, (old: any) => (old ?? []).filter((d: any) => d.id !== id))
      return { prev, key }
    },
    onError: (_err: any, _vars: any, ctx: any) => {
      if (ctx?.prev !== undefined) qc.setQueryData(ctx.key, ctx.prev)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drafts'] }),
  })

  const { data: inboxTeamMembers = [] } = useQuery({
    queryKey: ['team-members', 'inbox'],
    queryFn: () => api.get('/team/members', { params: { module: 'inbox' } }).then((r: any) => r.data as { id: string; full_name: string; email: string }[]),
    staleTime: 60_000,
  })

  const assignDraftMutation = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      api.patch(`/inbox/drafts/${id}/assign`, { assigned_to: userId }).then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drafts'] }),
  })

  const { data: allDepartments = [] } = useQuery({
    queryKey: ['departments-all'],
    queryFn: () => api.get('/departments/all').then((r: any) => r.data as { id: string; name: string }[]),
    staleTime: 60_000,
  })

  const deptNameMap = Object.fromEntries(allDepartments.map((d: any) => [d.id, d.name]))
  const memberMap = Object.fromEntries(inboxTeamMembers.map((m: any) => [m.id, m.full_name as string]))

  const routeDraftMutation = useMutation({
    mutationFn: ({ id, departmentId }: { id: string; departmentId: string }) =>
      api.patch(`/inbox/drafts/${id}/route`, { department_id: departmentId }).then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drafts'] }),
  })

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === visibleDrafts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(visibleDrafts.map((d: any) => d.id)))
    }
  }

  const [showAssignModal, setShowAssignModal] = useState(false)

  const handleTabSwitch = (tab: Tab) => {
    setActiveTab(tab)
    setSelected(new Set())
    setProcessedFilter('all')
    setPage(0)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Fixed header */}
      <div className="shrink-0 px-4 pt-4 pb-0 md:px-8 md:pt-8 bg-slate-50">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 md:gap-4 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">Inbox</h1>
            {/* Mailbox switch: shared (whole team) vs personal (mail to your own address) */}
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
              {([
                { value: 'shared', label: 'Shared', icon: <Users size={13} />, count: inboxCounts?.unread },
                { value: 'personal', label: 'Personal', icon: <Mail size={13} />, count: inboxCounts?.unread_personal },
              ] as { value: Mailbox; label: string; icon: React.ReactNode; count?: number }[]).map(m => {
                const displayCount = m.count !== undefined && m.count > 0 ? (m.count > 9 ? '9+' : m.count.toString()) : null
                return (
                  <button
                    key={m.value}
                    onClick={() => { setMailbox(m.value); setSelected(new Set()); setPage(0) }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      mailbox === m.value
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {m.icon}
                    {m.label}
                    {displayCount && (
                      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                        mailbox === m.value
                          ? 'bg-white/30 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}>
                        {displayCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {/* Department switcher — only shown when user belongs to multiple departments */}
            {(myDepts ?? []).length > 1 && (
              <div className="relative" ref={deptDropdownRef}>
                <button
                  onClick={() => setShowDeptDropdown(v => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Building2 size={13} />
                  {(myDepts ?? []).find((d: any) => d.id === activeDeptId)?.name ?? 'Select department'}
                  <ChevronDown size={12} />
                </button>
                {showDeptDropdown && (
                  <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-lg z-20 min-w-[160px] py-1">
                    {(myDepts ?? []).map((d: any) => (
                      <button
                        key={d.id}
                        onClick={() => { setActiveDeptId(d.id); setShowDeptDropdown(false); setSelected(new Set()); setPage(0) }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-slate-50 text-left ${
                          activeDeptId === d.id ? 'text-blue-600' : 'text-slate-700'
                        }`}
                      >
                        {activeDeptId === d.id ? <Check size={12} /> : <span className="w-3" />}
                        {d.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setComposeInitial(mailbox === 'personal' && !!user?.reply_from_email ? {
                recipients: [],
                subject: '',
                body: defaultSigBody ? `\n\n${defaultSigBody}` : '',
                fromEmail: user.reply_from_email,
              } : null)
              setShowCompose(true)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity"
          >
            <Pencil size={14} />
            Compose
          </button>
        </div>

        {/* Search bar + Templates — same row */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative w-72 max-w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search inbox…"
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-yippie focus:border-transparent transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {marketingEnabled && (
            <div className="ml-auto">
              <TemplatePicker
                direction="down"
                triggerIconSize={14}
                triggerClassName="inline-flex items-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity"
                onSelect={(tmplBody, isHtml, buttons) => {
                  const text = isHtml ? htmlToText(tmplBody) : tmplBody
                  setComposeInitial({
                    recipients: [],
                    subject: '',
                    body: defaultSigBody ? `${text}\n\n${defaultSigBody}` : text,
                    fromEmail: null,
                    templateHtml: isHtml ? tmplBody : null,
                    campaignButtonsJson: isHtml ? (buttons ?? null) : null,
                  })
                  setShowCompose(true)
                }}
              />
            </div>
          )}
        </div>

        {/* Tabs (shared across all three tabs) */}
        <div className="flex items-center gap-2 mb-0">
          {(['pending', 'processed', 'sent'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => handleTabSwitch(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-yippie text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Trending topics — shown when the search box is empty */}
        {!search && trending && trending.length > 0 && (
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-2">
            <span className="text-xs text-slate-300">Trending:</span>
            {trending.map((topic: any) => (
              <button
                key={topic}
                onClick={() => setSearch(topic)}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                {topic}
              </button>
            ))}
          </div>
        )}

        {/* Personal mailbox without an address configured */}
        {mailbox === 'personal' && !user?.inbound_email && (
          <div className="mt-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            No personal inbox address set yet.{' '}
            <Link to="/settings/profile" className="font-semibold underline">
              Add one in Profile settings
            </Link>{' '}
            and forward your work email to it.
          </div>
        )}

        {/* Processed filter — single dropdown (same options as the old pills) */}
        {activeTab === 'processed' && (
          <div ref={processedFilterRef} className="relative mt-3 inline-block">
            <button
              onClick={() => setShowProcessedFilter(o => !o)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {PROCESSED_FILTERS.find(f => f.value === processedFilter)?.label ?? 'All'}
              <ChevronDown size={13} className={`text-slate-400 transition-transform ${showProcessedFilter ? 'rotate-180' : ''}`} />
            </button>
            {showProcessedFilter && (
              <div className="absolute left-0 top-full mt-1 z-20 w-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                {PROCESSED_FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => { setProcessedFilter(f.value); setPage(0); setShowProcessedFilter(false) }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-semibold transition-colors ${
                      processedFilter === f.value
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'processed' && RETENTION_NOTES[processedFilter] && (
          <p className="mt-2 text-xs text-slate-400">{RETENTION_NOTES[processedFilter]}</p>
        )}

        {/* Sent tab description */}
        {activeTab === 'sent' && (
          <p className="mt-3 text-xs text-slate-400">All outbound mail sent by your team.</p>
        )}

        {/* Bulk action bar */}
        <BulkBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          actions={[
            {
              label: 'Move to Bin',
              icon: <Trash2 size={13} />,
              danger: true,
              onClick: () => bulkMutation.mutate({ ids: Array.from(selected), action: 'bin' }),
            },
            {
              label: 'Mark as Spam',
              icon: <AlertOctagon size={13} />,
              danger: true,
              onClick: () => bulkMutation.mutate({ ids: Array.from(selected), action: 'spam' }),
            },
            {
              label: 'Assign to me',
              icon: <User size={13} />,
              onClick: () => bulkAssignMutation.mutate({ ids: Array.from(selected), assigned_to_user_id: user?.id ?? null }),
            },
            {
              label: 'Assign to…',
              icon: <UserPlus size={13} />,
              onClick: () => setShowAssignModal(true),
            },
          ]}
        />

        <div className="h-4" />
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 md:px-8 md:pb-8">
        {/* Sent tab content */}
        {activeTab === 'sent' && (
          <>
            {isLoading && <CardListSkeleton rows={5} />}
            {!isLoading && sentList.length === 0 && (
              <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
                <Send size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">
                  {debouncedSearch ? 'No sent mail matches your search' : 'No sent mail yet'}
                </p>
              </div>
            )}
            {sentList.length > 0 && (
              <div className="flex flex-col gap-3">
                {pageSentList.map((item: any) => {
                  const subject = item.subject ?? '(no subject)'
                  const toAddr = item.to_email
                  const isCompose = item.kind === 'compose'
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedSentItem(item)}
                      className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start gap-3 transition-all hover:border-blue-300 hover:shadow-md cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Send size={13} className="text-slate-400 shrink-0" />
                          <span className="text-sm font-semibold text-slate-900 truncate">{subject}</span>
                          {statusBadge(item.status)}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${isCompose ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {isCompose ? 'Composed' : 'Reply'}
                          </span>
                        </div>
                        {toAddr && <p className="text-xs text-slate-500">To: {toAddr}</p>}
                        {item.delivered_at && (
                          <p className="text-xs text-slate-400 mt-0.5">Delivered: {new Date(item.delivered_at).toLocaleString()}</p>
                        )}
                        {item.opened_at && (
                          <p className="text-xs text-blue-500 mt-0.5">Opened: {new Date(item.opened_at).toLocaleString()}</p>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 shrink-0">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Sent pagination — 9 mails per page (matches Pending cadence) */}
            {sentList.length > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-4 mt-5">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={sentSafePage === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <span className="text-xs text-slate-500 font-medium">
                  Page {sentSafePage + 1} of {sentPageCount}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(sentPageCount - 1, p + 1))}
                  disabled={sentSafePage >= sentPageCount - 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}

        {activeTab !== 'sent' && isLoading && <CardListSkeleton rows={5} />}
        {!isLoading && allDrafts.length === 0 && activeTab === 'pending' && (
          <AllCaughtUp />
        )}
        {activeTab === 'processed' && !isLoading && allDrafts.length === 0 && (
          <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
            <Mail size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">
              No processed messages yet
            </p>
          </div>
        )}

        {activeTab !== 'sent' && allDrafts.length > 0 && (
          <>
            {/* Sticky select-all row — desktop only */}
            <div className="sticky top-0 z-10 hidden md:flex items-center justify-between py-2 bg-slate-50">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSelectAll}
                  className="inline-flex items-center gap-2 text-xs font-medium transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Checkbox
                    checked={selected.size === visibleDrafts.length && visibleDrafts.length > 0}
                    indeterminate={selected.size > 0 && selected.size < visibleDrafts.length}
                    onChange={toggleSelectAll}
                    ariaLabel="Select all"
                  />
                  {selected.size === visibleDrafts.length && visibleDrafts.length > 0 ? 'Deselect all' : `Select all (${visibleDrafts.length})`}
                </button>
                <button
                  onClick={() => { setAssignedToMe(v => !v); setAssignedToUser(null); setPage(0) }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold transition-colors"
                  style={{
                    borderRadius: 'var(--radius-sm)',
                    background: assignedToMe ? 'var(--brand-soft)' : 'transparent',
                    color: assignedToMe ? 'var(--brand-deep)' : 'var(--text-muted)',
                  }}
                >
                  Assigned to me
                  {assignedToMeCount > 0 && (
                    <span
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
                      style={{
                        background: assignedToMe ? 'var(--brand-deep)' : 'var(--border-default)',
                        color: assignedToMe ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      {assignedToMeCount > 9 ? '9+' : assignedToMeCount}
                    </span>
                  )}
                </button>
                {/* Per-user assignment filter dropdown */}
                {inboxTeamMembers.length > 0 && (
                  <div ref={assignedFilterRef} className="relative">
                    <button
                      onClick={() => setShowAssignedFilter(o => !o)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        assignedToUser
                          ? 'bg-yippie border-transparent text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {assignedToUser ? memberMap[assignedToUser] ?? 'User' : 'Assigned to…'}
                      <ChevronDown size={11} className={`transition-transform ${showAssignedFilter ? 'rotate-180' : ''}`} />
                    </button>
                    {showAssignedFilter && (
                      <div className="absolute left-0 top-full mt-1 z-20 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                        <button
                          onClick={() => { setAssignedToUser(null); setAssignedToMe(false); setPage(0); setShowAssignedFilter(false) }}
                          className={`w-full text-left px-3 py-1.5 text-xs font-semibold transition-colors ${!assignedToUser ? 'bg-yippie text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          All users
                        </button>
                        {inboxTeamMembers.map((m: any) => (
                          <button
                            key={m.id}
                            onClick={() => { setAssignedToUser(m.id); setAssignedToMe(false); setPage(0); setShowAssignedFilter(false) }}
                            className={`w-full text-left px-3 py-1.5 text-xs font-semibold transition-colors ${assignedToUser === m.id ? 'bg-yippie text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                          >
                            {m.full_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ←
                  </button>
                  <span>{page + 1} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    →
                  </button>
                </div>
              )}
            </div>


            <div className="flex flex-col gap-3 min-h-[200px]">
              {pageDrafts.length === 0 && (assignedToMe || assignedToUser) && (
                <AllCaughtUp />
              )}
              {pageDrafts.map((d: any, index: number) => {
                const isFollowUp = d.status === 'approved' && d.follow_up_at
                const followUpDate = isFollowUp ? new Date(d.follow_up_at) : null
                const isUrgent = followUpDate && (followUpDate.getTime() - Date.now()) <= 24 * 60 * 60 * 1000
                const isSelected = selected.has(d.id)
                const isFocused = focusedIdx === index
                return (
                  <div
                    key={d.id}
                    className="border flex items-start gap-3 transition-all p-4"
                    style={{
                      borderRadius: 'var(--radius-md)',
                      borderColor: isFocused ? 'var(--brand)' : isSelected ? 'var(--brand-ring)' : 'var(--border-default)',
                      background: isSelected ? 'rgba(91,164,245,0.08)' : '#fff',
                      boxShadow: isFocused ? 'var(--ring-brand)' : 'var(--shadow-sm)',
                    }}
                    onContextMenu={e => ctx.open(e, [
                      { header: d.sender_name || d.sender },
                      { label: 'Assign to me', icon: <UserPlus size={14} />, onClick: () => assignDraftMutation.mutate({ id: d.id, userId: user!.id }) },
                      {
                        label: 'Assign to…',
                        icon: <User size={14} />,
                        submenu: inboxTeamMembers.map((m: any) => ({
                          label: m.full_name,
                          onClick: () => assignDraftMutation.mutate({ id: d.id, userId: m.id }),
                        })),
                      },
                      {
                        label: 'Assign to department…',
                        icon: <Building2 size={14} />,
                        submenu: allDepartments.map((dept: any) => ({
                          label: dept.name,
                          onClick: () => routeDraftMutation.mutate({ id: d.id, departmentId: dept.id }),
                        })),
                      },
                      { separator: true },
                      { label: 'Approve & create ticket', icon: <Check size={14} />, onClick: () => reviewMutation.mutate({ id: d.id, action: 'approve' }) },
                      { separator: true },
                      { label: 'Reject', icon: <XCircle size={14} />, danger: true, onClick: () => reviewMutation.mutate({ id: d.id, action: 'reject' }) },
                    ])}
                  >
                    {/* Checkbox — desktop only */}
                    <span className="hidden md:block shrink-0 mt-0.5">
                      <Checkbox
                        checked={isSelected}
                        onChange={e => { e.preventDefault(); toggleSelect(d.id) }}
                        ariaLabel={`Select ${d.ai_suggested_subject}`}
                      />
                    </span>

                    {/* Card content — full click area links to draft */}
                    <Link
                      to={`/inbox/drafts/${d.id}?mailbox=${mailbox}`}
                      className="flex-1 min-w-0 flex items-start gap-3 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          {d.assigned_to && memberMap[d.assigned_to] && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold shrink-0" style={{ color: 'var(--brand)' }}>
                              <User size={11} />
                              {memberMap[d.assigned_to]}
                            </span>
                          )}
                          {SOURCE_ICON[d.source] ?? <Mail size={13} className="text-slate-400" />}
                          <span className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors text-sm">{d.ai_suggested_subject}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${PRIORITY_STYLES[d.ai_suggested_priority]}`}>
                            {d.ai_suggested_priority}
                          </span>
                          {d.ai_status === 'queued' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-600 animate-pulse">
                              <Sparkles size={11} />
                              Analyzing…
                            </span>
                          )}
                          {d.ai_suggested_category && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                              {d.ai_suggested_category}
                            </span>
                          )}
                          {d.forwarded_to_department_id && deptNameMap[d.forwarded_to_department_id] && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700">
                              <Building2 size={10} />
                              {deptNameMap[d.forwarded_to_department_id]}
                            </span>
                          )}
                          {d.status !== 'pending' && (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[d.status] ?? 'bg-slate-100 text-slate-600'}`}>
                              {d.status}
                            </span>
                          )}
                          {isFollowUp && (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isUrgent ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                              {isUrgent ? '⚠ Follow-up due' : 'Follow-up'}
                            </span>
                          )}
                        </div>
                        {d.inbound_subject && d.inbound_subject !== d.ai_suggested_subject && (
                          <p className="text-xs text-slate-400 mb-0.5 truncate">
                            Subject: {d.inbound_subject}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 mb-1 line-clamp-2">
                          {d.ai_suggested_description?.slice(0, 120)}…
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(d.created_at).toLocaleString()}
                          {d.inbound_to && <span className="ml-2">· to {d.inbound_to}</span>}
                        </p>
                      </div>
                      <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-0.5" />
                    </Link>
                  </div>
                )
              })}
            </div>

            {/* Pagination — only when the list overflows one page */}
            {visibleDrafts.length > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-4 mt-5">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <span className="text-xs text-slate-500 font-medium">
                  Page {safePage + 1} of {pageCount}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                  disabled={safePage >= pageCount - 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showCompose && (
        <ComposeModal
          onClose={() => { setShowCompose(false); setComposeInitial(null) }}
          aiEnabled={aiEnabled}
          marketingEnabled={marketingEnabled}
          onSendQueued={handleSendQueued}
          initialState={composeInitial}
        />
      )}

      {showAssignModal && (
        <AssignModal
          ids={Array.from(selected)}
          onClose={() => setShowAssignModal(false)}
          onDone={() => { setSelected(new Set()); setShowAssignModal(false) }}
        />
      )}

      {/* Sent mail body modal — for tracking-path OutboundEmail items */}
      {selectedSentItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 truncate pr-2">
                {selectedSentItem.subject ?? '(no subject)'}
              </h2>
              <button onClick={() => setSelectedSentItem(null)} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="text-xs text-slate-500 flex flex-wrap gap-3">
                <span>To: <strong className="text-slate-700">{selectedSentItem.to_email}</strong></span>
                <span>{new Date(selectedSentItem.created_at).toLocaleString()}</span>
                {statusBadge(selectedSentItem.status)}
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 max-h-64 overflow-y-auto">
                {selectedSentItem.body
                  ? <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{selectedSentItem.body}</p>
                  : <p className="text-sm text-slate-400 italic">Body not available for this email</p>
                }
              </div>
              {selectedSentItem.kind === 'reply' && selectedSentItem.draft_id && (
                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <Link
                    to={`/inbox/drafts/${selectedSentItem.draft_id}`}
                    onClick={() => setSelectedSentItem(null)}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    View original email →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Undo bar — shown after compose send, outside the modal */}
      {pendingCompose && (
        <div className="fixed bottom-5 right-5 z-[60] bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-bold text-slate-900 text-sm">Yippie</p>
              <p className="text-xs text-slate-400">sending to {pendingCompose.recipientCount} recipient{pendingCompose.recipientCount !== 1 ? 's' : ''}…</p>
            </div>
            <button
              onClick={handleUndoCompose}
              className="px-3 py-1.5 text-xs font-semibold text-red-500 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
            >
              Undo
            </button>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-yippie rounded-full"
              style={{ width: `${undoProgress}%`, transition: 'width 0.1s linear' }}
            />
          </div>
        </div>
      )}
      <ContextMenu state={ctx.state} onClose={ctx.close} />
    </div>
  )
}
