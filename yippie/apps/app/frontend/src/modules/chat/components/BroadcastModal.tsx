import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'

interface Props {
  open: boolean
  onClose: () => void
}

export default function BroadcastModal({ open, onClose }: Props) {
  const qc = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [labelFilter, setLabelFilter] = useState('')
  const [message, setMessage] = useState('')
  const [appendBookingLink, setAppendBookingLink] = useState(false)

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-all'],
    queryFn: () => api.get('/contacts', { params: { limit: 200 } }).then(r => r.data.items ?? r.data),
    enabled: open,
  })

  const { data: labels = [] } = useQuery({
    queryKey: ['contact-labels'],
    queryFn: () => api.get('/contacts/labels').then(r => r.data),
    enabled: open,
  })

  const eligibleContacts = useMemo(
    () => contacts.filter((c: any) => !!c.phone),
    [contacts],
  )

  function toggleContact(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleLabelFilterChange(labelId: string) {
    setLabelFilter(labelId)
    if (!labelId) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const c of eligibleContacts) {
        if ((c.labels ?? []).some((l: any) => l.id === labelId)) {
          next.add(c.id)
        }
      }
      return next
    })
  }

  const broadcastMutation = useMutation({
    mutationFn: () =>
      api.post('/chat/broadcast', {
        contact_ids: Array.from(selectedIds),
        message,
        append_booking_link: appendBookingLink,
      }),
    onSuccess: () => {
      toast.success('Broadcast queued')
      reset()
      qc.invalidateQueries({ queryKey: ['chat-sessions'] })
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Could not send broadcast')
    },
  })

  function reset() {
    setSelectedIds(new Set())
    setLabelFilter('')
    setMessage('')
    setAppendBookingLink(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-bold text-slate-900">New broadcast</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left column: contact selection */}
            <div className="flex flex-col min-h-0">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Filter by label
              </label>
              <select
                value={labelFilter}
                onChange={e => handleLabelFilterChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a label to bulk-select…</option>
                {labels.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>

              <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg max-h-64">
                {eligibleContacts.length === 0 && (
                  <p className="px-3 py-4 text-sm text-slate-400 text-center">No contacts with a phone number</p>
                )}
                {eligibleContacts.map((c: any) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2.5 px-3 py-2 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleContact(c.id)}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-800 truncate">{c.full_name}</span>
                    <span className="text-xs text-slate-400 truncate ml-auto">{c.phone}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">{selectedIds.size} contacts selected</p>
            </div>

            {/* Right column: message */}
            <div className="flex flex-col">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Message
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Write your broadcast message…"
                rows={8}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <label className="flex items-center gap-2 mt-3 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={appendBookingLink}
                  onChange={e => setAppendBookingLink(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Insert booking link for each recipient
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            onClick={() => broadcastMutation.mutate()}
            disabled={selectedIds.size === 0 || !message.trim() || broadcastMutation.isPending}
            className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
          >
            {broadcastMutation.isPending ? 'Sending…' : 'Send Broadcast'}
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
