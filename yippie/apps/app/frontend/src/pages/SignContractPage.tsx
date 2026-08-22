import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Eraser } from 'lucide-react'
import { api } from '../api/client'
import { fmtDate as libFmtDate } from '../lib/format'
import { translations } from '../i18n/translations'

interface PublicContract {
  tenant_name: string
  title: string
  body: string
  counterparty_name: string | null
  value_amount: number | null
  value_interval: string | null
  currency: string
  start_date: string | null
  end_date: string | null
  signed_at: string | null
  signer_name: string | null
}

const fmtDate = libFmtDate

// Dutch-by-default translation helper for this public page.
function tNl(key: string): string {
  return translations.nl[key] ?? translations.en[key] ?? key
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center p-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <img src="/logo-lockup-onLight.svg" alt="Yippie" className="w-56 mx-auto object-contain" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Draw-to-sign canvas ────────────────────────────────────────────────────────

function SignatureCanvas({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const inkRef = useRef(false)  // ref, not state — read synchronously in end()

  useEffect(() => {
    const canvas = canvasRef.current!
    // Render at 2x for crisp strokes on retina screens.
    const scale = 2
    canvas.width = canvas.offsetWidth * scale
    canvas.height = canvas.offsetHeight * scale
    const ctx = canvas.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1e293b'
  }, [])

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    canvasRef.current!.setPointerCapture(e.pointerId)
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    inkRef.current = true
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    onChange(inkRef.current ? canvasRef.current!.toDataURL('image/png') : null)
  }

  function clear() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    inkRef.current = false
    onChange(null)
  }

  return (
    <div>
      <canvas ref={canvasRef}
        className="w-full h-36 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 touch-none cursor-crosshair"
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} />
      <button type="button" onClick={clear}
        className="mt-1.5 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
        <Eraser size={12} /> {tNl('public_contract_clear_signature')}
      </button>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SignContractPage() {
  const { token } = useParams<{ token: string }>()
  const [signerName, setSignerName] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [agree, setAgree] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [justSigned, setJustSigned] = useState(false)

  const { data: contract, isLoading, error: loadError } = useQuery<PublicContract>({
    queryKey: ['public-contract', token],
    queryFn: () => api.get(`/public/contracts/sign/${token}`).then((r: any) => r.data),
    retry: false,
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (signerName.trim().length < 2) { setError(tNl('public_contract_err_name')); return }
    if (!agree) { setError(tNl('public_contract_err_agree')); return }
    setError(''); setSubmitting(true)
    try {
      await api.post(`/public/contracts/sign/${token}`, {
        signer_name: signerName.trim(),
        signature_image: signature,
        agree,
      })
      setJustSigned(true)
    } catch (err: any) {
      setError(err.response?.data?.detail ?? tNl('public_contract_err_sign'))
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) return <Shell><p className="text-sm text-slate-400 text-center">{tNl('public_contract_loading')}</p></Shell>

  if (loadError || !contract) {
    return (
      <Shell>
        <h1 className="text-lg font-bold text-slate-900 mb-2 text-center">{tNl('public_contract_unavailable_title')}</h1>
        <p className="text-sm text-slate-500 text-center">
          {tNl('public_contract_unavailable_body')}
        </p>
      </Shell>
    )
  }

  const signed = justSigned || !!contract.signed_at

  return (
    <Shell>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{contract.tenant_name}</p>
      <h1 className="text-xl font-bold text-slate-900 mb-4">{contract.title}</h1>

      {/* Key terms */}
      {(contract.start_date || contract.end_date || contract.value_amount != null) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          {contract.start_date && (
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{tNl('public_contract_key_start')}</p>
              <p className="text-sm font-medium text-slate-800">{fmtDate(contract.start_date)}</p>
            </div>
          )}
          {contract.end_date && (
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{tNl('public_contract_key_end')}</p>
              <p className="text-sm font-medium text-slate-800">{fmtDate(contract.end_date)}</p>
            </div>
          )}
          {contract.value_amount != null && (
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{tNl('public_contract_key_value')}</p>
              <p className="text-sm font-medium text-slate-800">
                {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: contract.currency }).format(contract.value_amount)}
                {contract.value_interval === 'monthly' ? ' /mo' : contract.value_interval === 'yearly' ? ' /yr' : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Contract text */}
      <div className="border border-slate-200 rounded-xl p-5 mb-6 max-h-96 overflow-y-auto">
        <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{contract.body}</div>
      </div>

      {signed ? (
        <div className="text-center py-4">
          <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 mb-1">{tNl('public_contract_signed_title')}</h2>
          <p className="text-sm text-slate-500">
            {tNl('public_contract_signed_by').replace('{name}', justSigned ? signerName : (contract.signer_name ?? ''))}
            {!justSigned && contract.signed_at ? tNl('public_contract_signed_on').replace('{date}', fmtDate(contract.signed_at)) : ''}.
            {' '}{tNl('public_contract_signed_confirm').replace('{tenant}', contract.tenant_name)}
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              {tNl('public_contract_label_name')}
            </label>
            <input value={signerName} onChange={e => setSignerName(e.target.value)}
              placeholder={tNl('public_contract_placeholder_name')}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              {tNl('public_contract_label_signature')}
            </label>
            <SignatureCanvas onChange={setSignature} />
          </div>
          <label className="inline-flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)}
              className="mt-0.5 rounded border-slate-300" />
            <span>{tNl('public_contract_agree')}</span>
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={submitting}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
            {submitting ? tNl('public_contract_btn_signing') : tNl('public_contract_btn_sign')}
          </button>
          <p className="text-xs text-slate-400 text-center">
            {tNl('public_contract_proof')}
          </p>
        </form>
      )}
    </Shell>
  )
}
