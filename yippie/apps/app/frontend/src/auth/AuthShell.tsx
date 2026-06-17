export function AuthShell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-3">
            <img src="/logo.svg" alt="Yippie" className="h-24 w-auto" />
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
