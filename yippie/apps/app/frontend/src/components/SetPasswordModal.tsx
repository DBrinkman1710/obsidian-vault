import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { api } from '../api/client'

interface Props {
  token: string
  onDone: () => void
}

/** Shown once, right after entering the workspace through the signup entry
 * link, when no password was chosen on the form. Only the inbox owner ever
 * holds that link, so only they can set the password (this is what protects
 * against pre registration account takeover). Uses the existing
 * POST /auth/reset-password with the short lived reset token minted by the
 * verify email redirect. NOT skippable: without a password the account is
 * unreachable once the 48h entry link expires. */
export default function SetPasswordModal({ token, onDone }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [validationError, setValidationError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post('/auth/reset-password', { token, new_password: password }),
    onSuccess: onDone,
  })

  function submit() {
    if (password.length < 8) { setValidationError('Use at least 8 characters.'); return }
    if (password !== confirm) { setValidationError('Passwords do not match.'); return }
    setValidationError('')
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header — no close affordance on purpose: the password is the only
            way back in after the entry link expires. */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
          <Lock size={18} className="text-yippie shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">Secure your account</p>
            <p className="text-xs text-slate-400">Choose a password so you can log in any time</p>
          </div>
        </div>

        <form
          className="px-5 py-5 flex flex-col gap-4"
          onSubmit={e => { e.preventDefault(); submit() }}
        >
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2" htmlFor="set-password">
              Password
            </label>
            <input
              id="set-password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="At least 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-base"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2" htmlFor="set-password-confirm">
              Confirm password
            </label>
            <input
              id="set-password-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="input-base"
            />
          </div>

          {(validationError || mutation.isError) && (
            <p className="text-xs text-danger">
              {validationError || 'Could not save your password. Use "Forgot password" on the login page instead.'}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
            >
              {mutation.isPending ? 'Saving…' : 'Save password and continue'}
            </button>
          </div>
          {/* Escape hatch ONLY when saving failed (e.g. expired token) — the
              user should never be trapped behind a modal that cannot succeed. */}
          {mutation.isError && (
            <button
              type="button"
              onClick={onDone}
              className="text-xs text-slate-500 hover:text-slate-700 underline self-start"
            >
              Continue without a password for now
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
