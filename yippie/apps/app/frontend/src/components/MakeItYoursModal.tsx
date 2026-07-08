import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Palette, X } from 'lucide-react'
import { api } from '../api/client'

const DEFAULT_COLOR = '#5BA4F5'

interface Props {
  initialColor?: string | null
  initialLogoUrl?: string | null
  onComplete: () => void
  onDismiss: () => void
}

/** Endowment / IKEA-effect onboarding gate: the more of themselves a user puts
 * into the workspace, the more they value it. Picks a brand colour and an
 * optional logo, reusing the existing PATCH /team/branding endpoint. */
export default function MakeItYoursModal({ initialColor, initialLogoUrl, onComplete, onDismiss }: Props) {
  const [color, setColor] = useState(initialColor || DEFAULT_COLOR)
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl || '')

  const mutation = useMutation({
    mutationFn: () => api.patch('/team/branding', { primary_color: color, logo_url: logoUrl.trim() }),
    onSuccess: () => {
      // Reload so the new brand colour and logo apply across the shell, and the
      // checklist re-reads the tenant config to mark this gate complete.
      window.location.reload()
      onComplete()
    },
  })

  const previewOk = logoUrl.trim().length > 0

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
          <Palette size={18} className="text-yippie shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">Make it yours</p>
            <p className="text-xs text-slate-400">Pick a brand colour and logo so this workspace feels like home</p>
          </div>
          <button
            onClick={onDismiss}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-5">
          {/* Brand colour */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Brand colour</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
              />
              <span className="text-sm text-slate-500 font-mono">{color}</span>
              <button
                type="button"
                onClick={() => setColor(DEFAULT_COLOR)}
                className="ml-auto text-xs text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-2.5 py-1 rounded-lg transition-colors"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Logo */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Logo URL <span className="text-slate-400 font-normal normal-case">(optional)</span></label>
            <div className="flex items-center gap-3">
              <input
                value={logoUrl}
                onChange={e => setLogoUrl(e.target.value)}
                placeholder="https://yourbrand.com/logo.png"
                className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
              />
              {previewOk && (
                <img
                  src={logoUrl.trim()}
                  alt="Logo preview"
                  className="h-10 w-10 rounded-lg object-contain border border-slate-200 bg-slate-50 shrink-0"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
                />
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">Paste a link to your logo. It shows in the sidebar and on your customer-facing pages.</p>
          </div>

          {mutation.isError && <p className="text-xs text-red-500">Could not save. Please try again.</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
          >
            {mutation.isPending ? 'Saving…' : 'Save my branding'}
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
