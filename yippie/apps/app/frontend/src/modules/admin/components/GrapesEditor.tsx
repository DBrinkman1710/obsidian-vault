import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import grapesjs, { Editor } from 'grapesjs'
import 'grapesjs/dist/css/grapes.min.css'
// @ts-ignore — no types package
import grapesjsNewsletterPlugin from 'grapesjs-preset-newsletter'
import { type ContactLabel } from '../../contacts/components/LabelChip'

export interface PipelineStage { id: string; name: string; color: string }
export { type ContactLabel }

export interface CampaignButton {
  id: string
  text: string
  action_type: string
  stage_id: string | null
  label_id: string | null
  action_value: string | null
}

export interface GrapesEditorHandle {
  loadDesign(json: string | null): void
  exportHtml(cb: (data: { html: string; design: object; campaignButtons: CampaignButton[] }) => void): void
  on(event: string, cb: () => void): void
}

interface GrapesEditorProps {
  stages?: PipelineStage[]
  labels?: ContactLabel[]
  onReady?: () => void
}

const ACTION_OPTIONS = [
  { id: 'pipeline_stage', label: 'Move to pipeline stage' },
  { id: 'apply_label',    label: 'Apply label' },
  { id: 'open_website',   label: 'Open website' },
  { id: 'send_email',     label: 'Send email' },
  { id: 'call_phone',     label: 'Call phone' },
]

const ACTION_TYPE_TRAIT = {
  type: 'select',
  name: 'data-action-type',
  label: 'Action type',
  options: ACTION_OPTIONS,
}

function secondaryName(actionType: string) {
  if (actionType === 'pipeline_stage') return 'data-stage-id'
  if (actionType === 'apply_label') return 'data-label-id'
  return 'data-action-value'
}

function buildSecondaryTrait(actionType: string, stages: PipelineStage[], labels: ContactLabel[]) {
  if (actionType === 'pipeline_stage') {
    return {
      type: 'select',
      name: 'data-stage-id',
      label: 'Stage',
      options: [{ id: '', label: '— pick a stage' }, ...stages.map(s => ({ id: s.id, label: s.name }))],
    }
  }
  if (actionType === 'apply_label') {
    return {
      type: 'select',
      name: 'data-label-id',
      label: 'Label',
      options: [{ id: '', label: '— pick a label' }, ...labels.map(l => ({ id: l.id, label: l.name }))],
    }
  }
  const labelMap: Record<string, string> = {
    open_website: 'URL',
    send_email: 'Email address',
    call_phone: 'Phone number',
  }
  return {
    type: 'text',
    name: 'data-action-value',
    label: labelMap[actionType] ?? 'Value',
  }
}

function extractButtons(data: object): CampaignButton[] {
  const found: CampaignButton[] = []
  function walk(node: unknown) {
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (node && typeof node === 'object') {
      const n = node as Record<string, unknown>
      const attrs = n.attributes as Record<string, unknown> | undefined
      if (attrs?.['data-yippie-button']) {
        const id = String(attrs['id'] ?? crypto.randomUUID())
        if (!found.find(f => f.id === id)) {
          found.push({
            id,
            text: String(n.content ?? '').replace(/<[^>]*>/g, '').trim() || 'Button',
            action_type: String(attrs['data-action-type'] ?? 'pipeline_stage'),
            stage_id: attrs['data-stage-id'] ? String(attrs['data-stage-id']) : null,
            label_id: attrs['data-label-id'] ? String(attrs['data-label-id']) : null,
            action_value: attrs['data-action-value'] ? String(attrs['data-action-value']) : null,
          })
        }
      }
      Object.values(n).forEach(walk)
    }
  }
  walk(data)
  return found
}

const GrapesEditor = forwardRef<GrapesEditorHandle, GrapesEditorProps>(({ stages = [], labels = [], onReady }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const stagesRef = useRef(stages)
  const labelsRef = useRef(labels)
  stagesRef.current = stages
  labelsRef.current = labels
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return

    const editor = grapesjs.init({
      container: containerRef.current,
      height: '100%',
      width: 'auto',
      storageManager: false,
      plugins: [grapesjsNewsletterPlugin],
      blockManager: {
        appendOnClick: true,
      },
      canvas: {
        styles: [
          `.gjs-selected { outline: 2px solid #5BA4F5 !important; outline-offset: 1px; }
           .gjs-hovered { outline: 1px dashed #93C5FD !important; }
           .gjs-dashed *[data-gjs-highlightable] { outline: 1px dashed rgba(91,164,245,.35) !important; }`,
        ],
      },
    })

    editor.DomComponents.addType('yippie-button', {
      isComponent: (el: HTMLElement) =>
        el.tagName === 'A' && el.hasAttribute('data-yippie-button'),
      model: {
        defaults: {
          tagName: 'a',
          draggable: true,
          droppable: false,
          attributes: { 'data-yippie-button': '1', 'data-action-type': 'pipeline_stage', href: '#' },
          traits: [
            ACTION_TYPE_TRAIT,
            buildSecondaryTrait('pipeline_stage', [], []),
          ],
        },
      },
    })

    // Auto-switch to traits panel when a yippie-button is selected
    editor.on('component:selected', (component: any) => {
      if (component.get('type') === 'yippie-button') {
        editor.Panels.getButton('views', 'open-tm')?.set('active', true)
      }
    })

    // Swap secondary trait when action type changes
    editor.on('component:update', (component: any) => {
      if (component.get('type') !== 'yippie-button') return
      const actionType: string = component.getAttributes()['data-action-type'] ?? 'pipeline_stage'
      const traitsModels = component.get('traits')?.models
      const currentSecondary: string | undefined = traitsModels?.[1]?.get?.('name')
      if (currentSecondary === secondaryName(actionType)) return
      component.set('traits', [
        ACTION_TYPE_TRAIT,
        buildSecondaryTrait(actionType, stagesRef.current, labelsRef.current),
      ])
    })

    // Remove the newsletter preset's generic button block so ours is the only one
    editor.BlockManager.remove('button')
    editor.BlockManager.add('yippie-button', {
      label: 'Action Button',
      category: 'Basic',
      media: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="7" width="20" height="10" rx="2"/>
        <polyline points="9 10 12 12 9 14"/>
        <path d="M15 10l2 2-2 2" stroke-width="1.5"/>
      </svg>`,
      content: {
        type: 'yippie-button',
        content: 'Click here',
        style: {
          display: 'inline-block',
          padding: '10px 24px',
          background: '#5BA4F5',
          color: '#ffffff',
          'text-decoration': 'none',
          'border-radius': '4px',
          'font-family': 'Arial, sans-serif',
          'font-size': '14px',
          'font-weight': 'bold',
        },
      },
    })

    editor.BlockManager.add('yippie-signature', {
      label: 'Signature',
      category: 'Basic',
      media: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>`,
      content: `<table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-top:16px;border-top:2px solid #e2e8f0;font-family:Arial,sans-serif;">
            <p style="margin:0 0 3px;font-size:15px;font-weight:bold;color:#0f172a;">Your Name</p>
            <p style="margin:0 0 3px;font-size:13px;color:#64748b;">Job Title · Company</p>
            <p style="margin:0;font-size:13px;color:#64748b;">email@example.com · +1 234 567 8900</p>
          </td>
        </tr>
      </table>`,
    })

    editorRef.current = editor
    onReadyRef.current?.()

    return () => { editor.destroy(); editorRef.current = null }
  }, [])

  useImperativeHandle(ref, () => ({
    loadDesign(json) {
      const editor = editorRef.current
      if (!editor) return
      if (json) {
        try { editor.loadProjectData(JSON.parse(json)); return } catch {}
      }
      editor.loadProjectData({ pages: [{ component: '' }] })
    },
    exportHtml(cb) {
      const editor = editorRef.current
      if (!editor) return
      const inlined = editor.runCommand('gjs-get-inlined-html') as string | undefined
      const html = inlined ?? editor.getHtml()
      const design = editor.getProjectData()
      cb({ html, design, campaignButtons: extractButtons(design) })
    },
    on(event, cb) {
      const editor = editorRef.current
      if (!editor) return
      if (event === 'change') {
        editor.on('component:add', cb)
        editor.on('component:update', cb)
        editor.on('component:remove', cb)
        return
      }
      editor.on(event, cb)
    },
  }))

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
})

GrapesEditor.displayName = 'GrapesEditor'
export default GrapesEditor
