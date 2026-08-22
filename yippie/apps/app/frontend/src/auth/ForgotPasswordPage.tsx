import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { AuthShell, authButtonCls, authInputCls, authLabelCls } from './AuthShell'
import { useT } from '../hooks/useT'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const t = useT()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
    } finally {
      // Always show the same confirmation — never reveal whether the email exists
      setSent(true)
      setLoading(false)
    }
  }

  function renderSentBody() {
    const raw = t('public_forgot_sent_body')
    const [before, after] = raw.split('{email}')
    return <>{before}<span className="font-semibold">{email}</span>{after}</>
  }

  return (
    <AuthShell subtitle={t('public_forgot_subtitle')}>
      {sent ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">{renderSentBody()}</p>
          <Link to="/login" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            {t('public_forgot_sent_link')}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={authLabelCls}>{t('public_forgot_label_email')}</label>
            <input type="email" placeholder={t('public_forgot_placeholder_email')} value={email}
              onChange={e => setEmail(e.target.value)} className={authInputCls} required autoFocus />
          </div>
          <button type="submit" disabled={loading} className={authButtonCls}>
            {loading ? t('public_forgot_btn_loading') : t('public_forgot_btn_submit')}
          </button>
          <Link to="/login" className="text-sm text-slate-400 hover:text-slate-600 text-center">
            {t('public_forgot_back_link')}
          </Link>
        </form>
      )}
    </AuthShell>
  )
}
