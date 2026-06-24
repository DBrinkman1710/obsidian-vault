import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/useAuth'

export default function DemoEnterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const setSession = useAuth((s: any) => s.setSession)

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      navigate('/login', { replace: true })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/public/demo-enter', { params: { token } })
        if (cancelled) return
        setSession(data.access_token, data.user)
        navigate('/', { replace: true })
      } catch {
        if (!cancelled) navigate('/login', { replace: true })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [params, navigate, setSession])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-slate-500">Setting up your demo…</p>
    </div>
  )
}
