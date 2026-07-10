export function AuthShell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bgGrid relative min-h-screen flex items-center justify-center p-4 overflow-hidden" style={{ background: 'var(--off-white)' }}>
      <img
        src="/logo-white-bg-mark.svg"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(15deg)',
          width: '780px',
          opacity: 0.07,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
      <div className="w-full max-w-sm relative z-10">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-3">
            <img src="/logo-lockup-onLight.svg" alt="Yippie" style={{ width: 200, height: 'auto' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
        </div>
        <div className="bg-white rounded-2xl p-8" style={{ boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-default)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export const authInputCls = 'w-full px-3 py-2.5 border border-[var(--border-default)] rounded-lg text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie transition-shadow'
export const authLabelCls = 'text-xs font-semibold text-[var(--text-subtle)] uppercase tracking-wide'
export const authButtonCls = 'w-full py-2.5 bg-[var(--ink)] hover:bg-[var(--brand-hover)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition-[background-color,transform] cursor-pointer mt-2'
export const authErrorCls = 'error-banner'
