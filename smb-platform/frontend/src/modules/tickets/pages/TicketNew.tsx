import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'

interface Contact {
  id: string
  full_name: string
  email: string | null
  company: string | null
}

const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase',
}
const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1',
  fontSize: 14, color: '#1e293b', width: '100%',
}
const errorStyle: React.CSSProperties = { fontSize: 13, color: '#dc2626', marginTop: 2 }

function ContactPicker({
  value, onChange,
}: {
  value: { id: string; label: string } | null
  onChange: (c: { id: string; label: string } | null) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['contacts-picker', search],
    queryFn: () =>
      api.get<{ items: Contact[] }>('/contacts', {
        params: { search: search || undefined, limit: 8 },
      }).then(r => r.data.items),
    enabled: open,
  })

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          padding: '6px 12px', background: '#eff6ff', color: '#1d4ed8',
          borderRadius: 6, fontSize: 14, fontWeight: 500,
        }}>
          {value.label}
        </span>
        <button
          type="button" onClick={() => onChange(null)}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search contacts by name, email or company…"
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,.1)', marginTop: 2, maxHeight: 260, overflowY: 'auto',
        }}>
          {!data?.length && (
            <div style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 14 }}>
              {search ? 'No contacts found' : 'Start typing to search…'}
            </div>
          )}
          {data?.map(c => (
            <button
              key={c.id} type="button"
              onMouseDown={() => {
                onChange({ id: c.id, label: c.company ? `${c.full_name} (${c.company})` : c.full_name })
                setOpen(false)
                setSearch('')
              }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 14, color: '#1e293b',
                borderBottom: '1px solid #f1f5f9',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontWeight: 500 }}>{c.full_name}</span>
              {c.company && <span style={{ color: '#64748b', marginLeft: 6 }}>{c.company}</span>}
              {c.email && <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 13 }}>{c.email}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TicketNew() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()

  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [contact, setContact] = useState<{ id: string; label: string } | null>(null)
  const [departmentId, setDepartmentId] = useState('')
  const [errors, setErrors] = useState<{ subject?: string }>({})

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then(r => r.data),
  })

  // Pre-fill contact if navigated from a contact page: /tickets/new?contact_id=...&contact_name=...
  useEffect(() => {
    const id = searchParams.get('contact_id')
    const name = searchParams.get('contact_name')
    if (id && name) setContact({ id, label: name })
  }, [searchParams])

  function validate() {
    const next: { subject?: string } = {}
    if (!subject.trim()) next.subject = 'Subject is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/tickets', {
        subject: subject.trim(),
        description: description.trim() || null,
        priority,
        contact_id: contact?.id ?? null,
        department_id: departmentId || null,
        source: 'manual',
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['tickets'] })
      navigate(`/tickets/${res.data.id}`)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) mutation.mutate()
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Link to="/tickets" style={{ color: '#64748b', textDecoration: 'none', fontSize: 14 }}>
          ← Tickets
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>New Ticket</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={field}>
          <label style={labelStyle}>Subject *</label>
          <input
            style={{ ...inputStyle, borderColor: errors.subject ? '#dc2626' : '#cbd5e1' }}
            value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="Short description of the issue" autoFocus
          />
          {errors.subject && <span style={errorStyle}>{errors.subject}</span>}
        </div>

        <div style={field}>
          <label style={labelStyle}>Contact <span style={{ fontWeight: 400, textTransform: 'none', color: '#94a3b8' }}>(optional)</span></label>
          <ContactPicker value={contact} onChange={setContact} />
        </div>

        <div style={field}>
          <label style={labelStyle}>Priority</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['low', 'medium', 'high', 'urgent'] as const).map(p => {
              const colors: Record<string, string> = {
                low: '#6b7280', medium: '#2563eb', high: '#d97706', urgent: '#dc2626',
              }
              const selected = priority === p
              return (
                <button
                  key={p} type="button" onClick={() => setPriority(p)}
                  style={{
                    padding: '6px 16px', borderRadius: 20, border: `1.5px solid ${colors[p]}`,
                    background: selected ? colors[p] : 'transparent',
                    color: selected ? '#fff' : colors[p],
                    fontWeight: 600, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize',
                  }}
                >
                  {p}
                </button>
              )
            })}
          </div>
        </div>

        <div style={field}>
          <label style={labelStyle}>Department <span style={{ fontWeight: 400, textTransform: 'none', color: '#94a3b8' }}>(optional)</span></label>
          <select
            value={departmentId}
            onChange={e => setDepartmentId(e.target.value)}
            style={{ ...inputStyle, background: '#fff' }}
          >
            <option value="">No department</option>
            {departments?.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name} ({d.sla_working_days}d SLA)</option>
            ))}
          </select>
        </div>

        <div style={field}>
          <label style={labelStyle}>Description</label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: 120, fontFamily: 'inherit' }}
            value={description} onChange={e => setDescription(e.target.value)}
            placeholder="What happened? Any relevant details, error messages, or steps to reproduce…"
          />
        </div>

        {mutation.isError && (
          <p style={{ color: '#dc2626', fontSize: 14 }}>
            Something went wrong — check the console and try again.
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            type="submit" disabled={mutation.isPending}
            style={{
              padding: '10px 24px',
              background: mutation.isPending ? '#93c5fd' : '#2563eb',
              color: '#fff', border: 'none', borderRadius: 6,
              cursor: mutation.isPending ? 'not-allowed' : 'pointer',
              fontWeight: 600, fontSize: 14,
            }}
          >
            {mutation.isPending ? 'Creating…' : 'Create ticket'}
          </button>
          <Link to="/tickets" style={{
            padding: '10px 20px', color: '#64748b', textDecoration: 'none', fontSize: 14,
          }}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
