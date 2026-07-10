/**
 * Shared status + priority style maps for tickets.
 * Uses --status-* CSS vars defined in index.css.
 *
 * Also exports the reusable Badge pill component (avoid duplicating it in every consumer).
 */
import React from 'react'

export const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  open:        { bg: 'var(--status-info-bg)',    color: 'var(--status-info)' },
  in_progress: { bg: 'var(--status-high-bg)',    color: 'var(--status-high)' },
  waiting:     { bg: 'var(--status-waiting-bg)', color: 'var(--status-waiting)' },
  resolved:    { bg: 'var(--status-success-bg)', color: 'var(--status-success)' },
  closed:      { bg: 'var(--slate-100)',          color: 'var(--slate-500)' },
}

export const PRIORITY_STYLES: Record<string, { bg: string; color: string }> = {
  urgent: { bg: 'var(--status-urgent-bg)', color: 'var(--status-urgent)' },
  high:   { bg: 'var(--status-high-bg)',   color: 'var(--status-high)' },
  medium: { bg: 'var(--status-info-bg)',   color: 'var(--status-info)' },
  low:    { bg: 'var(--slate-100)',         color: 'var(--slate-500)' },
}

/** Shared pill badge — renders a small rounded label with bg/color from a style record. */
export function Badge({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return React.createElement(
    'span',
    {
      className: 'px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize',
      style: { background: bg, color },
    },
    children,
  )
}
