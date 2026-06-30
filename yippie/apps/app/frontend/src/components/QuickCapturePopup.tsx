import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, Loader2, Settings, User, Ticket, X, Check } from 'lucide-react'
import { api } from '../api/client'
import { useAuth, type JarvisPrefs, type User as AuthUser } from '../auth/useAuth'
import { useQuickCapture } from '../hooks/useQuickCapture'

interface CaptureResponse {
  action_taken: string
  summary: string
  navigate_to?: string | null
  inline_data?: Record<string, any> | null
}

const ACTION_OPTIONS: { key: string; label: string }[] = [
  { key: 'reminder', label: 'Reminders' },
  { key: 'contact_note', label: 'Contact notes' },
  { key: 'ticket_note', label: 'Ticket notes' },
  { key: 'context_query', label: 'Context lookup' },
]

const DEFAULT_HOTKEY = '⌘K / Ctrl+K'

const REMINDER_WS_URL = '/api/v1/chat/ws/agent'

function useReminderSocket(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return
    let ws: WebSocket | null = null
    let reconnect: ReturnType<typeof setTimeout>
    let destroyed = false
    let retries = 0

    function connect() {
      if (destroyed) return
      const token = localStorage.getItem('access_token')
      if (!token) return
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${location.host}${REMINDER_WS_URL}?token=${encodeURIComponent(token)}`)

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

export default function QuickCapturePopup() {
  const { isOpen, close, context, clearContext } = useQuickCapture()
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CaptureResponse | null>(null)
  const [showPrefs, setShowPrefs] = useState(false)

  useReminderSocket(user?.id)

  useEffect(() => {
    if (!isOpen) {
      setBody('')
      setResult(null)
      setShowPrefs(false)
      setLoading(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  async function submit() {
    const text = body.trim()
    if (!text || loading) return
    setLoading(true)
    setResult(null)
    try {
      const { data } = await api.post<CaptureResponse>('/jarvis/capture', {
        body: text,
        context_type: context.context_type,
        context_id: context.context_id,
      })
      if (data.action_taken === 'navigate' && data.navigate_to) {
        navigate(data.navigate_to)
        close()
        return
      }
      setResult(data)
      if (['reminder', 'contact_note', 'ticket_note'].includes(data.action_taken)) {
        setTimeout(() => close(), 2000)
      }
    } catch (e: any) {
      setResult({
        action_taken: 'error',
        summary: e?.response?.data?.detail ?? 'Something went wrong.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-[420px] rounded-xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        {context.context_type === 'contact' ? (
          <button onClick={clearContext} title="Clear context"
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
            <User size={12} /> Contact <X size={11} className="opacity-60" />
          </button>
        ) : context.context_type === 'ticket' ? (
          <button onClick={clearContext} title="Clear context"
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
            <Ticket size={12} /> Ticket <X size={11} className="opacity-60" />
          </button>
        ) : (
          <span className="text-xs font-semibold text-slate-400">Yip</span>
        )}
        <div className="flex items-center gap-1">
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
            placeholder="Capture a note, reminder, or jump to…"
            className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
          <button onClick={submit} disabled={loading || !body.trim()} title="Send"
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-yippie text-white hover:opacity-90 disabled:opacity-40 transition-opacity">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          </button>
        </div>
      </div>

      {showPrefs && <PrefsPanel user={user} refreshUser={refreshUser} onClose={() => setShowPrefs(false)} />}

      {result && !showPrefs && (
        <div className="px-4 pb-4">
          {result.action_taken === 'context_query' && result.inline_data ? (
            <ContextCard data={result.inline_data} summary={result.summary} onDone={close} />
          ) : result.action_taken === 'error' ? (
            <p className="text-sm text-red-600">{result.summary}</p>
          ) : (
            <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <Check size={15} className="mt-0.5 shrink-0" />
              <span>{result.summary}</span>
            </div>
          )}
        </div>
      )}
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
  const [saving, setSaving] = useState(false)

  function toggle(key: string) {
    setEnabled(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  async function save() {
    setSaving(true)
    try {
      const payload: JarvisPrefs = { hotkey_display: hotkey, enabled_actions: enabled }
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
      <button onClick={save} disabled={saving}
        className="self-start bg-yippie hover:opacity-90 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-opacity">
        {saving ? 'Saving…' : 'Save preferences'}
      </button>
    </div>
  )
}
