import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation } from '@tanstack/react-query'
import { Palette } from 'lucide-react'
import { CloseButton } from '../shell/CloseButton'
import { api } from '../api/client'
import { useT } from '../hooks/useT'

const DEFAULT_COLOR = '#5BA4F5'

interface Props {
  tenantId?: string | null
  initialColor?: string | null
  initialLogoUrl?: string | null
  onDismiss: () => void
}

/** Endowment / IKEA-effect onboarding gate: the more of themselves a user puts
 * into the workspace, the more they value it. Picks a brand colour and an
 * optional logo, reusing the existing PATCH /team/branding endpoint. */
export default function MakeItYoursModal({ tenantId, initialColor, initialLogoUrl, onDismiss }: Props) {
  const t = useT()
  const [color, setColor] = useState(initialColor || DEFAULT_COLOR)
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl || '')
  // Track the load failure in state (not by mutating the img's style) so the
  // preview reappears the moment a broken URL is corrected.
  const [logoError, setLogoError] = useState(false)

  const mutation = useMutation({
    mutationFn: () => api.patch('/team/branding', { primary_color: color, logo_url: logoUrl.trim() }),
    onSuccess: () => {
      // Mark the checklist gate done even when the tenant deliberately keeps the
      // default colour and no logo — saving is the completion signal. Survives
      // the reload below (which tears the SPA down, so nothing runs after it).
      if (tenantId) localStorage.setItem(`made_it_yours_${tenantId}`, '1')
      // Reload so the new brand colour and logo apply across the shell, and the
      // checklist re-reads the tenant config.
      window.location.reload()
    },
  })

  const previewOk = logoUrl.trim().length > 0 && !logoError

  // Portal to document.body so the overlay escapes App's fixed bottom right
  // column (a z-40 stacking context) — otherwise BottomNav and other chrome
  // paint over this full screen modal.
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
          <Palette size={18} className="text-yippie shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">{t('shared_make_it_yours')}</p>
            <p className="text-xs text-slate-400">{t('shared_make_it_yours_subtitle')}</p>
          </div>
          <CloseButton onClick={onDismiss} />
        </div>

        <div className="px-5 py-5 flex flex-col gap-5">
          {/* Brand colour */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('shared_brand_colour_label')}</label>
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
                {t('shared_reset')}
              </button>
            </div>
          </div>

          {/* Logo */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('shared_logo_url_label')} <span className="text-slate-400 font-normal normal-case">{t('shared_logo_url_optional')}</span></label>
            <div className="flex items-center gap-3">
              <input
                value={logoUrl}
                onChange={e => { setLogoUrl(e.target.value); setLogoError(false) }}
                placeholder={t('shared_logo_url_placeholder')}
                className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
              />
              {previewOk && (
                <img
                  src={logoUrl.trim()}
                  alt={t('shared_logo_preview_alt')}
                  className="h-10 w-10 rounded-lg object-contain border border-slate-200 bg-slate-50 shrink-0"
                  onError={() => setLogoError(true)}
                />
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">{t('shared_logo_url_hint')}</p>
          </div>

          {mutation.isError && <p className="text-xs text-red-500">{t('shared_could_not_save_branding')}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
          >
            {mutation.isPending ? t('shared_saving') : t('shared_save_my_branding')}
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {t('shared_skip_for_now')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
