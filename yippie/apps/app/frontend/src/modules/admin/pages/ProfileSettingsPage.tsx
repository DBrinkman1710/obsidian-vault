import { useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Star, ChevronUp, ChevronDown, Image as ImageIcon, Pencil, Check, X, Download, RefreshCw, Copy, Link, Unlink } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { useSignatures, readSignatureImage, signatureImageTag, type Signature } from '../../../hooks/useSignatures'
import { EmailAccountsCard } from '../../inbox/components/EmailAccountsCard'
import { useCopy } from '../../../hooks/useCopy'

export default function ProfileSettingsPage() {
  const { user, refreshUser } = useAuth()
  const [personalEmail, setPersonalEmail] = useState(user?.inbound_email ?? user?.reply_from_email ?? '')
  const [hotkeysEnabled, setHotkeysEnabled] = useState(user?.hotkeys_enabled !== false)
  const [personalWorkMode, setPersonalWorkMode] = useState(user?.shared_inbox_disabled === true)
  const [helpTipsEnabled, setHelpTipsEnabled] = useState(user?.help_tips_enabled !== false)
  const [uiLanguage, setUiLanguage] = useState<string>(user?.ui_language ?? 'en')
  const [aliases, setAliases] = useState<string[]>(user?.send_from_aliases ?? [])
  const [newAlias, setNewAlias] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [downloadingManual, setDownloadingManual] = useState(false)

  async function handleDownloadManual() {
    setDownloadingManual(true)
    try {
      const res = await api.get('/auth/manual.pdf', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'yippie-platform-manual.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingManual(false)
    }
  }

  const mutation = useMutation({
    // One personal address does both: outbound "from" and inbound routing
    mutationFn: () => api.patch('/auth/me', {
      reply_from_email: personalEmail.trim() || null,
      inbound_email: personalEmail.trim() || null,
      hotkeys_enabled: hotkeysEnabled,
      shared_inbox_disabled: personalWorkMode,
      help_tips_enabled: helpTipsEnabled,
      ui_language: uiLanguage,
      send_from_aliases: aliases.length > 0 ? aliases : [],
    }).then((r: any) => r.data),
    onSuccess: async () => {
      await refreshUser()
      window.location.reload()
    },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to save. Try again.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaved(false)
    setError('')
    mutation.mutate()
  }

  return (
    <div>
      <h1 className="heading-xl text-slate-900 mb-1">Profile</h1>
      <p className="text-sm text-slate-500 mb-8">Manage your personal email address, signature and password.</p>

      <div className="flex items-stretch gap-8">
        {/* Main form: email + personal address + signature + hotkeys */}
        <form onSubmit={handleSubmit} className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
            <p className="text-sm text-slate-700">{user?.email}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Personal email address</label>
            <input
              type="email"
              value={personalEmail}
              onChange={e => setPersonalEmail(e.target.value)}
              placeholder="e.g. eddy@getyippie.com"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
            />
            <p className="mt-1.5 text-xs text-slate-400">
              One address for both directions: mail sent to it lands in your Personal inbox, and you can pick it as the "From" address when replying or composing. You can also connect this address with OAuth (Gmail or Outlook) instead. Contact your admin at{' '}
              <a href="mailto:diederik@getyippie.com" className="text-yippie hover:underline">diederik@getyippie.com</a>{' '}to set that up.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-500">Send-from aliases</label>
            </div>
            <p className="mb-2 text-xs text-slate-400">
              Extra addresses you can pick as "From" when composing or replying. These are display labels only. Mail is delivered via your shared inbox domain.
            </p>
            <div className="space-y-1.5 mb-2">
              {aliases.map((alias, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 truncate">{alias}</span>
                  <button
                    type="button"
                    onClick={() => setAliases(aliases.filter((_, j) => j !== i))}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove alias"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={newAlias}
                onChange={e => setNewAlias(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const v = newAlias.trim()
                    if (v && !aliases.includes(v)) setAliases([...aliases, v])
                    setNewAlias('')
                  }
                }}
                placeholder="alias@example.com"
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
              />
              <button
                type="button"
                onClick={() => {
                  const v = newAlias.trim()
                  if (v && !aliases.includes(v)) setAliases([...aliases, v])
                  setNewAlias('')
                }}
                disabled={!newAlias.trim()}
                className="px-3 py-2 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <SignaturesSection />
          </div>

          <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Language</label>
              <p className="text-xs text-slate-400 max-w-sm">Choose the language for the app interface.</p>
            </div>
            <select
              value={uiLanguage}
              onChange={e => setUiLanguage(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
            >
              <option value="en">English</option>
              <option value="nl">Nederlands</option>
            </select>
          </div>

          <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Keyboard shortcuts</label>
              <p className="text-xs text-slate-400 max-w-sm">
                When on, shortcuts like <span className="font-medium text-slate-500">Cmd/Ctrl + Enter</span> to send are active. Turn off to disable all keyboard shortcuts.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={hotkeysEnabled}
              onClick={() => setHotkeysEnabled(v => !v)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${hotkeysEnabled ? 'bg-yippie' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hotkeysEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Personal work mode</label>
              <p className="text-xs text-slate-400 max-w-sm">
                When on, the shared inbox only shows mail assigned to you (or sent to your personal address). Turn off to see all of your team's incoming mail.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={personalWorkMode}
              onClick={() => setPersonalWorkMode(v => !v)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${personalWorkMode ? 'bg-yippie' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${personalWorkMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Help tips</label>
              <p className="text-xs text-slate-400 max-w-sm">
                Show contextual <span className="font-medium text-slate-500">?</span> icons throughout the app with short explanations. Turn off to hide them all.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={helpTipsEnabled}
              onClick={() => setHelpTipsEnabled(v => !v)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${helpTipsEnabled ? 'bg-yippie' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${helpTipsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary px-5 py-2"
            >
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
            {saved && <span className="text-sm text-success-600 font-medium">✓ Saved</span>}
          </div>
        </form>

        {/* Right column: password + linked accounts + calendar */}
        <div className="w-96 flex-shrink-0 flex flex-col gap-6">
          <ChangePasswordCard />
          <EmailAccountsCard level="user" />
          <div className="flex flex-col gap-6 flex-1">
            <ConnectedCalendarsCard />
            <YippieCalendarFeedCard />
          </div>
        </div>
      </div>

      {/* Platform manual download */}
      <div className="mt-10 pt-6 border-t border-slate-200 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700">Platform Manual</p>
          <p className="text-xs text-slate-400 mt-0.5">Download the latest version of the Yippie Platform Manual as a PDF.</p>
        </div>
        <button
          type="button"
          onClick={handleDownloadManual}
          disabled={downloadingManual}
          className="btn-secondary px-4 py-2"
        >
          <Download size={15} />
          {downloadingManual ? 'Generating…' : 'Download PDF'}
        </button>
      </div>
    </div>
  )
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.patch('/auth/me/password', { current_password: current, new_password: next }).then((r: any) => r.data),
    onSuccess: () => {
      setSaved(true)
      setError('')
      setCurrent(''); setNext(''); setConfirm('')
      setTimeout(() => setSaved(false), 3000)
    },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to change password.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) { setError('Passwords do not match'); return }
    setSaved(false)
    setError('')
    mutation.mutate()
  }

  const inputCls = 'input-base'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Change password</h2>
        <p className="text-xs text-slate-400 mt-0.5">At least 8 characters.</p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Current password</label>
        <input type="password" value={current} onChange={e => setCurrent(e.target.value)} className={inputCls} required />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">New password</label>
        <input type="password" value={next} onChange={e => setNext(e.target.value)} className={inputCls} required minLength={8} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Confirm new password</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} required />
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="btn-primary px-5 py-2"
        >
          {mutation.isPending ? 'Updating…' : 'Update password'}
        </button>
        {saved && <span className="text-sm text-success-600 font-medium">✓ Password updated</span>}
      </div>
    </form>
  )
}

// ── Multi-signature management (S1/S2) ──────────────────────────────────────

function SignaturesSection() {
  const qc = useQueryClient()
  const { data: signatures = [], isLoading } = useSignatures()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['signatures'] })

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; body: string }) =>
      api.post('/auth/me/signatures', payload).then((r: any) => r.data),
    onSuccess: () => { invalidate(); setAdding(false); setError('') },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Could not save signature.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; body?: string }) =>
      api.patch(`/auth/me/signatures/${id}`, payload).then((r: any) => r.data),
    onSuccess: () => { invalidate(); setEditingId(null); setError('') },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Could not save signature.'),
  })

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/auth/me/signatures/${id}`, { is_default: true }).then((r: any) => r.data),
    onSuccess: invalidate,
  })

  const reorderMutation = useMutation({
    mutationFn: ({ id, display_order }: { id: string; display_order: number }) =>
      api.patch(`/auth/me/signatures/${id}`, { display_order }).then((r: any) => r.data),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/me/signatures/${id}`),
    onSuccess: invalidate,
  })

  function move(index: number, dir: -1 | 1) {
    const target = signatures[index + dir]
    const current = signatures[index]
    if (!target || !current) return
    // Swap display_order between the two neighbours.
    reorderMutation.mutate({ id: current.id, display_order: target.display_order })
    reorderMutation.mutate({ id: target.id, display_order: current.display_order })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-semibold text-slate-500">Email signatures</label>
        {!adding && (
          <button
            type="button"
            onClick={() => { setAdding(true); setEditingId(null); setError('') }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-yippie hover:opacity-80 cursor-pointer"
          >
            <Plus size={13} /> Add signature
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-400">
        Your default signature is added automatically when you compose or reply. You can pick another from the message box.
      </p>

      {error && <p className="error-text mb-2">{error}</p>}

      {isLoading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-2">
          {signatures.length === 0 && !adding && (
            <p className="text-xs text-slate-400 italic">No signatures yet. Add one to get started.</p>
          )}

          {signatures.map((sig: any, i: any) => (
            editingId === sig.id ? (
              <SignatureEditor
                key={sig.id}
                initial={sig}
                saving={updateMutation.isPending}
                onCancel={() => { setEditingId(null); setError('') }}
                onSave={(name, body) => updateMutation.mutate({ id: sig.id, name, body })}
              />
            ) : (
              <div key={sig.id} className="flex items-start gap-3 border border-slate-200 rounded-xl px-3 py-2.5">
                <div className="flex flex-col gap-0.5 pt-0.5">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                    className="text-slate-300 hover:text-slate-500 disabled:opacity-30 disabled:cursor-default cursor-pointer" title="Move up">
                    <ChevronUp size={14} />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === signatures.length - 1}
                    className="text-slate-300 hover:text-slate-500 disabled:opacity-30 disabled:cursor-default cursor-pointer" title="Move down">
                    <ChevronDown size={14} />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 truncate">{sig.name}</span>
                    {sig.is_default && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-yippie/10 text-yippie rounded-full font-semibold">Default</span>
                    )}
                  </div>
                  <SignaturePreview body={sig.body} />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => setDefaultMutation.mutate(sig.id)} disabled={sig.is_default}
                    className={`p-1.5 rounded-lg cursor-pointer ${sig.is_default ? 'text-yippie' : 'text-slate-300 hover:text-yippie hover:bg-slate-50'}`}
                    title={sig.is_default ? 'Default signature' : 'Set as default'}>
                    <Star size={15} fill={sig.is_default ? 'currentColor' : 'none'} />
                  </button>
                  <button type="button" onClick={() => { setEditingId(sig.id); setAdding(false); setError('') }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer" title="Edit">
                    <Pencil size={15} />
                  </button>
                  <button type="button" onClick={() => { if (confirm(`Delete signature "${sig.name}"?`)) deleteMutation.mutate(sig.id) }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 cursor-pointer" title="Delete">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          ))}

          {adding && (
            <SignatureEditor
              initial={null}
              saving={createMutation.isPending}
              onCancel={() => { setAdding(false); setError('') }}
              onSave={(name, body) => createMutation.mutate({ name, body })}
            />
          )}
        </div>
      )}
    </div>
  )
}

function SignaturePreview({ body }: { body: string }) {
  // Body may contain a single inline <img data-uri>. Render images, escape the rest.
  const hasImg = /<img\s/i.test(body)
  if (hasImg) {
    return <div className="mt-1 text-xs text-slate-500 [&_img]:max-h-12 [&_img]:inline-block"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(body) }} />
  }
  return <p className="mt-1 text-xs text-slate-500 whitespace-pre-wrap line-clamp-3">{body || <span className="italic text-slate-400">Empty</span>}</p>
}

function SignatureEditor({ initial, saving, onSave, onCancel }: {
  initial: Signature | null
  saving: boolean
  onSave: (name: string, body: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [imgError, setImgError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleImage(file: File) {
    setImgError('')
    try {
      const dataUri = await readSignatureImage(file)
      setBody(prev => `${prev}${prev && !prev.endsWith('\n') ? '\n' : ''}${signatureImageTag(dataUri)}`)
    } catch (err: any) {
      setImgError(err.message ?? 'Could not add image.')
    }
  }

  return (
    <div className="border border-yippie/40 bg-yippie/5 rounded-xl p-3 space-y-2">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Signature name (e.g. Support, Sales)"
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
      />
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={4}
        placeholder={'e.g.\nBest regards,\nEddy from Support'}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie resize-y font-sans"
      />
      {/<img\s/i.test(body) && (
        <div className="px-2 py-1.5 bg-white border border-slate-100 rounded-lg text-xs text-slate-500 [&_img]:max-h-16 [&_img]:inline-block whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(body) }} />
      )}
      <div className="flex items-center justify-between gap-2">
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <ImageIcon size={13} /> Add image
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/svg+xml,image/png,image/jpeg"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f); e.target.value = '' }}
          />
          {imgError && <span className="error-text ml-2">{imgError}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
          >
            <X size={13} /> Cancel
          </button>
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={() => onSave(name.trim(), body)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-yippie text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            <Check size={13} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Connected Calendars (import: Apple / Outlook → Yippie) ───────────────────

type Feed = {
  id: string
  name: string
  ical_url: string
  last_synced_at: string | null
  last_sync_error: string | null
  is_active: boolean
  created_at: string
}

function ConnectedCalendarsCard() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [addError, setAddError] = useState('')
  const [syncingId, setSyncingId] = useState<string | null>(null)

  const { data: feeds = [], isLoading } = useQuery<Feed[]>({
    queryKey: ['external-calendars'],
    queryFn: () => api.get('/booking/external-calendars').then((r: any) => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['external-calendars'] })

  const addMutation = useMutation({
    mutationFn: (body: { name: string; ical_url: string }) =>
      api.post('/booking/external-calendars', body).then((r: any) => r.data),
    onSuccess: () => { invalidate(); setAdding(false); setName(''); setUrl(''); setAddError('') },
    onError: (err: any) => setAddError(err.response?.data?.detail ?? 'Could not add calendar.'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/booking/external-calendars/${id}`, { is_active }).then((r: any) => r.data),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/booking/external-calendars/${id}`),
    onSuccess: invalidate,
  })

  async function handleSync(id: string) {
    setSyncingId(id)
    try {
      await api.post(`/booking/external-calendars/${id}/sync`)
      invalidate()
    } finally {
      setSyncingId(null)
    }
  }

  function lastSyncLabel(feed: Feed) {
    if (feed.last_sync_error) return { text: 'Error', cls: 'text-red-500 bg-red-50' }
    if (!feed.last_synced_at) return { text: 'Never synced', cls: 'text-slate-400 bg-slate-50' }
    const mins = Math.round((Date.now() - new Date(feed.last_synced_at).getTime()) / 60000)
    const label = mins < 2 ? 'Just now' : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`
    return { text: label, cls: 'text-emerald-600 bg-emerald-50' }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold text-slate-900">Connected Calendars</h2>
        {!adding && feeds.length < 5 && (
          <button
            type="button"
            onClick={() => { setAdding(true); setAddError('') }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-yippie hover:opacity-80 cursor-pointer"
          >
            <Plus size={13} /> Add calendar
          </button>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Add iCal feed URLs from Apple Calendar or Outlook. Busy times are automatically blocked from your booking availability.
      </p>

      {isLoading && <p className="text-xs text-slate-400">Loading…</p>}

      <div className="space-y-3">
        {feeds.map((feed: Feed) => {
          const sync = lastSyncLabel(feed)
          return (
            <div key={feed.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl bg-slate-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{feed.name}</p>
                <p className="text-xs text-slate-400 truncate">{feed.ical_url}</p>
                {feed.last_sync_error && (
                  <p className="error-text mt-0.5 truncate" title={feed.last_sync_error}>{feed.last_sync_error}</p>
                )}
              </div>
              <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${sync.cls}`}>{sync.text}</span>
              <button
                type="button"
                title="Sync now"
                onClick={() => handleSync(feed.id)}
                disabled={syncingId === feed.id}
                className="p-1.5 text-slate-400 hover:text-yippie hover:bg-yippie/10 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
              >
                <RefreshCw size={13} className={syncingId === feed.id ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                title={feed.is_active ? 'Disable' : 'Enable'}
                onClick={() => toggleMutation.mutate({ id: feed.id, is_active: !feed.is_active })}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer ${feed.is_active ? 'bg-yippie' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${feed.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <button
                type="button"
                title="Remove"
                onClick={() => deleteMutation.mutate(feed.id)}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <Unlink size={13} />
              </button>
            </div>
          )
        })}
      </div>

      {adding && (
        <div className="mt-3 border border-yippie/40 bg-yippie/5 rounded-xl p-3 space-y-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Name (e.g. Apple Calendar, School)"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="iCal URL (webcal:// or https://)"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
          <p className="text-xs text-slate-400">
            Apple Calendar: right-click calendar → Share → Copy Link (webcal://…) &nbsp;·&nbsp;
            Outlook: Calendar settings → Share → ICS link
          </p>
          {addError && <p className="error-text">{addError}</p>}
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setAdding(false); setName(''); setUrl(''); setAddError('') }}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!name.trim() || !url.trim() || addMutation.isPending}
              onClick={() => addMutation.mutate({ name: name.trim(), ical_url: url.trim() })}
              className="btn-primary text-xs px-3 py-1.5"
            >
              {addMutation.isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Yippie iCal Export Feed (Yippie → Apple Calendar / Outlook) ──────────────

function YippieCalendarFeedCard() {
  const { copy: copyUrl, copied } = useCopy({ useToast: false })
  const [regenerating, setRegenerating] = useState(false)
  const [feedUrl, setFeedUrl] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ ical_url: string }>({
    queryKey: ['my-calendar-feed-url'],
    queryFn: () => api.get('/booking/external-calendars/my-feed-url').then((r: any) => r.data),
    onSuccess: (d: any) => setFeedUrl(d.ical_url),
  } as any)

  const url = feedUrl ?? data?.ical_url ?? ''

  async function handleCopy() {
    if (!url) return
    await copyUrl(url)
  }

  async function handleRegenerate() {
    if (!confirm('This will invalidate the old URL. Any existing subscriptions will stop working. Continue?')) return
    setRegenerating(true)
    try {
      const res: any = await api.post('/booking/external-calendars/my-feed-url/regenerate')
      setFeedUrl(res.data.ical_url)
    } finally {
      setRegenerating(false)
    }
  }

  return (
    // flex-1 lets this last card fill the leftover height so its bottom lines
    // up with the settings form on the left (the row stretches both columns).
    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex-1">
      <div className="flex items-center gap-2 mb-1">
        <Link size={15} className="text-slate-400" />
        <h2 className="text-sm font-bold text-slate-900">Your Yippie Calendar Feed</h2>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Subscribe to this URL in Apple Calendar (File → New Calendar Subscription) or Outlook (Add Calendar → From internet) to see your Yippie events and bookings there.
      </p>

      {isLoading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            className="flex-1 min-w-0 px-3 py-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl truncate cursor-text"
          />
          <button
            type="button"
            onClick={handleCopy}
            title="Copy URL"
            className="shrink-0 p-2 text-slate-400 hover:text-yippie hover:bg-yippie/10 rounded-xl transition-colors cursor-pointer"
          >
            {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={handleRegenerate}
        disabled={regenerating}
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 disabled:opacity-50 cursor-pointer"
      >
        <RefreshCw size={12} className={regenerating ? 'animate-spin' : ''} />
        {regenerating ? 'Regenerating…' : 'Regenerate URL'}
      </button>
    </div>
  )
}
