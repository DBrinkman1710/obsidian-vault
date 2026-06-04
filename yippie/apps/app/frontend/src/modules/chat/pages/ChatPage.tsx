import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Send, X } from 'lucide-react'
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
    mutationFn: (body: string) => api.post(`/chat/sessions/${selectedId}/reply`, { body }),
    onSuccess: () => {
      setReplyText('')
      qc.invalidateQueries({ queryKey: ['chat-messages', selectedId] })
    },
  })

  const closeMutation = useMutation({
    mutationFn: (sessionId: string) => api.post(`/chat/sessions/${sessionId}/close`),
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
    <div className="-m-8 flex h-[calc(100vh-0px)]" style={{ height: 'calc(100vh - 0px)' }}>
      {/* LEFT — Session list */}
      <div className="w-72 flex-shrink-0 border-r border-slate-200 flex flex-col bg-white">
        <div className="px-5 py-4 border-b border-slate-200">
          <h1 className="text-base font-bold text-slate-900">Live Chat</h1>
          <p className="text-xs text-slate-400 mt-0.5">WhatsApp conversations</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessionsLoading && <p className="p-5 text-sm text-slate-400">Loading…</p>}

          {!sessionsLoading && sessions.length === 0 && (
            <div className="p-8 text-center">
              <MessageSquare size={28} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-600 mb-1">No sessions yet</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                WhatsApp messages appear here when customers reach out.
              </p>
            </div>
          )}

          {sessions.map((s: any) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`w-full text-left px-5 py-3.5 border-b border-slate-100 flex flex-col gap-1.5 transition-colors ${selectedId === s.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900 truncate">
                  {s.visitor_name || s.whatsapp_phone || 'Unknown'}
                </span>
                <span className="text-xs text-slate-400 flex-shrink-0 ml-2">{timeAgo(s.started_at)}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {s.source === 'whatsapp' && (
                  <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">WhatsApp</span>
                )}
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${s.is_open ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                  {s.is_open ? 'Open' : 'Closed'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT — Conversation */}
      {!selectedSession ? (
        <div className="flex-1 flex items-center justify-center flex-col gap-3 text-slate-400 bg-slate-50">
          <MessageSquare size={36} className="text-slate-300" />
          <p className="text-sm font-medium">Select a conversation</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white">
            <div>
              <p className="font-bold text-sm text-slate-900">
                {selectedSession.visitor_name || selectedSession.whatsapp_phone || 'Unknown visitor'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedSession.whatsapp_phone}
                {' · '}
                Started {new Date(selectedSession.started_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
            {selectedSession.is_open && (
              <button
                onClick={() => closeMutation.mutate(selectedSession.id)}
                disabled={closeMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
              >
                <X size={12} />
                Close session
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3 bg-slate-50">
            {msgsLoading && <p className="text-sm text-slate-400">Loading messages…</p>}
            {messages.map((m: any) => {
              const isAgent = m.sender_type === 'agent'
              return (
                <div key={m.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl shadow-sm ${isAgent ? 'bg-blue-600 text-white' : 'bg-white text-slate-900 border border-slate-200'}`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.body}</p>
                    <p className={`text-xs mt-1 text-right ${isAgent ? 'text-blue-200' : 'text-slate-400'}`}>
                      {formatTime(m.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {selectedSession.is_open ? (
            <div className="px-6 py-4 border-t border-slate-200 bg-white flex gap-3 items-end">
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
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm resize-none font-[inherit] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => { if (replyText.trim()) replyMutation.mutate(replyText.trim()) }}
                disabled={replyMutation.isPending || !replyText.trim()}
                className="px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Send size={14} />
                Send
              </button>
            </div>
          ) : (
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 text-center text-sm text-slate-400">
              This session is closed.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
