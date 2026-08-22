import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from './useAuth'
import { AuthShell, authButtonCls, authErrorCls, authInputCls, authLabelCls } from './AuthShell'
import { useT } from '../hooks/useT'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { setSession } = useAuth()
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const t = useT()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError(t('public_register_err_mismatch')); return }
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', { token, password, full_name: fullName || undefined })
      setSession(data.user)
      navigate('/inbox')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? t('public_register_err_failed'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthShell subtitle={t('public_register_no_token_subtitle')}>
        <p className="text-sm text-slate-500">
          {t('public_register_no_token_body')}
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell subtitle={t('public_register_subtitle')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <div className={authErrorCls}>{error}</div>}
        <div className="flex flex-col gap-1.5">
          <label className={authLabelCls}>{t('public_register_label_name')}</label>
          <input type="text" placeholder={t('public_register_placeholder_name')} value={fullName}
            onChange={e => setFullName(e.target.value)} className={authInputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={authLabelCls}>{t('public_register_label_password')}</label>
          <input type="password" placeholder={t('public_register_placeholder_password')} value={password}
            onChange={e => setPassword(e.target.value)} className={authInputCls} required minLength={8} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={authLabelCls}>{t('public_register_label_confirm')}</label>
          <input type="password" placeholder="••••••••" value={confirm}
            onChange={e => setConfirm(e.target.value)} className={authInputCls} required />
        </div>
        <button type="submit" disabled={loading} className={authButtonCls}>
          {loading ? t('public_register_btn_loading') : t('public_register_btn_submit')}
        </button>
      </form>
    </AuthShell>
  )
}
