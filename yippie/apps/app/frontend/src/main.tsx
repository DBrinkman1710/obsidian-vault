import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import App from './App'
import './index.css'

// Error monitoring — only active on deployed hosts, never on localhost.
// DSN is public by design (it ships to every browser); EU (de) ingest region.
const SENTRY_ENV: Record<string, string> = {
  'app.getyippie.com': 'production',
  'dev.getyippie.com': 'production',
  'sandbox.getyippie.com': 'sandbox',
  'devsandbox.getyippie.com': 'sandbox',
}
const sentryEnv = SENTRY_ENV[window.location.hostname]
if (sentryEnv) {
  Sentry.init({
    dsn: 'https://2fc0bce5029bc4ecd8e4bbaf96430841@o4511678536220672.ingest.de.sentry.io/4511678550179920',
    environment: sentryEnv,
    sendDefaultPii: false,
  })
}

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
})

function ErrorFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-600">
      <p className="text-lg font-semibold text-slate-800">Something went wrong</p>
      <p className="text-sm">The error has been reported. Please reload the page.</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-4 py-2 rounded-lg bg-yippie text-white text-sm font-medium"
      >
        Reload
      </button>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)
