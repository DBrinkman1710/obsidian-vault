import { createContext, useContext, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import ComposeModal, { type ComposeInitialState } from '../modules/inbox/components/ComposeModal'
import { useTenantConfig } from '../App'

interface ComposeContextValue {
  openCompose: (initial: ComposeInitialState) => void
}

const ComposeContext = createContext<ComposeContextValue>({ openCompose: () => {} })

export function ComposeProvider({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(false)
  const [initial, setInitial] = useState<ComposeInitialState | null>(null)
  const config = useTenantConfig()

  function openCompose(state: ComposeInitialState) {
    setInitial(state)
    setShow(true)
  }

  return (
    <ComposeContext.Provider value={{ openCompose }}>
      {children}
      {show && (
        <ComposeModal
          onClose={() => { setShow(false); setInitial(null) }}
          aiEnabled={config?.enabled_modules?.includes('ai') ?? true}
          marketingEnabled={config?.enabled_modules?.includes('marketing') ?? true}
          onSendQueued={payload => {
            setShow(false)
            setInitial(null)
            toast.success(`Email sent to ${payload.recipientCount} recipient${payload.recipientCount !== 1 ? 's' : ''}`)
          }}
          initialState={initial}
        />
      )}
    </ComposeContext.Provider>
  )
}

export function useCompose() {
  return useContext(ComposeContext)
}
