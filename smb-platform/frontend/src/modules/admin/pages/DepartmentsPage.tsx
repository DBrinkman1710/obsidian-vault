import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'

const DEFAULT_TEMPLATE_HINT =
  'Leave blank to use the default: "I\'m sorry to hear about your situation. I have informed my colleagues at {name} about your inquiry. You can expect a response within {sla} working days."'

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1',
  fontSize: 14, color: '#1e293b', width: '100%', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4,
}

interface Dept {
  id: string
  name: string
  email: string
  reply_template: string | null
  sla_working_days: number
  created_at: string
}

interface FormState {
  name: string
  email: string
  reply_template: string
  sla_working_days: string
}

const EMPTY: FormState = { name: '', email: '', reply_template: '', sla_working_days: '3' }

function DeptForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: FormState
  onSave: (f: FormState) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)
  const [error, setError] = useState('')

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.email.trim()) { setError('Email is required'); return }
    setError('')
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} style={{
      background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
      padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={labelStyle}>Department name *</label>
          <input style={inputStyle} value={form.name} onChange={set('name')} placeholder="Finance" autoFocus />
        </div>
        <div>
          <label style={labelStyle}>Email address *</label>
          <input style={inputStyle} type="email" value={form.email} onChange={set('email')} placeholder="finance@company.nl" />
        </div>
      </div>

      <div>
        <label style={labelStyle}>SLA (working days)</label>
        <input
          style={{ ...inputStyle, width: 80 }}
          type="number" min={1} max={90}
          value={form.sla_working_days}
          onChange={set('sla_working_days')}
        />
      </div>

      <div>
        <label style={labelStyle}>
          Reply template{' '}
          <span style={{ fontWeight: 400, color: '#94a3b8' }}>
            — use <code style={{ fontSize: 11 }}>{'{name}'}</code> and <code style={{ fontSize: 11 }}>{'{sla}'}</code> as placeholders
          </span>
        </label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 88, fontFamily: 'inherit' }}
          value={form.reply_template}
          onChange={set('reply_template')}
          placeholder={DEFAULT_TEMPLATE_HINT}
        />
      </div>

      {error && <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: '8px 20px', background: isPending ? '#93c5fd' : '#2563eb',
            color: '#fff', border: 'none', borderRadius: 6,
            cursor: isPending ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
          }}
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '8px 16px', background: '#f1f5f9', color: '#475569',
            border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function DepartmentsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: departments, isLoading } = useQuery<Dept[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (f: FormState) =>
      api.post('/departments', {
        name: f.name.trim(),
        email: f.email.trim(),
        reply_template: f.reply_template.trim() || null,
        sla_working_days: parseInt(f.sla_working_days) || 3,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] })
      setShowCreate(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: string; f: FormState }) =>
      api.patch(`/departments/${id}`, {
        name: f.name.trim(),
        email: f.email.trim(),
        reply_template: f.reply_template.trim() || null,
        sla_working_days: parseInt(f.sla_working_days) || 3,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] })
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  })

  if (user?.role !== 'admin') {
    return <p style={{ color: '#ef4444', padding: 32 }}>Access denied — admin only.</p>
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Departments</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>
            Route inbox messages to specialist departments. Each department gets its own reply template.
          </p>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: '8px 18px', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14,
              whiteSpace: 'nowrap',
            }}
          >
            + New Department
          </button>
        )}
      </div>

      {showCreate && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>New Department</p>
          <DeptForm
            initial={EMPTY}
            onSave={f => createMutation.mutate(f)}
            onCancel={() => setShowCreate(false)}
            isPending={createMutation.isPending}
          />
        </div>
      )}

      {isLoading && <p style={{ color: '#94a3b8' }}>Loading…</p>}

      {!isLoading && departments?.length === 0 && !showCreate && (
        <p style={{ color: '#94a3b8', marginTop: 24 }}>No departments yet. Create one to start routing inbox messages.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        {departments?.map(dept => (
          <div key={dept.id}>
            {editingId === dept.id ? (
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Edit {dept.name}</p>
                <DeptForm
                  initial={{
                    name: dept.name,
                    email: dept.email,
                    reply_template: dept.reply_template ?? '',
                    sla_working_days: String(dept.sla_working_days),
                  }}
                  onSave={f => updateMutation.mutate({ id: dept.id, f })}
                  onCancel={() => setEditingId(null)}
                  isPending={updateMutation.isPending}
                />
              </div>
            ) : (
              <div style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{dept.name}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: '#7c3aed',
                      background: '#f5f3ff', padding: '2px 8px', borderRadius: 10,
                    }}>
                      {dept.sla_working_days}d SLA
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 4px' }}>{dept.email}</p>
                  {dept.reply_template ? (
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, fontStyle: 'italic' }}>
                      Custom template set
                    </p>
                  ) : (
                    <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0 }}>Using default template</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                  <button
                    onClick={() => setEditingId(dept.id)}
                    style={{
                      padding: '5px 14px', background: '#f1f5f9', color: '#475569',
                      border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${dept.name}"?`)) deleteMutation.mutate(dept.id)
                    }}
                    style={{
                      padding: '5px 14px', background: '#fff', color: '#ef4444',
                      border: '1px solid #fca5a5', borderRadius: 5, cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
