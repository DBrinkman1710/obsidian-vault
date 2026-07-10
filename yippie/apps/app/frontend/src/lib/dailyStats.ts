// [UX-PSYCH] Client-side daily action counters for closure feedback toasts.
// Nothing is written to the DB — counts live in sessionStorage, scoped to
// today's date, so "All caught up — 8 tickets resolved today" reflects this
// browser session's work without any backend support.

function key(counter: string): string {
  const today = new Date().toISOString().slice(0, 10)
  return `yippie:daily:${counter}:${today}`
}

export function recordDailyActions(counter: string, n = 1): number {
  try {
    const next = getDailyActions(counter) + n
    sessionStorage.setItem(key(counter), String(next))
    return next
  } catch {
    return n
  }
}

export function getDailyActions(counter: string): number {
  try {
    return parseInt(sessionStorage.getItem(key(counter)) ?? '0', 10) || 0
  } catch {
    return 0
  }
}

// Fire the closure toast at most once per cleared-queue moment: reset when the
// queue refills, so clearing it again later the same day toasts again.
export function markClosureShown(counter: string): void {
  try { sessionStorage.setItem(`${key(counter)}:shown`, '1') } catch { /* ignore */ }
}

export function closureAlreadyShown(counter: string): boolean {
  try { return sessionStorage.getItem(`${key(counter)}:shown`) === '1' } catch { return false }
}

export function resetClosureShown(counter: string): void {
  try { sessionStorage.removeItem(`${key(counter)}:shown`) } catch { /* ignore */ }
}
