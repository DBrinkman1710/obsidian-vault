import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { AuthShell, authButtonCls, authErrorCls, authInputCls, authLabelCls } from '../auth/AuthShell'
import { useT } from '../hooks/useT'

export default function RequestDemoPage() {
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const t = useT()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.post('/public/request-demo', {
        name,
        company_name: companyName,
        email,
      })
      setDone(true)
    } catch (err: any) {
      setError(err?.response?.data?.detail || t('public_demo_err_failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell subtitle={t('public_demo_subtitle')}>
      {done ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            {t('public_demo_done_body')}
          </p>
          <Link to="/login" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            {t('public_demo_done_link')}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <div className={authErrorCls}>{error}</div>}
          <div className="flex flex-col gap-1.5">
            <label className={authLabelCls}>{t('public_demo_label_name')}</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className={authInputCls} required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={authLabelCls}>{t('public_demo_label_company')}</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)}
              className={authInputCls} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={authLabelCls}>{t('public_demo_label_email')}</label>
            <input type="email" placeholder={t('public_demo_placeholder_email')} value={email}
              onChange={e => setEmail(e.target.value)} className={authInputCls} required />
          </div>
          <button type="submit" disabled={loading} className={authButtonCls}>
            {loading ? t('public_demo_btn_loading') : t('public_demo_btn_submit')}
          </button>
          <Link to="/login" className="text-sm text-slate-400 hover:text-slate-600 text-center">
            {t('public_demo_back_link')}
          </Link>
        </form>
      )}
    </AuthShell>
  )
}
