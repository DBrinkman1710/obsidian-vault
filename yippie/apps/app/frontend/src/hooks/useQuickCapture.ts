import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

export type QuickCaptureContextType = 'contact' | 'ticket' | 'none'

export interface QuickCaptureContext {
  context_type: QuickCaptureContextType
  context_id: string | null
}

export const NO_CONTEXT: QuickCaptureContext = { context_type: 'none', context_id: null }

export const quickCaptureEvents = new EventTarget()

export function openQuickCapture(ctx?: Partial<QuickCaptureContext>) {
  quickCaptureEvents.dispatchEvent(new CustomEvent('open', { detail: ctx ?? null }))
}

function contextFromPath(pathname: string): QuickCaptureContext {
  const contact = pathname.match(/^\/contacts\/([^/]+)$/)
  if (contact && contact[1] !== 'new') return { context_type: 'contact', context_id: contact[1] }
  const ticket = pathname.match(/^\/tickets\/([^/]+)$/)
  if (ticket && ticket[1] !== 'new') return { context_type: 'ticket', context_id: ticket[1] }
  return NO_CONTEXT
}

export function useQuickCapture() {
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [context, setContext] = useState<QuickCaptureContext>(NO_CONTEXT)

  const open = useCallback((ctx?: Partial<QuickCaptureContext>) => {
    const resolved: QuickCaptureContext = ctx?.context_type
      ? { context_type: ctx.context_type, context_id: ctx.context_id ?? null }
      : contextFromPath(window.location.pathname)
    setContext(resolved)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => setIsOpen(false), [])

  const clearContext = useCallback(() => setContext(NO_CONTEXT), [])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        open()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    function onExternal(e: Event) {
      const detail = (e as CustomEvent).detail as Partial<QuickCaptureContext> | null
      open(detail ?? undefined)
    }
    quickCaptureEvents.addEventListener('open', onExternal)
    return () => quickCaptureEvents.removeEventListener('open', onExternal)
  }, [open])

  useEffect(() => {
    if (isOpen) setIsOpen(false)
  }, [location.pathname])

  return { isOpen, open, close, context, clearContext }
}
