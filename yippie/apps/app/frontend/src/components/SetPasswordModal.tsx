import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { api } from '../api/client'
import { useT } from '../hooks/useT'

interface Props {
  onDone: () => void
}

/** Shown after entering the workspace through the signup entry link when no
 * password was chosen on the form. Rendered whenever the server side
 * user.needs_password flag is true, so it survives refreshes and repeat entry
 * link clicks. Saves via POST /auth/set-initial-password — the authenticated
 * session came from the emailed entry link, so possession of the session
 * proves inbox ownership (this is what protects against pre registration
 * account takeover). NOT skippable: without a password the account is
 * unreachable once the 48h entry link expires. */
export default function SetPasswordModal({ onDone }: Props) {
  const t = useT()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [validationError, setValidationError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post('/auth/set-initial-password', { new_password: password }),
    onSuccess: onDone,
  })

  function submit() {
    if (password.length < 8) { setValidationError(t('shared_password_min_length')); return }
    if (password !== confirm) { setValidationError(t('shared_passwords_do_not_match')); return }
    setValidationError('')
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header — no close affordance on purpose: the password is the only
            way back in after the entry link expires. */}
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100">
          <Lock size={18} className="text-yippie shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">{t('shared_secure_your_account')}</p>
            <p className="text-xs text-slate-400">{t('shared_choose_password_subtitle')}</p>
          </div>
        </div>

        <form onSubmit={e => { e.preventDefault(); submit() }}>
          <div className="px-5 py-5 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2" htmlFor="set-password">
                {t('shared_password_label')}
              </label>
              <input
                id="set-password"
                type="password"
                autoComplete="new-password"
                autoFocus
                placeholder={t('shared_password_placeholder')}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-base"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2" htmlFor="set-password-confirm">
                {t('shared_confirm_password_label')}
              </label>
              <input
                id="set-password-confirm"
                type="password"
                autoComplete="new-password"
                placeholder={t('shared_confirm_password_placeholder')}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="input-base"
              />
            </div>

            {(validationError || mutation.isError) && (
              <p className="text-xs text-danger">
                {validationError
                  || (mutation.error as any)?.response?.data?.detail
                  || t('shared_could_not_save_password')}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 px-6 py-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary w-full px-5 py-2"
            >
              {mutation.isPending ? t('shared_saving') : t('shared_save_password_continue')}
            </button>
            {/* Escape hatch ONLY when saving failed — the user should never be
                trapped behind a modal that cannot succeed. Honest now: the
                needs_password flag lives server side, so dismissing only hides
                the modal for this session and it returns next session until a
                password is actually chosen. */}
            {mutation.isError && (
              <button
                type="button"
                onClick={onDone}
                className="text-xs text-slate-500 hover:text-slate-700 underline self-start"
              >
                {t('shared_continue_without_password')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
