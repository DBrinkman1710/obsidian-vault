import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      navigate('/')
    } catch {
      setError('Invalid email or password')
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <form onSubmit={handleSubmit} style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Sign in</h1>
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}
        <input
          type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
        />
        <input
          type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
        />
        <button type="submit" style={{
          padding: '10px 14px', borderRadius: 6, background: '#2563eb',
          color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 14,
        }}>
          Sign in
        </button>
      </form>
    </div>
  )
}
