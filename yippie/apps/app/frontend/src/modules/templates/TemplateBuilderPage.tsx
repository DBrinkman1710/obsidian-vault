// Drag and drop template builder ([TMPL2]) — one shared page for contract and
// invoice templates. Palette left, document stack center, settings right.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye } from 'lucide-react'
import { toast } from 'sonner'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { api } from '../../api/client'
import { ListRowSkeleton } from '../../shell/Skeleton'
import type { Block, BlockDoc, DocType } from './blocks'
import { defaultConfig, newBlockId } from './blocks'
import { BlockPalette, PALETTE_PREFIX } from './BlockPalette'
import { BlockStack } from './BlockStack'
import { BlockConfigPanel, type TemplateSettings } from './BlockConfigPanel'
import { PdfPreviewModal } from './PdfPreviewModal'

interface TemplateData {
  id: string
  name: string
  blocks: BlockDoc
  default_tax_rate_pct?: number | null
  default_due_days?: number | null
  default_notes?: string | null
  is_default?: boolean
}

export default function TemplateBuilderPage({ docType }: { docType: DocType }) {
  const { templateId } = useParams<{ templateId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const base = docType === 'invoice' ? '/billing' : '/contracts'
  const backPath = docType === 'invoice' ? '/billing' : '/contracts'

  const { data: template, isLoading } = useQuery<TemplateData>({
    queryKey: ['template', docType, templateId],
    queryFn: () => api.get(`${base}/templates/${templateId}`).then((r: any) => r.data),
    enabled: !!templateId,
  })
  const { data: fieldsData } = useQuery<{ fields: string[] }>({
    queryKey: ['template-fields', docType],
    queryFn: () => api.get(`${base}/templates/fields`).then((r: any) => r.data),
    staleTime: Infinity,
  })

  const [name, setName] = useState('')
  const [blocks, setBlocks] = useState<Block[]>([])
  const [settings, setSettings] = useState<TemplateSettings | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    if (!template) return
    setName(template.name)
    setBlocks(template.blocks?.blocks ?? [])
    if (docType === 'invoice') {
      setSettings({
        default_tax_rate_pct: template.default_tax_rate_pct ?? null,
        default_due_days: template.default_due_days ?? null,
        default_notes: template.default_notes ?? '',
      })
    }
    setDirty(false)
  }, [template, docType])

  const doc: BlockDoc = useMemo(() => ({ version: 1, blocks }), [blocks])
  const selectedBlock = blocks.find(b => b.id === selectedId) ?? null

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = { name: name.trim() || 'Untitled template', blocks: doc }
      if (docType === 'invoice' && settings) {
        payload.default_tax_rate_pct = settings.default_tax_rate_pct
        payload.default_due_days = settings.default_due_days
        payload.default_notes = settings.default_notes || null
      }
      return api.patch(`${base}/templates/${templateId}`, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [docType === 'invoice' ? 'invoice-templates' : 'contract-templates'] })
      qc.invalidateQueries({ queryKey: ['template', docType, templateId] })
      setDirty(false)
      toast.success('Template saved')
    },
    onError: (err: any) => toast.error(err.response?.data?.detail ?? 'Save failed'),
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function mutateBlocks(next: Block[]) {
    setBlocks(next)
    setDirty(true)
  }

  function addBlock(type: string, index?: number) {
    const block: Block = { id: newBlockId(), type, config: defaultConfig(type) }
    const next = [...blocks]
    next.splice(index ?? blocks.length, 0, block)
    mutateBlocks(next)
    setSelectedId(block.id)
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    if (activeId.startsWith(PALETTE_PREFIX)) {
      const type = activeId.slice(PALETTE_PREFIX.length)
      const overIndex = blocks.findIndex(b => b.id === over.id)
      addBlock(type, overIndex === -1 ? undefined : overIndex)
      return
    }
    if (activeId !== String(over.id)) {
      const from = blocks.findIndex(b => b.id === activeId)
      const to = blocks.findIndex(b => b.id === String(over.id))
      if (from !== -1 && to !== -1) mutateBlocks(arrayMove(blocks, from, to))
    }
  }

  if (isLoading || !template) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col gap-3 py-6">
        <ListRowSkeleton /><ListRowSkeleton /><ListRowSkeleton />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(backPath)} aria-label="Back"
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
          <ArrowLeft size={18} />
        </button>
        <input
          className="heading-lg bg-transparent border-b border-transparent hover:border-slate-200 focus:border-yippie focus:outline-none px-1 min-w-0 flex-1"
          value={name}
          onChange={e => { setName(e.target.value); setDirty(true) }}
          aria-label="Template name"
        />
        <span className="text-xs text-slate-400 shrink-0">
          {docType === 'invoice' ? 'Invoice template' : 'Contract template'}
        </span>
        <button onClick={() => setShowPreview(true)} className="btn-secondary px-4 py-2 inline-flex items-center gap-1.5">
          <Eye size={14} /> Preview
        </button>
        <button onClick={() => save.mutate()} disabled={!dirty || save.isPending}
          className="btn-primary px-5 py-2">
          {save.isPending ? 'Saving…' : dirty ? 'Save' : 'Saved'}
        </button>
      </div>

      {/* Builder columns */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-[220px_1fr_300px] gap-5 items-start">
          <BlockPalette docType={docType} onAdd={type => addBlock(type)} />
          <BlockStack
            blocks={blocks}
            docType={docType}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={id => {
              mutateBlocks(blocks.filter(b => b.id !== id))
              if (selectedId === id) setSelectedId(null)
            }}
          />
          <BlockConfigPanel
            block={selectedBlock}
            docType={docType}
            fields={fieldsData?.fields ?? []}
            settings={settings}
            onConfigChange={config => {
              if (!selectedBlock) return
              mutateBlocks(blocks.map(b => (b.id === selectedBlock.id ? { ...b, config } : b)))
            }}
            onSettingsChange={next => { setSettings(next); setDirty(true) }}
          />
        </div>
      </DndContext>

      {showPreview && (
        <PdfPreviewModal
          docType={docType}
          blocks={doc}
          defaultNotes={settings?.default_notes}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}
