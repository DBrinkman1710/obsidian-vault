import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'

function timeAgo(dt: string) {
  const diff = Date.now() - new Date(dt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(dt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatPage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => api.get('/chat/sessions').then(r => r.data),
    refetchInterval: 10_000,
  })

  const { data: messages = [], isLoading: msgsLoading } = useQuery({
    queryKey: ['chat-messages', selectedId],
    queryFn: () => api.get(`/chat/sessions/${selectedId}/messages`).then(r => r.data),
    enabled: !!selectedId,
    refetchInterval: 5_000,
  })

  const replyMutation = useMutation({
    mutationFn: (body: string) =>
      api.post(`/chat/sessions/${selectedId}/reply`, { body }),
    onSuccess: () => {
      setReplyText('')
      qc.invalidateQueries({ queryKey: ['chat-messages', selectedId] })
    },
  })

  const closeMutation = useMutation({
    mutationFn: (sessionId: string) =>
      api.post(`/chat/sessions/${sessionId}/close`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-sessions'] })
      qc.invalidateQueries({ queryKey: ['chat-messages', selectedId] })
    },
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const selectedSession = sessions.find((s: any) => s.id === selectedId)

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', gap: 0 }}>

      {/* LEFT — Session list */}
      <div style={{
        width: 300, flexShrink: 0, borderRight: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Live Chat</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
            WhatsApp conversations
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sessionsLoading && (
            <p style={{ padding: 20, color: '#94a3b8', fontSize: 13 }}>Loading...</p>
          )}

          {!sessionsLoading && sessions.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>💬</p>
              <p style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>
                No sessions yet
              </p>
              <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                WhatsApp messages will appear here when customers reach out.
              </p>
            </div>
          )}

          {sessions.map((s: any) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '14px 20px',
                background: selectedId === s.id ? '#eff6ff' : 'transparent',
                border: 'none', borderBottom: '1px solid #f1f5f9',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                  {s.visitor_name || s.whatsapp_phone || 'Unknown'}
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  {timeAgo(s.started_at)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {s.source === 'whatsapp' && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#f0fdf4',
                    border: '1px solid #bbf7d0', borderRadius: 10, padding: '1px 6px',
                  }}>
                    WhatsApp
                  </span>
                )}
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
                  background: s.is_open ? '#dbeafe' : '#f1f5f9',
                  color: s.is_open ? '#2563eb' : '#64748b',
                }}>
                  {s.is_open ? 'Open' : 'Closed'}
                </span>
                {s.whatsapp_phone && s.visitor_name && (
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{s.whatsapp_phone}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT — Conversation */}
      {!selectedSession ? (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 12, color: '#94a3b8',
        }}>
          <p style={{ fontSize: 32 }}>💬</p>
          <p style={{ fontSize: 14, fontWeight: 500 }}>Select a conversation</p>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{
            padding: '14px 24px', borderBottom: '1px solid #e2e8f0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#fff',
          }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', margin: 0 }}>
                {selectedSession.visitor_name || selectedSession.whatsapp_phone || 'Unknown visitor'}
              </p>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>
                {selectedSession.whatsapp_phone}
                {' · '}
                Started {new Date(selectedSession.started_at).toLocaleString('en-GB', {
                  dateStyle: 'short', timeStyle: 'short'
                })}
              </p>
            </div>
            {selectedSession.is_open && (
              <button
                onClick={() => closeMutation.mutate(selectedSession.id)}
                disabled={closeMutation.isPending}
                style={{
                  padding: '6px 14px', background: '#f1f5f9', color: '#475569',
                  border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                }}
              >
                Close session
              </button>
            )}
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 12,
            background: '#f8fafc',
          }}>
            {msgsLoading && <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading messages...</p>}

            {messages.map((m: any) => {
              const isAgent = m.sender_type === 'agent'
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: isAgent ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div style={{
                    maxWidth: '70%', padding: '10px 14px', borderRadius: 12,
                    background: isAgent ? '#2563eb' : '#fff',
                    color: isAgent ? '#fff' : '#1e293b',
                    border: isAgent ? 'none' : '1px solid #e2e8f0',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}>
                    <p style={{ fontSize: 14, margin: '0 0 4px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {m.body}
                    </p>
                    <p style={{
                      fontSize: 11, margin: 0,
                      color: isAgent ? 'rgba(255,255,255,0.7)' : '#94a3b8',
                      textAlign: 'right',
                    }}>
                      {formatTime(m.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Reply box */}
          {selectedSession.is_open ? (
            <div style={{
              padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#fff',
              display: 'flex', gap: 12, alignItems: 'flex-end',
            }}>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (replyText.trim()) replyMutation.mutate(replyText.trim())
                  }
                }}
                placeholder="Type a reply… (Enter to send, Shift+Enter for new line)"
                rows={3}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 8,
                  border: '1px solid #cbd5e1', fontSize: 14, resize: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={() => { if (replyText.trim()) replyMutation.mutate(replyText.trim()) }}
                disabled={replyMutation.isPending || !replyText.trim()}
                style={{
                  padding: '10px 20px', background: '#25d366', color: '#fff',
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap',
                }}
              >
                Send ↑
              </button>
            </div>
          ) : (
            <div style={{
              padding: '14px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc',
              textAlign: 'center', color: '#94a3b8', fontSize: 13,
            }}>
              This session is closed.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
