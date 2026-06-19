import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { AuthShell, authButtonCls, authErrorCls, authInputCls, authLabelCls } from '../auth/AuthShell'

export default function RequestDemoPage() {
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.post('/public/request-demo', {
        name,
        company_name: companyName,
        email,
        slug: slug.trim() || undefined,
      })
      setDone(true)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell subtitle="Request a demo">
      {done ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Demo sent — check your email for a one-click link to your workspace.
          </p>
          <Link to="/login" className="text-sm text-blue-600 hover:text-blue-700 font-medium">← Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <div className={authErrorCls}>{error}</div>}
          <div className="flex flex-col gap-1.5">
            <label className={authLabelCls}>Full name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className={authInputCls} required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={authLabelCls}>Company name</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)}
              className={authInputCls} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={authLabelCls}>Email</label>
            <input type="email" placeholder="you@company.com" value={email}
              onChange={e => setEmail(e.target.value)} className={authInputCls} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={authLabelCls}>Preferred slug (optional)</label>
            <input value={slug} onChange={e => setSlug(e.target.value)}
              placeholder="acme" className={authInputCls} />
          </div>
          <button type="submit" disabled={loading} className={authButtonCls}>
            {loading ? 'Requesting…' : 'Request demo'}
          </button>
          <Link to="/login" className="text-sm text-slate-400 hover:text-slate-600 text-center">← Back to sign in</Link>
        </form>
      )}
    </AuthShell>
  )
}
