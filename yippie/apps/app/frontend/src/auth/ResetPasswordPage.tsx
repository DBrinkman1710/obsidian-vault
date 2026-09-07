import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { AuthShell, authButtonCls, authErrorCls, authInputCls, authLabelCls } from './AuthShell'
import { useT } from '../hooks/useT'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const t = useT()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError(t('public_reset_err_mismatch')); return }
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, new_password: password })
      setDone(true)
    } catch (err: any) {
      setError(err.response?.data?.detail ?? t('public_reset_err_failed'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthShell subtitle={t('public_reset_no_token_subtitle')}>
        <p className="text-sm text-slate-500">
          {t('public_reset_no_token_body')}{' '}
          <Link to="/forgot-password" className="text-blue-600 hover:text-blue-700">
            {t('public_reset_no_token_link')}
          </Link>
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell subtitle={t('public_reset_subtitle')}>
      {done ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">{t('public_reset_done_body')}</p>
          <Link to="/login" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            {t('public_reset_done_link')} &rarr;
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <div className={authErrorCls}>{error}</div>}
          <div className="flex flex-col gap-1.5">
            <label className={authLabelCls}>{t('public_reset_label_new')}</label>
            <input type="password" placeholder={t('public_reset_placeholder_new')} value={password}
              onChange={e => setPassword(e.target.value)} className={authInputCls} required minLength={8} autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={authLabelCls}>{t('public_reset_label_confirm')}</label>
            <input type="password" placeholder="••••••••" value={confirm}
              onChange={e => setConfirm(e.target.value)} className={authInputCls} required />
          </div>
          <button type="submit" disabled={loading} className={authButtonCls}>
            {loading ? t('public_reset_btn_loading') : t('public_reset_btn_submit')}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
