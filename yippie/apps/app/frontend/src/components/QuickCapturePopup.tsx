import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, Check, History, Loader2, Plus, Settings, Ticket, User, X, BotMessageSquare } from 'lucide-react'
import { api } from '../api/client'
import { streamCapture } from '../api/jarvisStream'
import { useAuth, type JarvisPrefs, type User as AuthUser } from '../auth/useAuth'
import { useQuickCapture, openQuickCapture } from '../hooks/useQuickCapture'
import { useCompose } from '../hooks/useCompose'

interface CtaAction {
  label: string
  kind: 'navigate' | 'compose'
  path?: string
  email?: string
  name?: string
}

interface CaptureResponse {
  action_taken: string
  summary: string
  navigate_to?: string | null
  inline_data?: Record<string, any> | null
  actions?: CtaAction[] | null
  thread_id?: string | null
}

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  data?: CaptureResponse | null
  // [YIP-STREAM] the in-flight assistant bubble tokens stream into
  streaming?: boolean
  status?: string | null
}

interface ThreadSummary {
  id: string
  title?: string | null
  kind: string
  updated_at: string
}

interface ThreadMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  action_taken?: string | null
  inline_data?: Record<string, any> | null
  actions?: CtaAction[] | null
}

// [YIP3] a write action Yip proposed — executed via /jarvis/confirm on Confirm
interface PendingAction {
  tool: string
  args: Record<string, any>
  title: string
  details: { label: string; value: string }[]
}

const ACTION_OPTIONS: { key: string; label: string }[] = [
  { key: 'reminder', label: 'Reminders' },
  { key: 'contact_note', label: 'Contact notes' },
  { key: 'ticket_note', label: 'Ticket notes' },
  { key: 'context_query', label: 'Context lookup' },
]

const DEFAULT_HOTKEY = '⌘K / Ctrl+K'

const REMINDER_WS_URL = '/api/v1/chat/ws/agent'

// [YIP-STREAM] friendly labels for status events while a tool runs
const STATUS_LABELS: Record<string, string> = {
  search_contacts: 'Searching contacts…',
  get_contact_briefing: 'Pulling up the contact…',
  search_tickets: 'Searching tickets…',
  list_open_tickets: 'Checking open tickets…',
  get_ticket_thread: 'Reading the ticket thread…',
  draft_reply: 'Drafting a reply…',
  track_shipments: 'Tracking shipments…',
  list_calendar_events: 'Checking the calendar…',
  create_reminder: 'Setting the reminder…',
  add_contact_note: 'Saving the note…',
  add_ticket_note: 'Saving the note…',
  open_page: 'Navigating…',
  compose_email: 'Opening compose…',
  get_platform_manual: 'Consulting the manual…',
  save_memory: 'Remembering that…',
  list_pending_drafts: 'Checking the inbox…',
  list_waiting_chats: 'Checking live chat…',
  check_email_engagement: 'Checking email engagement…',
  get_ticket_stats: 'Crunching ticket stats…',
  get_revenue_summary: 'Calculating revenue…',
  list_todays_bookings: "Checking today's agenda…",
  create_ticket: 'Preparing the ticket…',
  update_ticket: 'Preparing the change…',
  create_contact: 'Preparing the contact…',
  create_calendar_event: 'Preparing the event…',
  move_pipeline_stage: 'Preparing the move…',
}

function useReminderSocket(userId: string | undefined, navigate: (path: string) => void) {
  useEffect(() => {
    if (!userId) return
    let ws: WebSocket | null = null
    let reconnect: ReturnType<typeof setTimeout>
    let destroyed = false
    let retries = 0

    function connect() {
      if (destroyed) return
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${location.host}${REMINDER_WS_URL}`)

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'ping') { ws?.send(JSON.stringify({ type: 'pong' })); return }
          if (data.type === 'jarvis_reminder' && data.user_id === userId) {
            toast.warning(data.body, {
              duration: 10000,
              action: {
                label: 'Dismiss',
                onClick: () => api.patch(`/jarvis/reminders/${data.reminder_id}/dismiss`).catch(() => {}),
              },
            })
          }
          // [YIP5] morning briefing ready — opening the popup lands on it
          if (data.type === 'jarvis_briefing' && data.user_id === userId) {
            toast.info(data.body || 'Your morning briefing is ready', {
              duration: 15000,
              action: { label: 'Open', onClick: () => openQuickCapture() },
            })
          }
          // [YIP5] SLA near breach nudge — assigned user, or everyone when unassigned
          if (data.type === 'jarvis_sla_nudge' && (data.user_id === userId || data.user_id == null)) {
            const mins = data.due_in_minutes
            toast.warning(`SLA deadline in ${mins} min: ${data.subject}`, {
              duration: 15000,
              action: data.ticket_id
                ? { label: 'Open ticket', onClick: () => navigate(`/tickets/${data.ticket_id}`) }
                : undefined,
            })
          }
        } catch { /* ignore malformed frames */ }
      }

      ws.onclose = () => {
        if (destroyed || retries >= 5) return
        retries += 1
        reconnect = setTimeout(connect, 2000 * retries)
      }
    }

    connect()
    return () => { destroyed = true; clearTimeout(reconnect); ws?.close() }
  }, [userId])
}

// [YIP-STREAM] helpers for the single in-flight streaming bubble
function updateStreaming(list: ChatMsg[], fn: (m: ChatMsg) => ChatMsg): ChatMsg[] {
  const idx = list.findIndex(m => m.streaming)
  if (idx === -1) return list
  const next = [...list]
  next[idx] = fn(next[idx])
  return next
}

function replaceStreaming(list: ChatMsg[], msg: ChatMsg): ChatMsg[] {
  const idx = list.findIndex(m => m.streaming)
  if (idx === -1) return [...list, msg]
  const next = [...list]
  next[idx] = msg
  return next
}

function removeStreaming(list: ChatMsg[]): ChatMsg[] {
  return list.filter(m => !m.streaming)
}

function threadMessageToChatMsg(m: ThreadMessage): ChatMsg {
  // Historical confirm cards must not offer Confirm again — show as plain text.
  const action = m.action_taken === 'confirm_action' ? 'answer' : (m.action_taken ?? 'answer')
  return {
    role: m.role,
    content: m.content,
    data: m.role === 'assistant'
      ? { action_taken: action, summary: m.content, inline_data: m.inline_data ?? null, actions: m.actions ?? null }
      : null,
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export default function QuickCapturePopup() {
  const { isOpen, close, context, clearContext } = useQuickCapture()
  const { user, refreshUser } = useAuth()
  const { openCompose } = useCompose()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [showPrefs, setShowPrefs] = useState(false)
  // [YIP-STREAM] server side threads — the conversation survives closing the popup
  const [threadId, setThreadId] = useState<string | null>(null)
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [showThreads, setShowThreads] = useState(false)

  useReminderSocket(user?.id, navigate)

  useEffect(() => {
    if (!isOpen) {
      setBody('')
      setShowPrefs(false)
      setShowThreads(false)
      // A stream in flight keeps running server side and lands in the thread.
      abortRef.current?.abort()
      abortRef.current = null
      setMessages(prev => removeStreaming(prev))
      setLoading(false)
    }
  }, [isOpen])

  // [YIP-STREAM] first open: resume the most recent conversation
  useEffect(() => {
    if (!isOpen || threadId || messages.length) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: ths } = await api.get<ThreadSummary[]>('/jarvis/threads')
        if (cancelled) return
        setThreads(ths)
        const latest = ths[0]
        if (!latest) return
        const { data: msgs } = await api.get<ThreadMessage[]>(`/jarvis/threads/${latest.id}/messages`)
        if (cancelled) return
        setThreadId(latest.id)
        setMessages(msgs.map(threadMessageToChatMsg))
      } catch { /* start fresh */ }
    })()
    return () => { cancelled = true }
  }, [isOpen])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  if (!isOpen) return null

  function appendMessage(m: ChatMsg) {
    setMessages(prev => [...prev, m])
  }

  function handleAction(action: CtaAction) {
    if (action.kind === 'navigate' && action.path) {
      navigate(action.path)
      close()
    } else if (action.kind === 'compose' && action.email) {
      openCompose({ recipients: [{ email: action.email, label: action.name || action.email }], subject: '', body: '', fromEmail: null })
      close()
    }
  }

  function startNewThread() {
    if (loading) return
    setThreadId(null)
    setMessages([])
    setShowThreads(false)
    inputRef.current?.focus()
  }

  async function openThread(id: string) {
    if (loading) return
    try {
      const { data: msgs } = await api.get<ThreadMessage[]>(`/jarvis/threads/${id}/messages`)
      setThreadId(id)
      setMessages(msgs.map(threadMessageToChatMsg))
      setShowThreads(false)
    } catch {
      toast.error('Could not load that conversation')
    }
  }

  async function toggleThreads() {
    const next = !showThreads
    setShowThreads(next)
    if (next) {
      try {
        const { data: ths } = await api.get<ThreadSummary[]>('/jarvis/threads')
        setThreads(ths)
      } catch { /* keep whatever we had */ }
    }
  }

  function finishResponse(data: CaptureResponse) {
    if (data.thread_id) setThreadId(data.thread_id)
    if (data.action_taken === 'navigate' && data.navigate_to) {
      setMessages(prev => removeStreaming(prev))
      navigate(data.navigate_to)
      close()
      return
    }
    if (data.action_taken === 'compose_email' && data.inline_data?.email) {
      setMessages(prev => removeStreaming(prev))
      openCompose({ recipients: [{ email: data.inline_data.email, label: data.inline_data.name || data.inline_data.email }], subject: '', body: '', fromEmail: null })
      close()
      return
    }
    if (data.action_taken === 'draft_reply' && data.inline_data?.email) {
      // [YIP2] Yip drafted a reply — open compose prefilled; human reviews and sends.
      setMessages(prev => removeStreaming(prev))
      openCompose({
        recipients: [{ email: data.inline_data.email, label: data.inline_data.name || data.inline_data.email }],
        subject: data.inline_data.subject || '',
        body: data.inline_data.body || '',
        fromEmail: null,
      })
      close()
      return
    }
    setMessages(prev => replaceStreaming(prev, { role: 'assistant', content: data.summary, data }))
  }

  async function submit() {
    const text = body.trim()
    if (!text || loading) return
    // Legacy fallback history — the server derives history from the thread when
    // thread_id is set ([YIP-STREAM]).
    const history = threadId ? [] : messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '', streaming: true, status: 'Yip is thinking…' },
    ])
    setBody('')
    setLoading(true)

    const payload = {
      body: text,
      context_type: context.context_type,
      context_id: context.context_id,
      route: window.location.pathname,
      history,
      thread_id: threadId,
    }
    const abort = new AbortController()
    abortRef.current = abort
    let terminal = false

    try {
      await streamCapture(payload, {
        onThread: id => setThreadId(id),
        onStatus: tool => setMessages(prev => updateStreaming(prev, m => ({
          // Providers may stream preamble text before calling tools — discard it;
          // the terminal result is authoritative.
          ...m, content: '', status: STATUS_LABELS[tool] ?? 'Working…',
        }))),
        onDelta: t => setMessages(prev => updateStreaming(prev, m => ({
          ...m, status: null, content: m.content + t,
        }))),
        onResult: data => { terminal = true; finishResponse(data) },
        onError: detail => {
          terminal = true
          setMessages(prev => replaceStreaming(prev, {
            role: 'assistant', content: detail, data: { action_taken: 'error', summary: '' },
          }))
        },
      }, abort.signal)
    } catch {
      if (abort.signal.aborted) return
      if (!terminal) {
        // Transport failed before the agent ran — safe to fall back to JSON.
        try {
          const { data } = await api.post<CaptureResponse>('/jarvis/capture', payload)
          finishResponse(data)
        } catch (e: any) {
          setMessages(prev => replaceStreaming(prev, {
            role: 'assistant',
            content: e?.response?.data?.detail ?? 'Something went wrong.',
            data: { action_taken: 'error', summary: '' },
          }))
        }
      }
    } finally {
      if (!abort.signal.aborted) {
        setLoading(false)
        abortRef.current = null
        inputRef.current?.focus()
      }
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-[420px] rounded-xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <BotMessageSquare size={14} className="text-yippie" />
            Yip
          </span>
          {context.context_type === 'contact' && (
            <button onClick={clearContext} title="Clear context"
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
              <User size={12} /> Contact <X size={11} className="opacity-60" />
            </button>
          )}
          {context.context_type === 'ticket' && (
            <button onClick={clearContext} title="Clear context"
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
              <Ticket size={12} /> Ticket <X size={11} className="opacity-60" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={startNewThread} title="New conversation"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <Plus size={15} />
          </button>
          <button onClick={toggleThreads} title="Recent conversations"
            className={`p-1.5 rounded-lg transition-colors ${showThreads ? 'text-yippie bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
            <History size={15} />
          </button>
          <button onClick={() => setShowPrefs(s => !s)} title="Preferences"
            className={`p-1.5 rounded-lg transition-colors ${showPrefs ? 'text-yippie bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
            <Settings size={15} />
          </button>
          <button onClick={close} title="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={15} />
          </button>
        </div>
      </div>

      {showThreads && !showPrefs && (
        <div className="px-4 pb-2 max-h-[240px] overflow-y-auto flex flex-col gap-1">
          {threads.length === 0 && (
            <p className="text-xs text-slate-400 px-1 py-2">No conversations yet.</p>
          )}
          {threads.map(t => (
            <button key={t.id} onClick={() => openThread(t.id)}
              className={`flex items-center justify-between gap-2 text-left px-2.5 py-2 rounded-lg text-sm transition-colors ${t.id === threadId ? 'bg-blue-50 text-blue-800' : 'hover:bg-slate-50 text-slate-700'}`}>
              <span className="truncate">
                {t.kind === 'briefing' ? '☀️ ' : ''}{t.title || 'New conversation'}
              </span>
              <span className="shrink-0 text-[11px] text-slate-400">{relativeTime(t.updated_at)}</span>
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && !showPrefs && !showThreads && (
        <div className="px-4 pb-2 max-h-[360px] overflow-y-auto flex flex-col gap-2">
          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} onDone={close} onAction={handleAction} append={appendMessage} threadId={threadId} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            autoFocus
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); submit() }
              else if (e.key === 'Escape') { e.preventDefault(); close() }
            }}
            placeholder={messages.length ? 'Reply to Yip…' : 'Ask Yip anything — notes, reminders, lookups…'}
            className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
          <button onClick={submit} disabled={loading || !body.trim()} title="Send"
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-yippie text-white hover:opacity-90 disabled:opacity-40 transition-opacity">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          </button>
        </div>
      </div>

      {showPrefs && <PrefsPanel user={user} refreshUser={refreshUser} onClose={() => setShowPrefs(false)} />}
    </div>
  )
}

function CtaRow({ actions, onAction }: { actions?: CtaAction[] | null; onAction: (a: CtaAction) => void }) {
  if (!actions?.length) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {actions.map((a, i) => (
        <button key={i} onClick={() => onAction(a)}
          className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white border border-yippie/40 text-yippie hover:bg-blue-50 transition-colors">
          {a.label}
        </button>
      ))}
    </div>
  )
}

// [YIP3] Proposal card for a write action — the write only runs when the user
// presses Confirm, which posts the staged payload to /jarvis/confirm.
function ConfirmActionCard({ pending, append, threadId }: { pending: PendingAction; append: (m: ChatMsg) => void; threadId: string | null }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'cancelled'>('idle')

  async function confirmPending() {
    if (status !== 'idle') return
    setStatus('loading')
    try {
      const { data } = await api.post<CaptureResponse>('/jarvis/confirm', { tool: pending.tool, args: pending.args, thread_id: threadId })
      setStatus('done')
      append({ role: 'assistant', content: data.summary, data })
    } catch (e: any) {
      setStatus('idle')
      append({
        role: 'assistant',
        content: e?.response?.data?.detail ?? 'That action failed. Nothing was changed.',
        data: { action_taken: 'error', summary: '' },
      })
    }
  }

  function cancel() {
    if (status !== 'idle') return
    setStatus('cancelled')
    append({ role: 'assistant', content: 'Cancelled. Nothing was changed.', data: { action_taken: 'answer', summary: '' } })
  }

  return (
    <div className="bg-blue-50/60 border border-yippie/30 rounded-lg p-3 flex flex-col gap-2">
      <p className="text-sm font-semibold text-slate-800">{pending.title}</p>
      {pending.details?.length > 0 && (
        <div className="flex flex-col gap-1">
          {pending.details.map((d, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide w-20 shrink-0 pt-0.5">{d.label}</span>
              <span className="text-slate-700 min-w-0 break-words">{d.value}</span>
            </div>
          ))}
        </div>
      )}
      {status === 'done' ? (
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700"><Check size={15} /> Confirmed</p>
      ) : status === 'cancelled' ? (
        <p className="text-sm font-semibold text-slate-400">Cancelled</p>
      ) : (
        <div className="flex gap-2">
          <button onClick={confirmPending} disabled={status === 'loading'}
            className="inline-flex items-center gap-1.5 bg-yippie hover:opacity-90 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-opacity">
            {status === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Confirm
          </button>
          <button onClick={cancel} disabled={status === 'loading'}
            className="bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors">
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

function MessageBubble({ msg, onDone, onAction, append, threadId }: {
  msg: ChatMsg; onDone: () => void; onAction: (a: CtaAction) => void; append: (m: ChatMsg) => void; threadId: string | null
}) {
  if (msg.role === 'user') {
    return (
      <div className="self-end max-w-[85%] bg-yippie text-white text-sm rounded-2xl rounded-br-sm px-3 py-2">
        {msg.content}
      </div>
    )
  }

  // [YIP-STREAM] the in-flight bubble: status line, then tokens as they arrive
  if (msg.streaming) {
    if (!msg.content) {
      return (
        <div className="self-start inline-flex items-center gap-2 text-xs text-slate-400 px-3 py-2">
          <Loader2 size={13} className="animate-spin" /> {msg.status || 'Yip is thinking…'}
        </div>
      )
    }
    return (
      <div className="self-start max-w-[85%] bg-slate-100 text-slate-800 text-sm rounded-2xl rounded-bl-sm px-3 py-2 whitespace-pre-wrap">
        {msg.content}
        <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-slate-400 animate-pulse rounded-sm" />
      </div>
    )
  }

  const action = msg.data?.action_taken
  if (action === 'error') {
    return (
      <p className="self-start max-w-[85%] text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {msg.content}
      </p>
    )
  }
  if (action === 'math') {
    return (
      <div className="self-start bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-center">
        <p className="text-2xl font-bold text-blue-700">{msg.content}</p>
      </div>
    )
  }
  if (action === 'context_query' && msg.data?.inline_data) {
    return (
      <div className="self-start w-full">
        <ContextCard data={msg.data.inline_data} summary={msg.content} onDone={onDone} />
        <CtaRow actions={msg.data?.actions} onAction={onAction} />
      </div>
    )
  }
  if (action === 'confirm_action' && msg.data?.inline_data) {
    // [YIP3] Yip proposed a write action — nothing happens until Confirm.
    return (
      <div className="self-start w-full">
        {msg.content && (
          <div className="bg-slate-100 text-slate-800 text-sm rounded-2xl rounded-bl-sm px-3 py-2 whitespace-pre-wrap mb-1.5">
            {msg.content}
          </div>
        )}
        <ConfirmActionCard pending={msg.data.inline_data as PendingAction} append={append} threadId={threadId} />
      </div>
    )
  }
  if (action && ['reminder', 'contact_note', 'ticket_note', 'write_done'].includes(action)) {
    return (
      <div className="self-start max-w-[85%]">
        <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <Check size={15} className="mt-0.5 shrink-0" />
          <span>{msg.content}</span>
        </div>
        <CtaRow actions={msg.data?.actions} onAction={onAction} />
      </div>
    )
  }
  return (
    <div className="self-start max-w-[85%]">
      <div className="bg-slate-100 text-slate-800 text-sm rounded-2xl rounded-bl-sm px-3 py-2 whitespace-pre-wrap">
        {msg.content}
      </div>
      <CtaRow actions={msg.data?.actions} onAction={onAction} />
    </div>
  )
}

function ContextCard({ data, summary, onDone }: {
  data: Record<string, any>; summary: string; onDone: () => void
}) {
  const [form, setForm] = useState({
    full_name: data.full_name ?? '',
    email: data.email ?? '',
    phone: data.phone ?? '',
    notes: data.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  async function save() {
    if (!data.contact_id) return
    setSaving(true)
    try {
      await api.patch(`/contacts/${data.contact_id}`, {
        full_name: form.full_name.trim() || undefined,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      })
      setSaved(true)
    } catch {
      toast.error('Failed to save contact')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie'
  const labelCls = 'block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1'

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col gap-2.5">
      <p className="text-sm text-slate-600 leading-snug">{summary}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className={labelCls}>Name</label>
          <input className={inputCls} value={form.full_name} onChange={set('full_name')} />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input className={inputCls} value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input className={inputCls} value={form.phone} onChange={set('phone')} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Notes</label>
          <textarea className={`${inputCls} resize-vertical min-h-[56px]`} value={form.notes} onChange={set('notes')} />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving}
          className="bg-yippie hover:opacity-90 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-opacity">
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
        <button onClick={onDone}
          className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors">
          Done
        </button>
      </div>
    </div>
  )
}

function PrefsPanel({ user, refreshUser, onClose }: {
  user: AuthUser | null; refreshUser: () => Promise<void>; onClose: () => void
}) {
  const prefs = user?.jarvis_prefs
  const [hotkey, setHotkey] = useState(prefs?.hotkey_display ?? DEFAULT_HOTKEY)
  const [enabled, setEnabled] = useState<string[]>(
    prefs?.enabled_actions ?? ACTION_OPTIONS.map(a => a.key),
  )
  // [YIP5] morning briefing preferences — enabled by default at 08:00 local
  const [briefingEnabled, setBriefingEnabled] = useState(prefs?.briefing_enabled ?? true)
  const [briefingTime, setBriefingTime] = useState(prefs?.briefing_time ?? '08:00')
  const [saving, setSaving] = useState(false)

  function toggle(key: string) {
    setEnabled(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  async function save() {
    setSaving(true)
    try {
      const payload: JarvisPrefs = {
        hotkey_display: hotkey,
        enabled_actions: enabled,
        briefing_enabled: briefingEnabled,
        briefing_time: briefingTime,
      }
      await api.patch('/auth/me', { jarvis_prefs: payload })
      await refreshUser()
      onClose()
    } catch {
      toast.error('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  const labelCls = 'block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1'

  return (
    <div className="border-t border-slate-100 px-4 py-3 flex flex-col gap-3">
      <div>
        <label className={labelCls}>Hotkey</label>
        <input
          value={hotkey}
          onChange={e => setHotkey(e.target.value)}
          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
        />
      </div>
      <div>
        <label className={labelCls}>Enabled actions</label>
        <div className="flex flex-col gap-1.5">
          {ACTION_OPTIONS.map(opt => (
            <label key={opt.key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled.includes(opt.key)}
                onChange={() => toggle(opt.key)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-yippie/30 cursor-pointer"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className={labelCls}>Morning briefing</label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={briefingEnabled}
              onChange={() => setBriefingEnabled(v => !v)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-yippie/30 cursor-pointer"
            />
            Daily digest at
          </label>
          <input
            type="time"
            value={briefingTime}
            disabled={!briefingEnabled}
            onChange={e => setBriefingTime(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded-lg text-sm text-slate-900 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
        </div>
      </div>
      <button onClick={save} disabled={saving}
        className="self-start bg-yippie hover:opacity-90 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-opacity">
        {saving ? 'Saving…' : 'Save preferences'}
      </button>
    </div>
  )
}
