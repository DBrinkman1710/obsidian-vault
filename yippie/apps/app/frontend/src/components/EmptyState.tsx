import type { LucideIcon } from 'lucide-react'

// [UX-PSYCH] Empty states as conversion funnels: every empty list renders an
// illustration + one prominent CTA that starts the creation flow, so a blank
// page always tells the user what to do next.
export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  ctaLabel,
  ctaIcon: CtaIcon,
  onCta,
}: {
  icon: LucideIcon
  title: string
  subtitle?: string
  ctaLabel?: string
  ctaIcon?: LucideIcon
  onCta?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      {/* Simple layered illustration: soft brand disc + offset ring + icon */}
      <div className="relative mb-4">
        <div className="absolute -top-1.5 -right-2.5 w-6 h-6 rounded-full border-2 border-slate-200" />
        <div className="absolute -bottom-1 -left-3 w-3 h-3 rounded-full bg-slate-200/70" />
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--brand-subtle)' }}
        >
          <Icon size={30} strokeWidth={1.5} style={{ color: 'var(--brand)' }} />
        </div>
      </div>
      <p className="text-sm font-semibold text-slate-700 mb-1">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mb-4 max-w-xs leading-relaxed">{subtitle}</p>}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="inline-flex items-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity"
        >
          {CtaIcon && <CtaIcon size={14} strokeWidth={2.5} />}
          {ctaLabel}
        </button>
      )}
    </div>
  )
}
