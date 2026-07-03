import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/useAuth'

export default function DemoEnterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const setSession = useAuth((s: any) => s.setSession)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setError('No demo token found in this link.')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/public/demo-enter', { params: { token } })
        if (cancelled) return
        setSession(data.user)
        navigate('/', { replace: true })
      } catch (err: any) {
        if (cancelled) return
        const detail = err?.response?.data?.detail
        setError(typeof detail === 'string' ? detail : 'Something went wrong. Please request a new demo.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [params, navigate, setSession])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm w-full text-center flex flex-col gap-4">
          <p className="text-sm font-medium text-red-600">{error}</p>
          <p className="text-sm text-slate-500">
            Demo links expire after 7 days. You can request a fresh one below.
          </p>
          <Link
            to="/request-demo"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 underline"
          >
            Request a new demo →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-slate-500">Setting up your demo…</p>
    </div>
  )
}
