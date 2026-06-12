import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { FileText, Palette, Settings2, Sparkles, X } from 'lucide-react'
import { api } from '../../../api/client'

interface Template {
  id: string
  name: string
  body: string
  html_body: string | null
  campaign_buttons: string | null
}

interface Props {
  onSelect: (body: string, isHtml?: boolean) => void
  context?: string
  triggerClassName?: string
  triggerIconSize?: number
  direction?: 'up' | 'down'
}

export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
}

export function TemplatePicker({ onSelect, context, triggerClassName, triggerIconSize, direction = 'up' }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/tickets/templates').then(r => r.data),
    enabled: open,
  })

  const suggestMutation = useMutation({
    mutationFn: () => api.post('/tickets/templates/ai-suggest', { context: context ?? '' }).then(r => r.data),
  })

  const displayed: Template[] = suggestMutation.data
    ? (suggestMutation.data as Template[])
    : templates.filter(t =>
        !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.body.toLowerCase().includes(search.toLowerCase())
      )

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleSelect(t: Template) {
    if (t.html_body) onSelect(t.html_body, true)
    else onSelect(t.body)
    setOpen(false)
    setSearch('')
    suggestMutation.reset()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={triggerClassName ?? 'px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5'}
      >
        <FileText size={triggerIconSize ?? 12} />
        Templates
      </button>

      {open && (
        <div className={`absolute z-50 right-0 w-80 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden ${
          direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}>
          <div className="px-3 pt-3 pb-2 border-b border-slate-100 flex items-center gap-2">
            <input
              autoFocus
              value={search}
              onChange={e => { setSearch(e.target.value); suggestMutation.reset() }}
              placeholder="Search templates…"
              className="flex-1 text-sm px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
            />
            {context !== undefined && (
              <button
                type="button"
                onClick={() => { setSearch(''); suggestMutation.mutate() }}
                disabled={suggestMutation.isPending}
                title="AI suggest relevant templates"
                className="shrink-0 px-2 py-1.5 bg-yippie text-white rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1"
              >
                <Sparkles size={11} />
                {suggestMutation.isPending ? '…' : 'AI'}
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>

          {suggestMutation.data && (
            <div className="px-3 pt-2">
              <span className="text-[10px] font-bold tracking-widest text-violet-500 uppercase">AI Suggested</span>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto">
            {displayed.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">
                {templates.length === 0 ? 'No templates yet' : 'No matches'}
              </p>
            )}
            {displayed.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelect(t)}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
              >
                <p className="text-sm font-semibold text-slate-800 mb-0.5">{t.name}</p>
                {t.html_body ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded text-[10px] font-semibold">
                    <Palette size={9} />
                    Visual
                  </span>
                ) : (
                  <p className="text-xs text-slate-400 line-clamp-2">{t.body}</p>
                )}
              </button>
            ))}
          </div>

          <Link
            to="/settings/templates"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5 px-3 py-2.5 border-t border-slate-100 text-xs font-semibold text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors"
          >
            <Settings2 size={12} />
            Manage templates
          </Link>
        </div>
      )}
    </div>
  )
}
