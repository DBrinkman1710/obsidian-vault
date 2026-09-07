import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BotMessageSquare, Loader2, Send } from 'lucide-react'
import { CloseButton } from '../shell/CloseButton'
import { api } from '../api/client'
import { useT } from '../hooks/useT'

interface TrainMessage {
  role: 'assistant' | 'user'
  content: string
}

interface Props {
  onComplete: () => void
  onDismiss: () => void
  tenantName: string
}

const QUESTIONS = (tenantName: string): string[] => [
  `Hi! I'm Yip, your AI assistant. Let me ask you 5 quick questions so I can give you better, more relevant help. First: what does ${tenantName} do? One sentence is fine.`,
  'Who do you typically support: consumers, businesses, or a mix?',
  'How should I sound in replies to your customers? Formal, friendly, or casual?',
  'What language do most of your customers write in? (e.g. English, Dutch, French)',
  "Any product names, abbreviations, or terms I should know? You can skip this by typing 'skip'.",
]

// Sensible defaults per question so users can skip decision fatigue and still
// end up with a usable profile. Index matches QUESTIONS above.
const DEFAULTS = [
  'A small business',
  'A mix of consumers and businesses',
  'Friendly',
  'English',
  'skip',
]

export default function YipTrainModal({ onComplete, onDismiss, tenantName }: Props) {
  const t = useT()
  const [messages, setMessages] = useState<TrainMessage[]>([])
  const [input, setInput] = useState('')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const questions = QUESTIONS(tenantName)

  // Show the first question on mount
  useEffect(() => {
    setMessages([{ role: 'assistant', content: questions[0] }])
  }, [])

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input after each new message
  useEffect(() => {
    if (!loading && !done) inputRef.current?.focus()
  }, [messages, loading, done])

  async function send(rawText?: string) {
    const text = (rawText ?? input).trim()
    if (!text || loading || done) return

    const userMsg: TrainMessage = { role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')

    const nextIndex = questionIndex + 1

    if (nextIndex < questions.length) {
      // More questions to ask
      setQuestionIndex(nextIndex)
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'assistant', content: questions[nextIndex] }])
      }, 400)
    } else {
      // All questions answered — synthesise profile
      const processingMsg: TrainMessage = {
        role: 'assistant',
        content: 'Got it. Give me a moment to put this together…',
      }
      setMessages(prev => [...prev, processingMsg])
      setLoading(true)

      try {
        await api.post('/jarvis/train', { messages: nextMessages })
        const doneMsg: TrainMessage = {
          role: 'assistant',
          content: 'All done! I\'ve saved your profile. You can update it anytime in Settings → AI & Yip.',
        }
        setMessages(prev => [...prev, doneMsg])
        setDone(true)
        setTimeout(() => onComplete(), 1500)
      } catch {
        const errMsg: TrainMessage = {
          role: 'assistant',
          content: 'Something went wrong saving your profile. Please try again from Settings → AI & Yip.',
        }
        setMessages(prev => [...prev, errMsg])
        setLoading(false)
      }
    }
  }

  // Portal to document.body so the overlay escapes App's fixed bottom right
  // column (a z-40 stacking context) — otherwise BottomNav and other chrome
  // paint over this full screen modal.
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
          <BotMessageSquare size={18} className="text-yippie shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">{t('shared_train_yip')}</p>
            <p className="text-xs text-slate-400">{t('shared_train_yip_subtitle')}</p>
          </div>
          <CloseButton onClick={onDismiss} />
        </div>

        {/* Message thread */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0 max-h-[400px]">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-yippie/10 flex items-center justify-center mr-2 shrink-0 mt-0.5">
                  <BotMessageSquare size={12} className="text-yippie" />
                </div>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-yippie text-white rounded-br-sm'
                    : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-slate-100">
          {done ? (
            <p className="text-center text-xs text-slate-400 py-1">{t('shared_profile_saved_closing')}</p>
          ) : (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); send() }
                }}
                disabled={loading}
                placeholder={t('shared_your_answer_placeholder')}
                className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie disabled:opacity-50"
              />
              <button
                onClick={() => send(DEFAULTS[questionIndex])}
                disabled={loading}
                className="shrink-0 px-2.5 h-9 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                title={t('shared_skip')}
              >
                {t('shared_skip')}
              </button>
              <button
                onClick={() => send()}
                disabled={loading || !input.trim()}
                className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-yippie text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
