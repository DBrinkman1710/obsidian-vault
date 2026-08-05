import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Phone, Square, Sparkles, Mail, Check, Trash2, Plus, AlarmClock } from 'lucide-react'
import { CloseButton } from '../../../shell/CloseButton'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useCompose } from '../../../hooks/useCompose'

// Local call helper daemon (personal setup — starts/stops Handy recording and
// switches audio devices). When unreachable the modal degrades to manual mode.
// HTTPS via an mkcert-trusted cert so Safari (which blocks http://localhost from
// an https page as mixed content) can reach it; 'localhost' matches the cert SAN.
const HELPER_URL = 'https://localhost:8765'

type Outcome = 'interested' | 'not_interested' | 'callback' | 'voicemail' | 'no_answer'

interface ActionItem {
  text: string
  due_at: string | null // ISO
}

interface CallContact {
  id: string
  full_name: string
  email: string | null
  phone: string | null
}

const OUTCOMES: { value: Outcome; label: string }[] = [
  { value: 'interested', label: 'Picked up · interested' },
  { value: 'not_interested', label: 'Picked up · not interested' },
  { value: 'callback', label: 'Call back later' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'no_answer', label: 'Did not pick up' },
]

// Build a dialable tel: URL. macOS/iOS hand this to the Continuity call prompt
// ("Call using iPhone"). Numbers stored with a country code but no + get one;
// national numbers starting with 0 are left as-is for the local dialer.
function telHref(phone: string): string {
  let p = phone.replace(/[^\d+]/g, '')
  if (p && !p.startsWith('+') && !p.startsWith('0')) p = `+${p}`
  return `tel:${p}`
}

function dial(phone: string | null) {
  if (phone) window.location.href = telHref(phone)
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToIso(val: string): string | null {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

async function helperPost(path: string): Promise<boolean> {
  try {
    const res = await fetch(`${HELPER_URL}${path}`, { method: 'POST' })
    return res.ok
  } catch {
    return false
  }
}

export default function CallModal({ contact, onClose }: { contact: CallContact; onClose: () => void }) {
  const qc = useQueryClient()
  const { openCompose } = useCompose()

  const [phase, setPhase] = useState<'capture' | 'review' | 'done'>('capture')
  const [recording, setRecording] = useState(false)
  const [helperOk, setHelperOk] = useState<boolean | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [outcome, setOutcome] = useState<Outcome>('interested')
  const [duration, setDuration] = useState<string>('')

  // Review-phase editable AI output
  const [summary, setSummary] = useState('')
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [aiOk, setAiOk] = useState(true)
  const [remindersCreated, setRemindersCreated] = useState(0)

  const transcriptRef = useRef<HTMLTextAreaElement>(null)
  const recordingRef = useRef(false)
  recordingRef.current = recording

  // Place the call (macOS/iOS Continuity prompt) and kick off recording via the
  // helper as soon as the modal opens.
  useEffect(() => {
    let cancelled = false
    dial(contact.phone)
    helperPost('/start').then(ok => {
      if (cancelled) return
      setHelperOk(ok)
      setRecording(ok)
    })
    return () => {
      cancelled = true
      // Restore audio devices if the modal is closed mid-recording. Handy keeps
      // recording until cancelled manually — we deliberately don't send the
      // stop hotkey here, or the transcript would paste into a random window.
      if (recordingRef.current) helperPost('/abort')
    }
  }, [])

  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [recording])

  async function stopRecording() {
    // Focus the transcript field FIRST — Handy types the transcript into
    // whatever field has focus when transcription finishes.
    transcriptRef.current?.focus()
    setRecording(false)
    if (!duration) setDuration(String(Math.max(1, Math.round(elapsed / 60))))
    const ok = await helperPost('/stop')
    if (!ok) toast.error('Call helper unreachable — stop Handy manually (its transcript will land in the box below).')
  }

  const analyzeMut = useMutation({
    mutationFn: () =>
      api
        .post(`/contacts/${contact.id}/log-call/analyze`, {
          transcript,
          outcome,
          duration_minutes: duration ? Number(duration) : null,
        })
        .then((r: any) => r.data),
    onSuccess: (data: any) => {
      setSummary(data.summary ?? '')
      setActionItems(data.action_items ?? [])
      setEmailSubject(data.email_subject ?? '')
      setEmailBody(data.email_body ?? '')
      setAiOk(data.ai_ok ?? true)
      setPhase('review')
    },
    onError: () => toast.error('Failed to analyze the call. Try again.'),
  })

  const saveMut = useMutation({
    mutationFn: () =>
      api
        .post(`/contacts/${contact.id}/log-call`, {
          outcome,
          duration_minutes: duration ? Number(duration) : null,
          summary,
          action_items: actionItems.filter(i => i.text.trim()),
          transcript: transcript || null,
          email_subject: emailSubject || null,
          email_body: emailBody || null,
        })
        .then((r: any) => r.data),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['contact', contact.id] })
      qc.invalidateQueries({ queryKey: ['contact-activity', contact.id] })
      setRemindersCreated(data.reminders_created ?? 0)
      setPhase('done')
      toast.success('Call logged.')
    },
    onError: () => toast.error('Failed to save the call log.'),
  })

  function openEmailDraft() {
    if (!contact.email) return
    openCompose({
      recipients: [{ email: contact.email, label: contact.full_name || contact.email }],
      subject: emailSubject,
      body: emailBody,
      fromEmail: null,
    })
    onClose()
  }

  // Any outcome can be logged — a callless disposition falls back to a canned
  // summary server-side, so nothing gates on having a transcript.
  const canAnalyze = true

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Phone size={15} className="text-blue-500" />
          <h2 className="text-sm font-bold text-slate-900 flex-1 truncate">
            Call — {contact.full_name}
            {contact.phone && (
              <a
                href={telHref(contact.phone)}
                className="text-slate-400 font-normal hover:text-yippie"
                title="Dial again"
              >
                {' · '}{contact.phone}
              </a>
            )}
          </h2>
          <CloseButton onClick={onClose} />
        </div>

        {phase === 'capture' && (
          <div className="p-5 flex flex-col gap-4">
            {helperOk === false && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Call helper not reachable — recording did not start automatically. Start Handy manually
                (toggle hotkey) or type your notes below.
              </p>
            )}

            <div className="flex items-center gap-3">
              {recording ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                  </span>
                  <span className="text-sm font-semibold text-slate-700">Recording… {formatElapsed(elapsed)}</span>
                  <button
                    onClick={stopRecording}
                    className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Square size={11} />
                    Stop &amp; transcribe
                  </button>
                </>
              ) : (
                <span className="text-xs text-slate-500">
                  {transcript
                    ? 'Transcript captured — review below, then analyze.'
                    : 'Waiting for transcript… Handy types it into the box below when transcription finishes (keep it focused).'}
                </span>
              )}
            </div>

            <textarea
              ref={transcriptRef}
              autoFocus
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Call transcript lands here after you hit Stop & transcribe…"
              rows={8}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
            />

            <div className="flex items-center gap-3 flex-wrap">
              <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
                {OUTCOMES.map(o => (
                  <button
                    key={o.value}
                    onClick={() => setOutcome(o.value)}
                    className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                      outcome === o.value ? 'bg-yippie text-white' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  placeholder="0"
                  className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="text-xs text-slate-400">min</span>
              </div>
            </div>

            <button
              onClick={() => analyzeMut.mutate()}
              disabled={!canAnalyze || recording || analyzeMut.isPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity disabled:cursor-not-allowed"
            >
              <Sparkles size={14} />
              {analyzeMut.isPending ? 'Analyzing…' : 'Analyze call'}
            </button>
          </div>
        )}

        {phase === 'review' && (
          <div className="p-5 flex flex-col gap-4">
            {!aiOk && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                AI summary unavailable — the raw transcript was used. Edit everything below before saving.
              </p>
            )}

            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Summary</p>
              <textarea
                value={summary}
                onChange={e => setSummary(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Action items <span className="normal-case font-normal">(items with a due date become reminders)</span>
              </p>
              <div className="flex flex-col gap-2">
                {actionItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={item.text}
                      onChange={e =>
                        setActionItems(items => items.map((it, j) => (j === i ? { ...it, text: e.target.value } : it)))
                      }
                      className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <input
                      type="datetime-local"
                      value={isoToLocalInput(item.due_at)}
                      onChange={e =>
                        setActionItems(items =>
                          items.map((it, j) => (j === i ? { ...it, due_at: localInputToIso(e.target.value) } : it))
                        )
                      }
                      className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button
                      onClick={() => setActionItems(items => items.filter((_, j) => j !== i))}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setActionItems(items => [...items, { text: '', due_at: null }])}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors self-start"
                >
                  <Plus size={12} />
                  Add action item
                </button>
              </div>
            </div>

            {(emailSubject || emailBody) && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Follow-up email draft</p>
                <input
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-t-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <textarea
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border border-slate-200 border-t-0 rounded-b-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => saveMut.mutate()}
                disabled={!summary.trim() || saveMut.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity disabled:cursor-not-allowed"
              >
                <Check size={14} />
                {saveMut.isPending ? 'Saving…' : 'Approve & save'}
              </button>
              <button
                onClick={() => setPhase('capture')}
                className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <Check size={15} />
              Call logged to the timeline and notes.
            </div>
            {remindersCreated > 0 && (
              <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <AlarmClock size={12} />
                {remindersCreated} reminder{remindersCreated !== 1 ? 's' : ''} set.
              </p>
            )}
            <div className="flex gap-2">
              {contact.email && (emailSubject || emailBody) && (
                <button
                  onClick={openEmailDraft}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity"
                >
                  <Mail size={14} />
                  Open email in composer
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
