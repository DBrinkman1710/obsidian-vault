// [YIP-STREAM] SSE over fetch client for POST /jarvis/capture/stream.
//
// The backend frames events as `data: <json>\n\n`. Streamed deltas are a
// preview only — the terminal result event carries the authoritative
// CaptureResponse. Transport failures throw so the caller can fall back to
// the JSON /jarvis/capture endpoint; server side errors arrive as an error
// event and do NOT throw (the request already ran — retrying could double
// write reminders or notes).

export interface StreamHandlers {
  onThread?: (threadId: string) => void
  onStatus?: (tool: string) => void
  onDelta?: (text: string) => void
  onResult: (data: any) => void
  onError?: (detail: string) => void
}

export async function streamCapture(
  payload: Record<string, any>,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/v1/jarvis/capture/stream', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`stream failed: ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let terminal = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      const line = raw.split('\n').find(l => l.startsWith('data: '))
      if (!line) continue
      let evt: any
      try { evt = JSON.parse(line.slice(6)) } catch { continue }
      switch (evt.type) {
        case 'thread': handlers.onThread?.(evt.thread_id); break
        case 'status': handlers.onStatus?.(evt.tool); break
        case 'delta': handlers.onDelta?.(evt.text); break
        case 'result': terminal = true; handlers.onResult(evt.data); break
        case 'error': terminal = true; handlers.onError?.(evt.detail ?? 'Something went wrong.'); break
      }
    }
  }
  if (!terminal) throw new Error('stream ended without a result')
}
