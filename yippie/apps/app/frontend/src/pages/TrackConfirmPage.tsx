import { useSearchParams } from 'react-router-dom'
import { translations } from '../i18n/translations'

// Dutch-by-default translation helper for this public page.
function tNl(key: string): string {
  return translations.nl[key] ?? translations.en[key] ?? key
}

export default function TrackConfirmPage() {
  const [params] = useSearchParams()
  const expired = params.get('expired') === '1'
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: '2rem' }}>
        {expired ? (
          <>
            <h2 style={{ color: '#374151', marginBottom: '0.5rem' }}>{tNl('public_track_expired_title')}</h2>
            <p style={{ color: '#6b7280' }}>{tNl('public_track_expired_body')}</p>
          </>
        ) : (
          <>
            <h2 style={{ color: '#374151', marginBottom: '0.5rem' }}>{tNl('public_track_success_title')}</h2>
            <p style={{ color: '#6b7280' }}>{tNl('public_track_success_body')}</p>
          </>
        )}
      </div>
    </div>
  )
}
