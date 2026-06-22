import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CheckCheck, ChevronDown, Clock, FileText, Megaphone, MessageSquare, Paperclip, Power, QrCode, Search, Send, SquarePen, UserPlus, Users, X, Trash2, Zap } from 'lucide-react'
import { List } from 'react-window'
import { api } from '../../../api/client'
import { Checkbox, BulkBar } from '../../../components/Selection'
import { useContextMenu, ContextMenu } from '../../../components/ContextMenu'
import { useAuth } from '../../../auth/useAuth'
import { useMobile } from '../../../shell/useMobile'
import { useTenantConfig } from '../../../App'
import BroadcastModal from '../components/BroadcastModal'
import ActionsModal from '../components/ActionsModal'

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

type Filter = 'mine' | 'open' | 'all'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  assigned: 'bg-amber-100 text-amber-700',
  solved: 'bg-emerald-100 text-emerald-700',
  ticket: 'bg-violet-100 text-violet-700',
}

// Delivery tick indicator for outbound agent messages
function MsgStatusTick({ status }: { status?: string }) {
  if (status === 'sending') {
    return <Clock size={12} className="inline-block text-blue-200 ml-1 flex-shrink-0 opacity-60" />
  }
  if (!status || status === 'sent') {
    return <Check size={12} className="inline-block text-blue-200 ml-1 flex-shrink-0" />
  }
  if (status === 'delivered') {
    return <CheckCheck size={12} className="inline-block text-blue-200 ml-1 flex-shrink-0" />
  }
  if (status === 'read') {
    return <CheckCheck size={12} className="inline-block text-blue-400 ml-1 flex-shrink-0" />
  }
  return null
}

// ---------------------------------------------------------------------------
// Virtualised session row — defined outside ChatPage to keep identity stable
// ---------------------------------------------------------------------------
type SessionRowData = {
  sessions: any[]
  selectedId: string | null
  selectedSessions: Set<string>
  hoveredSessionId: string | null
  setHoveredSessionId: (id: string | null) => void
  setSelectedId: (id: string | null) => void
  setSelectedSessions: React.Dispatch<React.SetStateAction<Set<string>>>
  handleSelectSession: (s: any) => void
  toggleSessionSelection: (e: React.MouseEvent, id: string) => void
  statusMutation: any
  bulkMutation: any
  ctx: any
}

function SessionRow({
  index,
  style,
  sessions,
  selectedId,
  selectedSessions,
  hoveredSessionId,
  setHoveredSessionId,
  setSelectedId,
  setSelectedSessions,
  handleSelectSession,
  toggleSessionSelection,
  statusMutation,
  bulkMutation,
  ctx,
}: { index: number; style: React.CSSProperties; ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' } } & SessionRowData) {
  const s = sessions[index]
  if (!s) return null
  const isSelected = selectedSessions.has(s.id)
  const showCheckbox = isSelected || hoveredSessionId === s.id || selectedSessions.size > 0
  return (
    <div
      style={style}
      className="relative"
      onMouseEnter={() => setHoveredSessionId(s.id)}
      onMouseLeave={() => setHoveredSessionId(null)}
      onContextMenu={e => ctx.open(e, [
        { header: s.contact_name ?? s.visitor_name ?? s.whatsapp_phone ?? 'Session' },
        { label: 'Open conversation', icon: <ArrowRight size={14} />, onClick: () => setSelectedId(s.id) },
        ...(s.status !== 'solved'
          ? [{ label: 'Mark resolved', icon: <Check size={14} />, onClick: () => statusMutation.mutate({ sessionId: s.id, status: 'solved' }) }]
          : [{ label: 'Reopen', icon: <ArrowRight size={14} />, onClick: () => statusMutation.mutate({ sessionId: s.id, status: 'open' }) }]
        ),
        { separator: true },
        {
          label: 'Delete',
          icon: <Trash2 size={14} />,
          danger: true,
          onClick: () => {
            if (window.confirm('Delete this session and all its messages? This cannot be undone.')) {
              bulkMutation.mutate({ action: 'delete', session_ids: [s.id] })
              if (selectedId === s.id) setSelectedId(null)
            }
          },
        },
      ])}
    >
      {showCheckbox && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
          <Checkbox
            checked={isSelected}
            onChange={e => toggleSessionSelection(e as any, s.id)}
            ariaLabel={`Select session from ${s.visitor_name || s.whatsapp_phone || 'Unknown'}`}
          />
        </div>
      )}
      <button
        onClick={() => {
          if (selectedSessions.size > 0) {
            setSelectedSessions(prev => {
              const next = new Set(prev)
              if (next.has(s.id)) next.delete(s.id)
              else next.add(s.id)
              return next
            })
          } else {
            handleSelectSession(s)
          }
        }}
        className={`w-full h-full text-left border-b border-slate-100 flex flex-col gap-1.5 transition-colors ${showCheckbox ? 'px-8 py-3.5' : 'px-5 py-3.5'} ${selectedId === s.id && selectedSessions.size === 0 ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
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
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full capitalize ${STATUS_STYLES[s.status] ?? 'bg-slate-100 text-slate-500'}`}>
            {s.status}
          </span>
          {s.assigned_to_name && (
            <span className="text-xs font-medium text-slate-500 truncate">· {s.assigned_to_name}</span>
          )}
          {s.unread_count > 0 && (
            <span className="text-xs font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center ml-auto">
              {s.unread_count}
            </span>
          )}
        </div>
      </button>
    </div>
  )
}

export default function ChatPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const isMobile = useMobile()
  const { user } = useAuth()
  const config = useTenantConfig()
  const isDevEnv = ['development', 'devsandbox', 'dev'].includes(config?.environment ?? '')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showConversation, setShowConversation] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [activeTab, setActiveTab] = useState<'messages' | 'notes'>('messages')
  const [noteText, setNoteText] = useState('')
  const [sidebarMode, setSidebarMode] = useState<'sessions' | 'search'>('sessions')
  const [filter, setFilter] = useState<Filter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [showReassign, setShowReassign] = useState(false)
  const [showCannedPicker, setShowCannedPicker] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [showCreateContact, setShowCreateContact] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historyViewId, setHistoryViewId] = useState<string | null>(null)
  const [showActionsModal, setShowActionsModal] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sessionListContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [sessionListHeight, setSessionListHeight] = useState(600)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [attachPreviewUrl, setAttachPreviewUrl] = useState<string | null>(null)

  // Multi-select state
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null)

  const ctx = useContextMenu()

  // Messages state (for local msg_status updates)
  const [localMsgStatuses, setLocalMsgStatuses] = useState<Record<string, string>>({})

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Track available height for the virtualised session list
  useEffect(() => {
    const el = sessionListContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setSessionListHeight(entry.contentRect.height)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['chat-sessions', filter],
    queryFn: () => api.get('/chat/sessions', { params: { filter } }).then(r => r.data),
    refetchInterval: 10_000,
  })

  const { data: agents = [] } = useQuery({
    queryKey: ['chat-agents'],
    queryFn: () => api.get('/chat/agents').then(r => r.data),
  })

  const { data: templates = [] } = useQuery({
    queryKey: ['ticket-templates'],
    queryFn: () => api.get('/tickets/templates').then(r => r.data),
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
    mutationFn: (body: string) => api.post(`/chat/sessions/${selectedId}/reply`, { body }).then(r => r.data),
    onMutate: async (body: string) => {
      await qc.cancelQueries({ queryKey: ['chat-messages', selectedId] })
      const previous = qc.getQueryData(['chat-messages', selectedId])
      const tempId = `_temp_${Date.now()}`
      qc.setQueryData(['chat-messages', selectedId], (old: any) => [
        ...(old ?? []),
        { id: tempId, body, sender_type: 'agent', msg_type: 'text', msg_status: 'sending', created_at: new Date().toISOString() },
      ])
      setReplyText('')
      return { previous, tempId, sessionId: selectedId }
    },
    onSuccess: (data, _body, ctx) => {
      qc.setQueryData(['chat-messages', ctx?.sessionId], (old: any) =>
        (old ?? []).map((m: any) => m.id === ctx?.tempId ? { ...m, ...data } : m)
      )
    },
    onError: (_err, body, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(['chat-messages', ctx?.sessionId], ctx.previous)
      }
      setReplyText(body)
    },
  })

  const mediaMutation = useMutation({
    mutationFn: ({ file, caption }: { file: File; caption?: string }) => {
      const fd = new FormData()
      fd.append('file', file)
      if (caption) fd.append('caption', caption)
      // Axios 1.x auto-sets multipart/form-data with correct boundary for FormData.
      // We delete the default 'application/json' header so axios's FormData detection fires.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return api.post(`/chat/sessions/${selectedId}/media`, fd, {
        headers: { 'Content-Type': undefined },
      })
    },
    onSuccess: () => {
      clearAttachment()
      setReplyText('')
      qc.invalidateQueries({ queryKey: ['chat-messages', selectedId] })
    },
  })

  function clearAttachment() {
    setAttachedFile(null)
    if (attachPreviewUrl) URL.revokeObjectURL(attachPreviewUrl)
    setAttachPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function attachFile(f: File) {
    clearAttachment()
    setAttachedFile(f)
    if (f.type.startsWith('image/')) {
      setAttachPreviewUrl(URL.createObjectURL(f))
    } else {
      setAttachPreviewUrl(null)
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) attachFile(f)
  }

  function handleReplyPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = e.clipboardData?.files
    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
      e.preventDefault()
      attachFile(files[0])
    }
  }

  function handleSend() {
    if (attachedFile) {
      mediaMutation.mutate({ file: attachedFile, caption: replyText.trim() || undefined })
    } else if (replyText.trim()) {
      replyMutation.mutate(replyText.trim())
    }
  }

  const noteMutation = useMutation({
    mutationFn: (body: string) => api.post(`/chat/sessions/${selectedId}/note`, { body }),
    onSuccess: () => {
      setNoteText('')
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

  const claimMutation = useMutation({
    mutationFn: (sessionId: string) => api.post(`/chat/sessions/${sessionId}/claim`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-sessions'] }),
  })

  const assignMutation = useMutation({
    mutationFn: ({ sessionId, assignedTo }: { sessionId: string; assignedTo: string | null }) =>
      api.post(`/chat/sessions/${sessionId}/assign`, { assigned_to: assignedTo }).then(r => r.data),
    onSuccess: () => {
      setShowReassign(false)
      qc.invalidateQueries({ queryKey: ['chat-sessions'] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ sessionId, status }: { sessionId: string; status: string }) =>
      api.post(`/chat/sessions/${sessionId}/status`, { status }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-sessions'] }),
  })

  const bulkMutation = useMutation({
    mutationFn: ({ action, session_ids }: { action: string; session_ids: string[] }) =>
      api.post('/chat/sessions/bulk', { action, session_ids }).then(r => r.data),
    onSuccess: () => {
      setSelectedSessions(new Set())
      qc.invalidateQueries({ queryKey: ['chat-sessions'] })
    },
  })

  const clearAllMutation = useMutation({
    mutationFn: () => api.delete('/chat/sessions/all').then(r => r.data),
    onSuccess: () => {
      setSelectedId(null)
      qc.invalidateQueries({ queryKey: ['chat-sessions'] })
    },
  })

  const resetMutation = useMutation({
    mutationFn: () => api.post('/chat/reset').then(r => r.data),
    onSuccess: () => {
      setSelectedId(null)
      qc.invalidateQueries({ queryKey: ['chat-sessions'] })
      qc.invalidateQueries({ queryKey: ['whatsapp-status'] })
      qc.invalidateQueries({ queryKey: ['whatsapp-qr'] })
    },
  })

  // Agent WebSocket — real-time events for all sessions in this tenant
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout>
    let retries = 0
    const MAX_RETRIES = 5
    let destroyed = false

    function connect() {
      if (destroyed) return
      const token = localStorage.getItem('access_token')
      if (!token) return
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${location.host}/api/v1/chat/ws/agent?token=${encodeURIComponent(token)}`)

      ws.onopen = () => {
        retries = 0  // reset retry counter on successful connection
      }

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as {
            type?: string
            event: string
            session_id?: string
            sender_type?: string
            sender_id?: string
            body?: string
            assigned_to?: string | null
            msg_id?: string
            status?: string
          }
          // Heartbeat: server sent ping — reply with pong
          if (data.type === 'ping') {
            ws?.send(JSON.stringify({ type: 'pong' }))
            return
          }
          if (data.event === 'msg_status_update' && data.msg_id && data.status) {
            // Update delivery tick for this message in local state
            setLocalMsgStatuses(prev => ({ ...prev, [data.msg_id!]: data.status! }))
          } else if (data.event === 'message') {
            // Own agent messages are already handled by optimistic update + mutation onSuccess
            const isOwnMessage = data.sender_type === 'agent' && data.sender_id === user?.id
            if (!isOwnMessage) {
              qc.invalidateQueries({ queryKey: ['chat-messages', data.session_id] })
            }
            if (data.sender_type === 'visitor') {
              qc.invalidateQueries({ queryKey: ['chat-sessions'] })
              qc.invalidateQueries({ queryKey: ['chat-open-count'] })
              // Notify only the assigned agent; if unassigned, notify everyone.
              const notifyMe = !data.assigned_to || data.assigned_to === user?.id
              if (notifyMe && 'Notification' in window && Notification.permission === 'granted') {
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
          } else if (data.event === 'unread_update' || data.event === 'session_update') {
            qc.invalidateQueries({ queryKey: ['chat-sessions'] })
          }
        } catch { /* ignore malformed frames */ }
      }

      ws.onclose = () => {
        if (destroyed) return
        if (retries < MAX_RETRIES) {
          retries++
          reconnectTimer = setTimeout(connect, 3000)
        }
      }

      ws.onerror = () => {
        if (destroyed) return
        ws?.close()
        if (retries < MAX_RETRIES) {
          retries++
          reconnectTimer = setTimeout(connect, 3000)
        }
      }
    }

    connect()

    return () => {
      destroyed = true
      clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [qc, user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeTab])

  const selectedSession = sessions.find((s: any) => s.id === selectedId)
  const isAssignee = selectedSession && selectedSession.assigned_to === user?.id
  const lockedByOther = selectedSession && selectedSession.assigned_to && !isAssignee
  const threadMessages = useMemo(
    () => (messages as any[]).filter(m => (activeTab === 'notes' ? m.sender_type === 'note' : m.sender_type !== 'note')),
    [messages, activeTab],
  )

  function handleSelectSession(s: any) {
    setSelectedId(s.id)
    setActiveTab('messages')
    setShowReassign(false)
    if (isMobile) setShowConversation(true)
    // Auto-assign on open: claim unassigned open sessions for this agent.
    if (!s.assigned_to && s.status === 'open') {
      claimMutation.mutate(s.id)
    }
    if (s.unread_count > 0) {
      api.post(`/chat/sessions/${s.id}/read`).catch(() => {})
      qc.setQueryData(['chat-sessions', filter], (old: any) =>
        (old ?? []).map((sess: any) => sess.id === s.id ? { ...sess, unread_count: 0 } : sess)
      )
      qc.invalidateQueries({ queryKey: ['chat-sessions'] })
    }
  }

  function onReplyChange(v: string) {
    setReplyText(v)
    setShowCannedPicker(v.trim() === '/' || v.endsWith('\n/'))
  }

  function insertCanned(body: string) {
    setReplyText(replyText.replace(/\/$/, '') + body)
    setShowCannedPicker(false)
  }

  function toggleSessionSelection(e: React.MouseEvent, sessionId: string) {
    e.stopPropagation()
    setSelectedSessions(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })
  }

  function handleBulkAction(action: 'close' | 'reopen' | 'delete') {
    if (action === 'delete') {
      if (!window.confirm(`Delete ${selectedSessions.size} session(s) and all their messages? This cannot be undone.`)) return
    }
    bulkMutation.mutate({ action, session_ids: Array.from(selectedSessions) })
  }

  const filterTabs = (
    <div className="flex items-center gap-1 px-5 pt-4 pb-3">
      {(['mine', 'open', 'all'] as Filter[]).map(f => (
        <button
          key={f}
          onClick={() => setFilter(f)}
          className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
        >
          {f}
        </button>
      ))}
    </div>
  )

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold text-slate-900">Live Chat</h1>
              <p className="text-xs text-slate-400 mt-0.5">WhatsApp conversations</p>
            </div>
            <div className="flex items-center gap-1">
              {!isConnected && (
                <button
                  onClick={() => setShowQrModal(true)}
                  title="Connect WhatsApp"
                  className="p-1.5 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                >
                  <QrCode size={16} />
                </button>
              )}
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
              <button
                onClick={() => {
                  if (window.confirm('Disconnect WhatsApp and delete ALL chat sessions and messages? This cannot be undone.')) {
                    resetMutation.mutate()
                  }
                }}
                disabled={resetMutation.isPending}
                title="Disconnect WhatsApp & remove all chats"
                className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {resetMutation.isPending ? <span className="text-xs">…</span> : <Power size={16} />}
              </button>
              {isDevEnv && (
                <button
                  onClick={() => {
                    if (window.confirm('Delete ALL chat sessions and messages? (dev only)')) {
                      clearAllMutation.mutate()
                    }
                  }}
                  disabled={clearAllMutation.isPending}
                  title="Clear all sessions (dev only)"
                  className="px-2 py-1 rounded text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {clearAllMutation.isPending ? '…' : 'Clear'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {sidebarMode === 'sessions' && filterTabs}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowQrModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Connect WhatsApp</h2>
              <button onClick={() => setShowQrModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 text-center">
              <p className="text-sm text-slate-500 mb-4">Scan this QR code with WhatsApp on your phone to connect.</p>
              {qrLoading && <p className="text-sm text-slate-400 py-8">Loading QR code…</p>}
              {!qrLoading && qrError && (
                <p className="text-sm text-red-500 py-8">
                  Couldn't load the QR code — check Evolution API is configured for this environment.
                </p>
              )}
              {!qrLoading && !qrError && qrData?.base64 && (
                <>
                  <img src={qrData.base64} alt="WhatsApp pairing QR code" className="w-48 h-48 mx-auto" />
                  {qrData.pairing_code && (
                    <p className="text-xs text-slate-500 mt-3 font-mono">Pairing code: {qrData.pairing_code}</p>
                  )}
                </>
              )}
              {!qrLoading && !qrError && !qrData?.base64 && (
                <p className="text-sm text-slate-400 py-8">Waiting for QR code…</p>
              )}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-[10px] text-slate-400">
                  Live chat powered by{' '}
                  <a href="https://github.com/EvolutionAPI/evolution-api" target="_blank" rel="noopener noreferrer" className="underline">Evolution API</a>
                  {' '}— licensed under the{' '}
                  <a href="http://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer" className="underline">Apache License 2.0</a>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-hidden relative flex flex-col" ref={sessionListContainerRef}>
        {sidebarMode === 'search' ? (
          <div className="flex-1 overflow-y-auto">
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
          </div>
        ) : (
          <>
            {sessionsLoading && <p className="p-5 text-sm text-slate-400">Loading…</p>}
            {!sessionsLoading && sessions.length === 0 && (
              <div className="p-8 text-center">
                <MessageSquare size={28} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600 mb-1">No sessions here</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  WhatsApp messages appear here when customers reach out.
                </p>
              </div>
            )}
            {!sessionsLoading && sessions.length > 0 && (
              <List
                rowCount={sessions.length}
                rowHeight={80}
                style={{ height: sessionListHeight - 56 }}
                overscanCount={5}
                rowComponent={SessionRow}
                rowProps={{
                  sessions,
                  selectedId,
                  selectedSessions,
                  hoveredSessionId,
                  setHoveredSessionId,
                  setSelectedId,
                  setSelectedSessions,
                  handleSelectSession,
                  toggleSessionSelection,
                  statusMutation,
                  bulkMutation,
                  ctx,
                }}
              />
            )}

            {/* Bulk action bar */}
            <div className="px-3 pt-2 pb-3 bg-white" style={{ height: 56 }}>
              <BulkBar
                count={selectedSessions.size}
                onClear={() => setSelectedSessions(new Set())}
                actions={[
                  { label: 'Close', onClick: () => handleBulkAction('close') },
                  { label: 'Reopen', onClick: () => handleBulkAction('reopen') },
                  { label: 'Delete', icon: <Trash2 size={13} />, danger: true, onClick: () => handleBulkAction('delete') },
                ]}
              />
            </div>
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
          <button
            onClick={() => selectedSession.contact_id && setShowContactModal(true)}
            disabled={!selectedSession.contact_id}
            className={`font-bold text-sm text-slate-900 truncate text-left ${selectedSession.contact_id ? 'hover:text-blue-600 hover:underline' : 'cursor-default'}`}
          >
            {selectedSession.visitor_name || selectedSession.whatsapp_phone || 'Unknown visitor'}
          </button>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {selectedSession.whatsapp_phone}
            {' · '}
            Started {new Date(selectedSession.started_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!selectedSession.contact_id && (
            <button
              onClick={() => setShowCreateContact(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
              title="Create contact from this number"
            >
              <UserPlus size={12} /> Create contact
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowReassign(v => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
              title="Re-assign"
            >
              <Users size={12} />
              {selectedSession.assigned_to_name ?? 'Unassigned'}
              <ChevronDown size={12} />
            </button>
            {showReassign && (
              <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 max-h-72 overflow-y-auto">
                <button
                  onClick={() => assignMutation.mutate({ sessionId: selectedSession.id, assignedTo: null })}
                  className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Unassign (return to open)
                </button>
                {agents.map((a: any) => (
                  <button
                    key={a.id}
                    onClick={() => assignMutation.mutate({ sessionId: selectedSession.id, assignedTo: a.id })}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${a.id === selectedSession.assigned_to ? 'font-bold text-blue-600' : 'text-slate-700'}`}
                  >
                    {a.full_name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedSession.status === 'solved' ? (
            <button
              onClick={() => statusMutation.mutate({ sessionId: selectedSession.id, status: 'open' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
            >
              Reopen
            </button>
          ) : (
            <button
              onClick={() => statusMutation.mutate({ sessionId: selectedSession.id, status: 'solved' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors"
            >
              Solve
            </button>
          )}
          {selectedSession.ticket_id && (
            <button
              onClick={() => navigate(`/tickets/${selectedSession.ticket_id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg text-xs font-semibold transition-colors"
              title="Open linked ticket"
            >
              Ticket →
            </button>
          )}
          <button
            onClick={() => setShowActionsModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
            title="Create ticket or send booking"
          >
            <Zap size={12} strokeWidth={2.5} />
            Actions
          </button>
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
      </div>

      {selectedSession.contact_id && (
        <div className="px-4 md:px-6 pt-2 bg-white border-b border-slate-100">
          <button
            onClick={() => setShowHistory(v => !v)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 py-1"
          >
            <ChevronDown size={12} className={showHistory ? '' : '-rotate-90'} /> Previous conversations
          </button>
          {showHistory && <HistoryPanel contactId={selectedSession.contact_id} currentId={selectedSession.id} onView={setHistoryViewId} />}
        </div>
      )}

      <div className="flex items-center gap-1 px-4 md:px-6 pt-3 bg-slate-50 border-b border-slate-100">
        <button
          onClick={() => setActiveTab('messages')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg ${activeTab === 'messages' ? 'bg-white text-slate-900 border border-b-white border-slate-200 -mb-px' : 'text-slate-500'}`}
        >
          Messages
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg ${activeTab === 'notes' ? 'bg-white text-slate-900 border border-b-white border-slate-200 -mb-px' : 'text-slate-500'}`}
        >
          Notes
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 flex flex-col gap-3 bg-slate-50">
        {msgsLoading && <p className="text-sm text-slate-400">Loading messages…</p>}
        {!msgsLoading && activeTab === 'notes' && threadMessages.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">No internal notes yet. Notes are never sent to the customer.</p>
        )}
        {threadMessages.map((m: any) => {
          if (m.sender_type === 'note') {
            return (
              <div key={m.id} className="self-center max-w-[90%] w-full">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                  <p className="text-xs font-bold text-amber-700 mb-1">Internal note</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">{m.body}</p>
                  <p className="text-xs mt-1 text-right text-amber-500">{formatTime(m.created_at)}</p>
                </div>
              </div>
            )
          }
          const isAgent = m.sender_type === 'agent'
          // Merge server-delivered status with any real-time WS update
          const effectiveStatus = localMsgStatuses[m.id] ?? m.msg_status
          const isMedia = m.msg_type === 'media'
          const isImage = isMedia && m.media_mime?.startsWith('image/')
          return (
            <div key={m.id} className={`flex animate-msg-enter ${isAgent ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl shadow-sm overflow-hidden ${isAgent ? 'bg-blue-600 text-white' : 'bg-white text-slate-900 border border-slate-200'}`}>
                {isImage && m.media_url ? (
                  <div>
                    <img
                      src={m.media_url}
                      alt={m.media_filename || 'image'}
                      className="max-w-xs max-h-64 object-contain block"
                    />
                    {m.body && m.body !== m.media_filename && (
                      <p className={`px-4 pt-2 text-sm leading-relaxed whitespace-pre-wrap ${isAgent ? 'text-white' : 'text-slate-900'}`}>{m.body}</p>
                    )}
                  </div>
                ) : isMedia ? (
                  <div className={`flex items-center gap-3 px-4 py-3 ${isAgent ? 'text-white' : 'text-slate-700'}`}>
                    <FileText size={20} className="flex-shrink-0" />
                    <span className="text-sm font-medium truncate max-w-[180px]">{m.media_filename || m.body}</span>
                  </div>
                ) : (
                  <div className="px-4 py-2.5">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.body}</p>
                  </div>
                )}
                <div className={`flex items-center justify-end gap-0.5 px-4 pb-2 ${isAgent ? 'text-blue-200' : 'text-slate-400'}`}>
                  <span className="text-xs">{formatTime(m.created_at)}</span>
                  {isAgent && <MsgStatusTick status={effectiveStatus} />}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {activeTab === 'notes' ? (
        <div className="px-4 md:px-6 py-4 border-t border-slate-200 bg-white flex gap-3 items-end">
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (noteText.trim()) noteMutation.mutate(noteText.trim())
              }
            }}
            placeholder="Add an internal note…"
            rows={isMobile ? 2 : 2}
            className="flex-1 px-4 py-2.5 border border-amber-300 bg-amber-50 rounded-xl text-sm resize-none font-[inherit] focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            onClick={() => { if (noteText.trim()) noteMutation.mutate(noteText.trim()) }}
            disabled={noteMutation.isPending || !noteText.trim()}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm rounded-xl transition-colors"
          >
            Save note
          </button>
        </div>
      ) : lockedByOther ? (
        <div className="px-6 py-4 border-t border-slate-200 bg-amber-50 text-center text-sm text-amber-700">
          Assigned to {selectedSession.assigned_to_name ?? 'another agent'} — re-assign to reply.
        </div>
      ) : selectedSession.is_open ? (
        <div className="px-4 md:px-6 py-4 border-t border-slate-200 bg-white relative">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.csv"
            className="hidden"
            onChange={handleFileInputChange}
          />
          {showCannedPicker && templates.length > 0 && (
            <div className="absolute bottom-full left-4 md:left-6 right-4 md:right-6 mb-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto z-20">
              {templates.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => insertCanned(t.body)}
                  className="w-full text-left px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                  <p className="text-xs text-slate-400 truncate">{t.body}</p>
                </button>
              ))}
            </div>
          )}
          {/* Attachment preview row */}
          {attachedFile && (
            <div className="mb-2 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              {attachPreviewUrl ? (
                <img src={attachPreviewUrl} alt="preview" className="h-12 w-12 object-cover rounded-lg flex-shrink-0" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-slate-500" />
                </div>
              )}
              <span className="text-xs text-slate-700 font-medium truncate flex-1">{attachedFile.name}</span>
              <button
                onClick={clearAttachment}
                className="text-slate-400 hover:text-slate-600 flex-shrink-0"
                title="Remove attachment"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Attach file"
              className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0"
            >
              <Paperclip size={16} />
            </button>
            <textarea
              value={replyText}
              onChange={e => onReplyChange(e.target.value)}
              onPaste={handleReplyPaste}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !showCannedPicker) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={attachedFile ? 'Add a caption (optional)…' : 'Type a reply…  (type / for canned responses)'}
              rows={isMobile ? 2 : 3}
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm resize-none font-[inherit] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleSend}
              disabled={(replyMutation.isPending || mediaMutation.isPending) || (!replyText.trim() && !attachedFile)}
              className="px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Send size={14} />
              {!isMobile && 'Send'}
            </button>
          </div>
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

  const modals = (
    <>
      <BroadcastModal open={showBroadcastModal} onClose={() => setShowBroadcastModal(false)} />
      {showContactModal && selectedSession?.contact_id && (
        <ContactModal contactId={selectedSession.contact_id} onClose={() => setShowContactModal(false)} navigate={navigate} />
      )}
      {showCreateContact && selectedSession && (
        <CreateContactModal
          phone={selectedSession.whatsapp_phone}
          name={selectedSession.visitor_name}
          onClose={() => setShowCreateContact(false)}
          onCreated={async (contact) => {
            await api.patch(`/chat/sessions/${selectedSession.id}`, { contact_id: contact.id })
            qc.invalidateQueries({ queryKey: ['chat-sessions'] })
            setShowCreateContact(false)
          }}
        />
      )}
      {historyViewId && (
        <HistoryViewModal sessionId={historyViewId} onClose={() => setHistoryViewId(null)} />
      )}
      {showActionsModal && selectedSession && (
        <ActionsModal
          session={selectedSession}
          defaultPane={selectedSession.ticket_id ? 'booking' : 'ticket'}
          onClose={() => setShowActionsModal(false)}
          onTicketLinked={() => setShowActionsModal(false)}
        />
      )}
      <ContextMenu state={ctx.state} onClose={ctx.close} />
    </>
  )

  if (isMobile) {
    return (
      <div className="-m-4 flex flex-col h-[calc(100vh-4rem)]">
        {showConversation ? conversationPanel : sessionList}
        {modals}
      </div>
    )
  }

  return (
    <div className="-m-8 flex h-screen">
      <div className="w-72 flex-shrink-0 border-r border-slate-200 overflow-hidden">
        {sessionList}
      </div>
      {conversationPanel}
      {modals}
    </div>
  )
}

function HistoryPanel({ contactId, currentId, onView }: { contactId: string; currentId: string; onView: (id: string) => void }) {
  const { data: past = [] } = useQuery({
    queryKey: ['chat-history', contactId],
    queryFn: () => api.get('/chat/sessions', { params: { contact_id: contactId, status_filter: 'solved' } }).then(r => r.data),
  })
  const items = (past as any[]).filter(s => s.id !== currentId)
  if (items.length === 0) {
    return <p className="text-xs text-slate-400 pb-2">No previous conversations.</p>
  }
  return (
    <div className="pb-2 flex flex-col gap-1">
      {items.map((s: any) => (
        <button
          key={s.id}
          onClick={() => onView(s.id)}
          className="text-left text-xs text-slate-600 hover:text-blue-600 hover:underline"
        >
          {new Date(s.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          {s.solved_at && ` — solved ${new Date(s.solved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
        </button>
      ))}
    </div>
  )
}

function HistoryViewModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat-messages', sessionId],
    queryFn: () => api.get(`/chat/sessions/${sessionId}/messages`).then(r => r.data),
  })
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Past conversation</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-6 overflow-y-auto flex flex-col gap-3 bg-slate-50">
          {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
          {(messages as any[]).filter(m => m.sender_type !== 'note').map((m: any) => {
            const isAgent = m.sender_type === 'agent'
            return (
              <div key={m.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${isAgent ? 'bg-blue-600 text-white' : 'bg-white text-slate-900 border border-slate-200'}`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.body}</p>
                  <p className={`text-xs mt-1 text-right ${isAgent ? 'text-blue-200' : 'text-slate-400'}`}>{formatTime(m.created_at)}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ContactModal({ contactId, onClose, navigate }: { contactId: string; onClose: () => void; navigate: (p: string) => void }) {
  const qc = useQueryClient()
  const { data: contact } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => api.get(`/contacts/${contactId}`).then(r => r.data),
  })
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  useEffect(() => {
    if (contact) { setFullName(contact.full_name ?? ''); setEmail(contact.email ?? ''); setPhone(contact.phone ?? '') }
  }, [contact])

  const save = useMutation({
    mutationFn: () => api.patch(`/contacts/${contactId}`, { full_name: fullName, email: email || null, phone: phone || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', contactId] })
      qc.invalidateQueries({ queryKey: ['chat-sessions'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Contact</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Name" value={fullName} onChange={setFullName} />
          <Field label="Phone" value={phone} onChange={setPhone} />
          <Field label="Email" value={email} onChange={setEmail} />
          {contact?.company?.name && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">Company</p>
              <p className="text-sm text-slate-800">{contact.company.name}</p>
            </div>
          )}
          {contact?.labels?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">Labels</p>
              <div className="flex flex-wrap gap-1.5">
                {contact.labels.map((l: any) => (
                  <span key={l.id} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: l.color }}>{l.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          <button onClick={() => navigate(`/contacts/${contactId}`)} className="text-xs font-semibold text-slate-500 hover:text-slate-700">
            Open full profile →
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateContactModal({ phone, name, onClose, onCreated }: { phone: string | null; name: string | null; onClose: () => void; onCreated: (c: any) => void }) {
  const [fullName, setFullName] = useState(name ?? '')
  const [email, setEmail] = useState('')
  const [phoneVal, setPhoneVal] = useState(phone ?? '')
  const create = useMutation({
    mutationFn: () => api.post('/contacts', { full_name: fullName, email: email || null, phone: phoneVal || null }).then(r => r.data),
    onSuccess: (c) => onCreated(c),
  })
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">New contact</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Name" value={fullName} onChange={setFullName} />
          <Field label="Phone" value={phoneVal} onChange={setPhoneVal} />
          <Field label="Email" value={email} onChange={setEmail} />
        </div>
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100">
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || !fullName.trim()}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {create.isPending ? 'Creating…' : 'Create & link'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  )
}
