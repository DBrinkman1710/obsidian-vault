// Mirror the backend caps (inbox/router.py) so users get a clear message
// instead of a raw 413 at send time.
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB per file
const MAX_TOTAL_BYTES = 25 * 1024 * 1024 // 25 MB per message

export function addFilesWithinLimits(
  existing: File[],
  incoming: File[],
): { files: File[]; error: string } {
  const files = [...existing]
  let total = files.reduce((sum, f) => sum + f.size, 0)
  for (const f of incoming) {
    if (f.size > MAX_FILE_BYTES) {
      return { files, error: `${f.name} exceeds the 10 MB per-file limit.` }
    }
    if (total + f.size > MAX_TOTAL_BYTES) {
      return { files, error: 'Attachments exceed the 25 MB total limit.' }
    }
    total += f.size
    files.push(f)
  }
  return { files, error: '' }
}
