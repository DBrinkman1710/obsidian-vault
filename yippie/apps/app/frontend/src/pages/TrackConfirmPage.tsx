import { useSearchParams } from 'react-router-dom'

export default function TrackConfirmPage() {
  const [params] = useSearchParams()
  const expired = params.get('expired') === '1'
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: '2rem' }}>
        {expired ? (
          <>
            <h2 style={{ color: '#374151', marginBottom: '0.5rem' }}>Link already used</h2>
            <p style={{ color: '#6b7280' }}>This response link has already been registered.</p>
          </>
        ) : (
          <>
            <h2 style={{ color: '#374151', marginBottom: '0.5rem' }}>Thank you for your response!</h2>
            <p style={{ color: '#6b7280' }}>You're all set.</p>
          </>
        )}
      </div>
    </div>
  )
}
