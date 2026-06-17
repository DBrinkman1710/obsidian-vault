import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, GripVertical, Loader2, Plus, Settings2, Trash2, User, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { useTenantConfig } from '../../App'
import SendBookingModal from '../booking/SendBookingModal'

interface PipelineStage {
  id: string
  name: string
  color: string
  display_order: number
  contact_count: number
}
interface BoardContact {
  contact_id: string
  full_name: string
  email: string | null
  company_name: string | null
  entered_at: string
}
interface BoardColumn {
  stage: PipelineStage
  contacts: BoardContact[]
}

// ──────────────────────────────────────────────────────────────
// Stage management modal
// ──────────────────────────────────────────────────────────────
function StageModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#64748b')
  const [error, setError] = useState('')
  const dragIdx = useRef<number | null>(null)

  const { data: stages = [] } = useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (b: object) => api.post('/pipeline/stages', b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipeline-stages'] }); qc.invalidateQueries({ queryKey: ['pipeline-board'] }); resetForm() },
    onError: () => setError('Save failed'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, b }: { id: string; b: object }) => api.patch(`/pipeline/stages/${id}`, b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipeline-stages'] }); qc.invalidateQueries({ queryKey: ['pipeline-board'] }); resetForm() },
    onError: () => setError('Save failed'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/pipeline/stages/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipeline-stages'] }); qc.invalidateQueries({ queryKey: ['pipeline-board'] }) },
  })
  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => api.put('/pipeline/stages/reorder', { ids }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipeline-stages'] }); qc.invalidateQueries({ queryKey: ['pipeline-board'] }) },
  })

  function resetForm() {
    setEditId(null); setName(''); setColor('#64748b'); setError('')
  }
  function startEdit(s: PipelineStage) {
    setEditId(s.id); setName(s.name); setColor(s.color); setError('')
  }
  function handleSave() {
    if (!name.trim()) { setError('Name required'); return }
    const body = { name: name.trim(), color }
    if (editId) updateMut.mutate({ id: editId, b: body })
    else createMut.mutate(body)
  }

  // Drag reorder
  function onDragStart(i: number) { dragIdx.current = i }
  function onDrop(i: number) {
    const from = dragIdx.current
    if (from === null || from === i) return
    const ids = [...stages.map(s => s.id)]
    const [moved] = ids.splice(from, 1)
    ids.splice(i, 0, moved)
    reorderMut.mutate(ids)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-[520px] max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-sm font-bold text-slate-900">Manage Kanban Stages</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X size={16} />
          </button>
        </div>

        {/* Stage list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {stages.length === 0 && (
            <p className="px-6 py-8 text-sm text-slate-400 text-center">No stages yet. Add one below.</p>
          )}
          {stages.map((s, i) => (
            <div
              key={s.id}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => onDrop(i)}
              className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50 cursor-grab active:cursor-grabbing"
            >
              <GripVertical size={14} className="text-slate-300 shrink-0" />
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: s.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
              </div>
              <span className="text-xs text-slate-400 shrink-0">{s.contact_count}</span>
              <button
                onClick={() => startEdit(s)}
                className="shrink-0 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit"
              >
                <Settings2 size={13} />
              </button>
              <button
                onClick={() => { if (confirm(`Delete "${s.name}"? Contacts will be removed from this stage.`)) deleteMut.mutate(s.id) }}
                className="shrink-0 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* Add / edit form */}
        <div className="shrink-0 border-t border-slate-100 px-6 py-4 bg-slate-50 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            {editId ? 'Edit stage' : 'New stage'}
          </p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Stage name…"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
              title="Stage colour"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {editId ? 'Update' : 'Add stage'}
            </button>
            {editId && (
              <button
                onClick={resetForm}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-sm font-semibold text-slate-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Add-contact-to-stage picker
// ──────────────────────────────────────────────────────────────
function AddContactModal({
  stageId,
  existingContactIds,
  onClose,
}: {
  stageId: string
  existingContactIds: Set<string>
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: contacts = [] } = useQuery<{ id: string; full_name: string; email: string | null }[]>({
    queryKey: ['contacts-search', search],
    queryFn: () => api.get('/contacts', { params: { search, limit: 50 } }).then(r => r.data.items ?? r.data),
  })

  const moveMut = useMutation({
    mutationFn: (contactId: string) => api.put(`/pipeline/contacts/${contactId}/stage`, { stage_id: stageId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipeline-board'] }); onClose() },
  })

  const available = contacts.filter(c => !existingContactIds.has(c.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-[420px] max-h-[70vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {available.length === 0 && (
            <p className="px-5 py-8 text-sm text-slate-400 text-center">
              {contacts.length === 0 ? 'No contacts found' : 'All matching contacts are already in the kanban'}
            </p>
          )}
          {available.map(c => (
            <button
              key={c.id}
              onClick={() => moveMut.mutate(c.id)}
              disabled={moveMut.isPending}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                <User size={14} className="text-slate-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{c.full_name}</p>
                {c.email && <p className="text-xs text-slate-400 truncate">{c.email}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Contact card
// ──────────────────────────────────────────────────────────────
function ContactCard({
  contact,
  onDragStart,
  onRemove,
  selectable,
  selected,
  onToggleSelect,
}: {
  contact: BoardContact
  onDragStart: () => void
  onRemove: () => void
  selectable: boolean
  selected: boolean
  onToggleSelect: () => void
}) {
  const daysIn = Math.floor(
    (Date.now() - new Date(contact.entered_at).getTime()) / 86_400_000
  )

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`bg-white rounded-xl border px-3 py-2.5 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group ${
        selected ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200'}`}
    >
      <div className="flex items-start justify-between gap-1">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            draggable={false}
            onClick={e => e.stopPropagation()}
            className={`mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer transition-opacity ${
              selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <Link
            to={`/contacts/${contact.contact_id}`}
            className="text-sm font-semibold text-slate-800 hover:text-blue-600 truncate block"
            draggable={false}
          >
            {contact.full_name}
          </Link>
          {contact.email && (
            <p className="text-[11px] text-slate-400 truncate">{contact.email}</p>
          )}
          {contact.company_name && !contact.email && (
            <p className="text-[11px] text-slate-400 truncate">{contact.company_name}</p>
          )}
        </div>
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-red-400 rounded transition-all shrink-0"
          title="Remove from kanban"
          draggable={false}
        >
          <X size={12} />
        </button>
      </div>
      <p className="text-[10px] text-slate-300 mt-1.5">
        {daysIn === 0 ? 'Added today' : daysIn === 1 ? '1 day' : `${daysIn} days`}
      </p>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────────
export default function PipelinePage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const config = useTenantConfig()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const bookingEnabled = config?.enabled_modules?.includes('booking') ?? false

  const [showManage, setShowManage] = useState(false)
  const [addToStage, setAddToStage] = useState<string | null>(null)
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [bookingOpen, setBookingOpen] = useState(false)
  const dragContactRef = useRef<{ contactId: string; fromStageId: string } | null>(null)

  function toggleContact(id: string) {
    setSelectedContacts(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  function clearSelection() { setSelectedContacts(new Set()) }

  const { data: board = [], isLoading } = useQuery<BoardColumn[]>({
    queryKey: ['pipeline-board'],
    queryFn: () => api.get('/pipeline/board').then(r => r.data),
  })

  const moveMut = useMutation({
    mutationFn: ({ contactId, stageId }: { contactId: string; stageId: string }) =>
      api.put(`/pipeline/contacts/${contactId}/stage`, { stage_id: stageId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipeline-board'] }),
  })

  const removeMut = useMutation({
    mutationFn: (contactId: string) => api.delete(`/pipeline/contacts/${contactId}/stage`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipeline-board'] }),
  })

  const allContactIds = new Set(board.flatMap(col => col.contacts.map(c => c.contact_id)))

  function handleDrop(toStageId: string) {
    const drag = dragContactRef.current
    if (!drag || drag.fromStageId === toStageId) return
    moveMut.mutate({ contactId: drag.contactId, stageId: toStageId })
    dragContactRef.current = null
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={22} className="text-blue-500 animate-spin" />
      </div>
    )
  }

  const addStageContacts = addToStage
    ? new Set(board.find(c => c.stage.id === addToStage)?.contacts.map(c => c.contact_id) ?? [])
    : new Set<string>()

  // Flatten board → {id, full_name} for the booking modal (dedupe across columns).
  const contactNameById = new Map<string, string>()
  for (const col of board) {
    for (const c of col.contacts) contactNameById.set(c.contact_id, c.full_name)
  }
  const selectedContactList = [...selectedContacts]
    .filter(id => contactNameById.has(id))
    .map(id => ({ id, full_name: contactNameById.get(id)! }))

  return (
    <>
      {showManage && <StageModal onClose={() => setShowManage(false)} />}
      {bookingEnabled && (
        <SendBookingModal
          contacts={selectedContactList}
          bulk
          open={bookingOpen}
          onClose={() => { setBookingOpen(false); clearSelection() }}
        />
      )}
      {bookingEnabled && selectedContacts.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-lg">
          <span className="text-sm font-semibold text-slate-700">
            {selectedContacts.size} selected
          </span>
          <div className="h-4 w-px bg-slate-200" />
          <button
            onClick={() => setBookingOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <CalendarClock size={14} strokeWidth={2.5} />
            Send booking link to {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''}
          </button>
          <button
            onClick={clearSelection}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Clear selection
          </button>
        </div>
      )}
      {addToStage && (
        <AddContactModal
          stageId={addToStage}
          existingContactIds={addStageContacts}
          onClose={() => setAddToStage(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Kanban</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {allContactIds.size} contact{allContactIds.size !== 1 ? 's' : ''} in kanban
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowManage(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition-colors"
          >
            <Settings2 size={13} />
            Manage stages
          </button>
        )}
      </div>

      {board.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <GripVertical size={24} className="text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-600 mb-1">No kanban stages yet</p>
          <p className="text-xs text-slate-400 mb-4">
            {isAdmin ? 'Create stages to start tracking contacts through your kanban.' : 'Ask an admin to set up kanban stages.'}
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowManage(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Plus size={14} />
              Create first stage
            </button>
          )}
        </div>
      ) : (
        /* Kanban board — horizontally scrollable */
        <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-13rem)] items-start">
          {board.map(col => (
            <div
              key={col.stage.id}
              className="shrink-0 w-64 flex flex-col rounded-xl bg-slate-100 overflow-hidden"
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(col.stage.id)}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-100">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: col.stage.color }}
                />
                <p className="flex-1 text-xs font-bold text-slate-700 truncate">
                  {col.stage.name}
                </p>
                <span className="text-xs font-semibold text-slate-400 bg-white px-1.5 py-0.5 rounded-full">
                  {col.contacts.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2 min-h-[4rem]">
                {col.contacts.map(contact => (
                  <ContactCard
                    key={contact.contact_id}
                    contact={contact}
                    selectable={bookingEnabled}
                    selected={selectedContacts.has(contact.contact_id)}
                    onToggleSelect={() => toggleContact(contact.contact_id)}
                    onDragStart={() => {
                      dragContactRef.current = {
                        contactId: contact.contact_id,
                        fromStageId: col.stage.id,
                      }
                    }}
                    onRemove={() => removeMut.mutate(contact.contact_id)}
                  />
                ))}
              </div>

              {/* Add contact */}
              <div className="px-2 pb-2">
                <button
                  onClick={() => setAddToStage(col.stage.id)}
                  className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors border border-dashed border-slate-200 hover:border-slate-300"
                >
                  <Plus size={12} />
                  Add contact
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
