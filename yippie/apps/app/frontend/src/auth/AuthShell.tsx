export function AuthShell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <svg viewBox="0 0 36 36" className="w-8 h-8" fill="#5BA4F5">
              <circle cx="10" cy="8" r="4" />
              <path d="M4 28 Q10 36 18 30" strokeWidth="3.5" stroke="#5BA4F5" fill="none" strokeLinecap="round"/>
              <circle cx="21" cy="5" r="2.5" />
            </svg>
            <span className="text-2xl font-bold text-slate-900">yippie</span>
          </div>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          {children}
        </div>
      </div>
    </div>
  )
}

export const authInputCls = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
export const authLabelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wide'
export const authButtonCls = 'w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed mt-2'
export const authErrorCls = 'bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600'
