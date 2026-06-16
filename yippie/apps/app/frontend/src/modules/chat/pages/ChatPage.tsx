import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Megaphone, MessageSquare, Search, Send, SquarePen, X } from 'lucide-react'
import { api } from '../../../api/client'
import { useMobile } from '../../../shell/useMobile'
import BroadcastModal from '../components/BroadcastModal'

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
  const isMobile = useMobile()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showConversation, setShowConversation] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sidebarMode, setSidebarMode] = useState<'sessions' | 'search'>('sessions')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => api.get('/chat/sessions').then(r => r.data),
    refetchInterval: 10_000,
  })

  const { data: whatsappStatus } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: () => api.get('/chat/whatsapp/status').then(r => r.data),
    refetchInterval: 5_000,
  })

  const isConnected = whatsappStatus?.state === 'open'

  const { data: qrData, isLoading: qrLoading, isError: qrError } = useQuery({
    queryKey: ['whatsapp-qr'],
    queryFn: () => api.get('/chat/whatsapp/qr').then(r => r.data),
    enabled: !isConnected,
    refetchInterval: isConnected ? false : 15_000,
  })

  const { data: contactResults = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['contact-search', debouncedQuery],
    queryFn: () => api.get('/contacts', { params: { search: debouncedQuery, limit: 20 } }).then(r => r.data.items ?? r.data),
    enabled: sidebarMode === 'search' && debouncedQuery.length > 0,
  })

  const createSessionMutation = useMutation({
    mutationFn: (contact: any) => api.post('/chat/sessions', { phone: contact.phone, contact_id: contact.id }).then(r => r.data),
    onSuccess: (session) => {
      setSelectedId(session.id)
      qc.invalidateQueries({ queryKey: ['chat-sessions'] })
      setSidebarMode('sessions')
      setSearchQuery('')
      if (isMobile) setShowConversation(true)
    },
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

  // Agent WebSocket — real-time events for all sessions in this tenant
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      const token = localStorage.getItem('access_token')
      if (!token) return
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${location.host}/api/v1/chat/ws/agent?token=${encodeURIComponent(token)}`)

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as { event: string; session_id?: string; sender_type?: string; body?: string }
          if (data.event === 'message') {
            qc.invalidateQueries({ queryKey: ['chat-messages', data.session_id] })
            if (data.sender_type === 'visitor') {
              qc.invalidateQueries({ queryKey: ['chat-sessions'] })
              qc.invalidateQueries({ queryKey: ['chat-open-count'] })
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('New chat message', {
                  body: (data.body ?? '').slice(0, 100),
                  icon: '/logo.svg',
                })
              }
            }
          } else if (data.event === 'new_session') {
            qc.invalidateQueries({ queryKey: ['chat-sessions'] })
            qc.invalidateQueries({ queryKey: ['chat-open-count'] })
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('New chat session', {
                body: 'A visitor has started a conversation.',
                icon: '/logo.svg',
              })
            }
          } else if (data.event === 'unread_update') {
            qc.invalidateQueries({ queryKey: ['chat-sessions'] })
          }
        } catch { /* ignore malformed frames */ }
      }

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [qc])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const selectedSession = sessions.find((s: any) => s.id === selectedId)

  function handleSelectSession(s: any) {
    setSelectedId(s.id)
    if (isMobile) setShowConversation(true)
    if (s.unread_count > 0) {
      api.post(`/chat/sessions/${s.id}/read`).catch(() => {})
      qc.setQueryData(['chat-sessions'], (old: any) =>
        (old ?? []).map((sess: any) => sess.id === s.id ? { ...sess, unread_count: 0 } : sess)
      )
      qc.invalidateQueries({ queryKey: ['chat-sessions'] })
    }
  }

  const sessionList = (
    <div className="flex flex-col bg-white h-full">
      <div className="px-5 py-4 border-b border-slate-200">
        {sidebarMode === 'search' ? (
          <div className="flex items-center gap-2">
            <input
              type="search"
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={() => { setSidebarMode('sessions'); setSearchQuery('') }}
              className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-base font-bold text-slate-900">Live Chat</h1>
                <p className="text-xs text-slate-400 mt-0.5">WhatsApp conversations</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSidebarMode('search')}
                  title="New conversation"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <SquarePen size={16} />
                </button>
                <button
                  onClick={() => setShowBroadcastModal(true)}
                  title="New broadcast"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <Megaphone size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      {!isConnected && (
        <div className="mx-4 mt-4 bg-white border border-slate-200 rounded-xl p-4 text-center flex-shrink-0">
          <h2 className="text-sm font-bold text-slate-900 mb-1">Connect WhatsApp</h2>
          <p className="text-xs text-slate-500 mb-3">Scan with WhatsApp to connect</p>
          {qrLoading && <p className="text-xs text-slate-400 py-6">Loading QR code…</p>}
          {!qrLoading && qrError && <p className="text-xs text-red-500 py-6">Could not load QR code. Retrying…</p>}
          {!qrLoading && !qrError && qrData?.base64 && (
            <>
              <img src={qrData.base64} alt="WhatsApp pairing QR code" className="w-40 h-40 mx-auto" />
              {qrData.pairing_code && (
                <p className="text-xs text-slate-500 mt-2 font-mono">{qrData.pairing_code}</p>
              )}
            </>
          )}
          {!qrLoading && !qrError && !qrData?.base64 && (
            <p className="text-xs text-slate-400 py-6">Waiting for QR code…</p>
          )}
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {sidebarMode === 'search' ? (
          <>
            {contactsLoading && <p className="p-5 text-sm text-slate-400">Searching…</p>}
            {!contactsLoading && debouncedQuery.length > 0 && contactResults.length === 0 && (
              <div className="p-8 text-center">
                <Search size={24} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No contacts found</p>
              </div>
            )}
            {contactResults.map((c: any) => (
              <button
                key={c.id}
                onClick={() => createSessionMutation.mutate(c)}
                disabled={!c.phone || createSessionMutation.isPending}
                className="w-full text-left px-5 py-3 border-b border-slate-100 flex flex-col gap-0.5 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <span className="text-sm font-semibold text-slate-900 truncate">{c.full_name}</span>
                <span className="text-xs text-slate-400 truncate">{c.phone || 'No phone number'}</span>
              </button>
            ))}
          </>
        ) : (
          <>
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
                onClick={() => handleSelectSession(s)}
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
                  {s.unread_count > 0 && (
                    <span className="text-xs font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                      {s.unread_count}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )

  const conversationPanel = selectedSession ? (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 md:px-6 py-3.5 border-b border-slate-200 flex items-center gap-3 bg-white">
        {isMobile && (
          <button
            onClick={() => setShowConversation(false)}
            className="p-1.5 -ml-1 text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-slate-900 truncate">
            {selectedSession.visitor_name || selectedSession.whatsapp_phone || 'Unknown visitor'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {selectedSession.whatsapp_phone}
            {' · '}
            Started {new Date(selectedSession.started_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        </div>
        {selectedSession.is_open && (
          <button
            onClick={() => closeMutation.mutate(selectedSession.id)}
            disabled={closeMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
          >
            <X size={12} />
            Close
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 flex flex-col gap-3 bg-slate-50">
        {msgsLoading && <p className="text-sm text-slate-400">Loading messages…</p>}
        {messages.map((m: any) => {
          const isAgent = m.sender_type === 'agent'
          return (
            <div key={m.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl shadow-sm ${isAgent ? 'bg-blue-600 text-white' : 'bg-white text-slate-900 border border-slate-200'}`}>
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
        <div className="px-4 md:px-6 py-4 border-t border-slate-200 bg-white flex gap-3 items-end">
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (replyText.trim()) replyMutation.mutate(replyText.trim())
              }
            }}
            placeholder="Type a reply…"
            rows={isMobile ? 2 : 3}
            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm resize-none font-[inherit] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => { if (replyText.trim()) replyMutation.mutate(replyText.trim()) }}
            disabled={replyMutation.isPending || !replyText.trim()}
            className="px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Send size={14} />
            {!isMobile && 'Send'}
          </button>
        </div>
      ) : (
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 text-center text-sm text-slate-400">
          This session is closed.
        </div>
      )}
    </div>
  ) : (
    <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
        <button
          onClick={() => setSidebarMode('search')}
          className="text-left border border-slate-200 rounded-xl p-6 bg-white hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <SquarePen size={20} className="text-blue-600 mb-3" />
          <p className="text-sm font-bold text-slate-900 mb-1">Want to message someone directly?</p>
          <p className="text-xs text-slate-500">Start a new conversation</p>
        </button>
        <button
          onClick={() => setShowBroadcastModal(true)}
          className="text-left border border-slate-200 rounded-xl p-6 bg-white hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <Megaphone size={20} className="text-blue-600 mb-3" />
          <p className="text-sm font-bold text-slate-900 mb-1">Send a group update?</p>
          <p className="text-xs text-slate-500">Create a multi-contact broadcast</p>
        </button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <div className="-m-4 flex flex-col h-[calc(100vh-4rem)]">
        {showConversation ? conversationPanel : sessionList}
        <BroadcastModal open={showBroadcastModal} onClose={() => setShowBroadcastModal(false)} />
      </div>
    )
  }

  return (
    <div className="-m-8 flex h-screen">
      <div className="w-72 flex-shrink-0 border-r border-slate-200 overflow-hidden">
        {sessionList}
      </div>
      {conversationPanel}
      <BroadcastModal open={showBroadcastModal} onClose={() => setShowBroadcastModal(false)} />
    </div>
  )
}
