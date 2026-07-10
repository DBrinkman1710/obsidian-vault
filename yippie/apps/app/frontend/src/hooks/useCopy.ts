import { useState, useCallback } from 'react'
import { toast } from 'sonner'

export interface UseCopyOptions {
  /** Custom success message. Default: "Copied ✓" */
  successMessage?: string
  /** Duration in ms to show success state before reset. Default: 2000 */
  duration?: number
  /** Use toast instead of state. Default: true (use toast) */
  useToast?: boolean
}

export interface UseCopyReturn {
  /** Call this with text to copy; optional per call toast message overrides the default */
  copy: (text: string, message?: string) => Promise<void>
  /** True while the copy succeeded and feedback is showing */
  copied: boolean
}

/**
 * Shared hook for clipboard copy with transient feedback.
 * Returns a `copy` function and a `copied` boolean state.
 *
 * Usage:
 * - With inline state (preferred for buttons with labels):
 *   const { copy, copied } = useCopy({ useToast: false })
 *   <button onClick={() => copy(text)}>{copied ? 'Copied ✓' : 'Copy'}</button>
 *
 * - With toast (for icon-only buttons or when inline state doesn't fit):
 *   const { copy } = useCopy()
 *   <button onClick={() => copy(text)}><LinkIcon /></button>
 */
export function useCopy(opts?: UseCopyOptions): UseCopyReturn {
  const [copied, setCopied] = useState(false)
  const successMessage = opts?.successMessage ?? 'Copied ✓'
  const duration = opts?.duration ?? 2000
  const shouldUseToast = opts?.useToast !== false

  const copy = useCallback(
    async (text: string, message?: string) => {
      try {
        await navigator.clipboard.writeText(text)
        if (shouldUseToast) {
          toast.success(message ?? successMessage)
        } else {
          setCopied(true)
          setTimeout(() => setCopied(false), duration)
        }
      } catch (err) {
        toast.error('Failed to copy')
        console.error('Copy failed:', err)
      }
    },
    [successMessage, duration, shouldUseToast],
  )

  return { copy, copied }
}
