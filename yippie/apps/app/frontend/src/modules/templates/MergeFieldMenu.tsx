// Merge field chips ([TMPL2]) — click to insert {{field}} at the cursor of the
// associated text control. Fields come from the per doc_type fields endpoint.
import type { RefObject } from 'react'

export function MergeFieldChips({
  fields, targetRef, value, onChange,
}: {
  fields: string[]
  targetRef: RefObject<HTMLTextAreaElement | HTMLInputElement | null>
  value: string
  onChange: (next: string) => void
}) {
  if (fields.length === 0) return null

  function insert(field: string) {
    const token = `{{${field}}}`
    const el = targetRef.current
    if (!el) { onChange(value + token); return }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? start
    onChange(value.slice(0, start) + token + value.slice(end))
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {fields.map(f => (
        <button
          key={f}
          type="button"
          onClick={() => insert(f)}
          className="px-2 py-0.5 text-xs font-mono bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200"
        >
          {`{{${f}}}`}
        </button>
      ))}
    </div>
  )
}
