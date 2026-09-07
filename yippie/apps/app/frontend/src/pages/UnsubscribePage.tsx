import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { translations } from '../i18n/translations'

// Dutch-by-default translation helper for this public page.
function tNl(key: string): string {
  return translations.nl[key] ?? translations.en[key] ?? key
}

// Public unsubscribe confirmation. The backend GET /track/unsubscribe/{token}
// records the opt-out and returns an HTML page; here we call it from the SPA
// route /unsubscribe/:token so links can also point at the app domain.
export default function UnsubscribePage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading')

  useEffect(() => {
    if (!token) {
      setState('error')
      return
    }
    api.get(`/track/unsubscribe/${token}`)
      .then(() => setState('done'))
      .catch(() => setState('error'))
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="h-1 bg-[#5BB8E8]" />
        <div className="p-10 text-center">
          {state === 'loading' && <p className="text-sm text-slate-400">{tNl('public_unsub_loading')}</p>}
          {state === 'done' && (
            <>
              <h1 className="text-xl font-bold text-slate-900">{tNl('public_unsub_done_title')}</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {tNl('public_unsub_done_body')}
              </p>
            </>
          )}
          {state === 'error' && (
            <>
              <h1 className="text-xl font-bold text-slate-900">{tNl('public_unsub_error_title')}</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {tNl('public_unsub_error_body')}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
