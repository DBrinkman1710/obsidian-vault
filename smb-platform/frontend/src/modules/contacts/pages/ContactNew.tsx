import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'

interface FormState {
  full_name: string
  email: string
  phone: string
  company: string
  notes: string
  tags: string
}

const EMPTY: FormState = {
  full_name: '', email: '', phone: '', company: '', notes: '', tags: '',
}

const field: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
}
const label: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase',
}
const input: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1',
  fontSize: 14, color: '#1e293b', width: '100%',
}
const errorStyle: React.CSSProperties = {
  fontSize: 13, color: '#dc2626', marginTop: 2,
}

export default function ContactNew() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<FormState>>({})

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  function validate(): boolean {
    const next: Partial<FormState> = {}
    if (!form.full_name.trim()) next.full_name = 'Name is required'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = 'Enter a valid email address'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/contacts', {
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        notes: form.notes.trim() || null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      navigate(`/contacts/${res.data.id}`)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) mutation.mutate()
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Link to="/contacts" style={{ color: '#64748b', textDecoration: 'none', fontSize: 14 }}>
          ← Contacts
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>New Contact</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={field}>
          <label style={label}>Full name *</label>
          <input
            style={{ ...input, borderColor: errors.full_name ? '#dc2626' : '#cbd5e1' }}
            value={form.full_name} onChange={set('full_name')}
            placeholder="Jan de Vries" autoFocus
          />
          {errors.full_name && <span style={errorStyle}>{errors.full_name}</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={field}>
            <label style={label}>Email</label>
            <input
              style={{ ...input, borderColor: errors.email ? '#dc2626' : '#cbd5e1' }}
              type="email" value={form.email} onChange={set('email')}
              placeholder="jan@example.nl"
            />
            {errors.email && <span style={errorStyle}>{errors.email}</span>}
          </div>
          <div style={field}>
            <label style={label}>Phone</label>
            <input style={input} value={form.phone} onChange={set('phone')} placeholder="+31 6 00000000" />
          </div>
        </div>

        <div style={field}>
          <label style={label}>Company</label>
          <input style={input} value={form.company} onChange={set('company')} placeholder="Acme BV" />
        </div>

        <div style={field}>
          <label style={label}>Tags <span style={{ fontWeight: 400, textTransform: 'none', color: '#94a3b8' }}>(comma-separated)</span></label>
          <input style={input} value={form.tags} onChange={set('tags')} placeholder="vip, enterprise, nl" />
        </div>

        <div style={field}>
          <label style={label}>Notes</label>
          <textarea
            style={{ ...input, resize: 'vertical', minHeight: 100, fontFamily: 'inherit' }}
            value={form.notes} onChange={set('notes')}
            placeholder="Any context about this contact..."
          />
        </div>

        {mutation.isError && (
          <p style={{ color: '#dc2626', fontSize: 14 }}>
            Something went wrong — check the console and try again.
          </p>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="submit" disabled={mutation.isPending}
            style={{
              padding: '10px 24px', background: mutation.isPending ? '#93c5fd' : '#2563eb',
              color: '#fff', border: 'none', borderRadius: 6,
              cursor: mutation.isPending ? 'not-allowed' : 'pointer',
              fontWeight: 600, fontSize: 14,
            }}
          >
            {mutation.isPending ? 'Saving…' : 'Create contact'}
          </button>
          <Link to="/contacts" style={{
            padding: '10px 20px', color: '#64748b', textDecoration: 'none',
            fontSize: 14, display: 'flex', alignItems: 'center',
          }}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
