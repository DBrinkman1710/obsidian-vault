import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import grapesjs, { Editor } from 'grapesjs'
import 'grapesjs/dist/css/grapes.min.css'
// @ts-ignore — no types package
import grapesjsNewsletterPlugin from 'grapesjs-preset-newsletter'
import { type ContactLabel } from '../../contacts/components/LabelChip'
import { useT } from '../../../hooks/useT'

export interface PipelineStage { id: string; name: string; color: string }
export { type ContactLabel }

export interface CampaignButton {
  id: string
  text: string
  action_type: string
  stage_id: string | null
  label_id: string | null
  action_value: string | null
  redirect_url: string | null
}

export interface GrapesEditorHandle {
  loadDesign(json: string | null): void
  exportHtml(cb: (data: { html: string; design: object; campaignButtons: CampaignButton[] }) => void): void
  on(event: string, cb: () => void): void
  insertToken(token: string): void
}

interface GrapesEditorProps {
  stages?: PipelineStage[]
  labels?: ContactLabel[]
  onReady?: () => void
}

type TFn = (key: string) => string

function makeActionOptions(t: TFn) {
  return [
    { id: 'pipeline_stage', label: t('admin_action_move_pipeline') },
    { id: 'apply_label',    label: t('admin_action_apply_label') },
    { id: 'open_website',   label: t('admin_action_open_website') },
    { id: 'send_email',     label: t('admin_action_send_email') },
    { id: 'call_phone',     label: t('admin_action_call_phone') },
  ]
}

function makeActionTypeTrait(t: TFn) {
  return {
    type: 'select',
    name: 'data-action-type',
    label: t('admin_action_type_label'),
    options: makeActionOptions(t),
  }
}

function makeAlignTrait(t: TFn) {
  return {
    type: 'select',
    name: 'data-align',
    label: t('admin_align_label'),
    options: [
      { id: 'center', label: t('admin_align_center') },
      { id: 'left',   label: t('admin_align_left') },
      { id: 'right',  label: t('admin_align_right') },
    ],
  }
}

function secondaryName(actionType: string) {
  if (actionType === 'pipeline_stage') return 'data-stage-id'
  if (actionType === 'apply_label') return 'data-label-id'
  return 'data-action-value'
}

function makeRedirectUrlTrait(t: TFn) {
  return {
    type: 'text',
    name: 'data-redirect-url',
    label: t('admin_redirect_url_label'),
    placeholder: 'https://',
  }
}

function buildSecondaryTrait(actionType: string, _stages: PipelineStage[], labels: ContactLabel[], t: TFn) {
  if (actionType === 'pipeline_stage') {
    return {
      type: 'text',
      name: 'data-stage-id',
      label: t('admin_stage_set_in_actions'),
      placeholder: t('admin_stage_assigned_tab'),
      attributes: { readonly: 'true', style: 'color:#94a3b8;background:#f8fafc;cursor:not-allowed' },
    }
  }
  if (actionType === 'apply_label') {
    return {
      type: 'select',
      name: 'data-label-id',
      label: 'Label',
      options: [{ id: '', label: t('admin_label_pick') }, ...labels.map(l => ({ id: l.id, label: l.name }))],
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

// Visible text of a component subtree. GrapesJS keeps a button's label in `content`
// when built from a block, but in child textnodes when parsed from imported HTML —
// gather both so the button label is never lost (previously fell back to 'Button').
function componentText(n: Record<string, unknown>): string {
  let out = String((n.content as string) ?? '')
  const kids = n.components
  if (Array.isArray(kids)) {
    for (const k of kids) {
      if (k && typeof k === 'object') out += componentText(k as Record<string, unknown>)
    }
  }
  return out
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
            text: componentText(n).replace(/<[^>]*>/g, '').trim() || 'Button',
            action_type: String(attrs['data-action-type'] ?? 'pipeline_stage'),
            stage_id: attrs['data-stage-id'] ? String(attrs['data-stage-id']) : null,
            label_id: attrs['data-label-id'] ? String(attrs['data-label-id']) : null,
            action_value: attrs['data-action-value'] ? String(attrs['data-action-value']) : null,
            redirect_url: attrs['data-redirect-url'] ? String(attrs['data-redirect-url']) : null,
          })
        }
      }
      Object.values(n).forEach(walk)
    }
  }
  walk(data)
  return found
}

// ── Token insertion helpers ────────────────────────────────────────────────
// GrapesJS serialises the component MODEL on export (getHtml), not the live
// iframe DOM — so a token dropped straight into the DOM must be written back
// into its owning component or it is lost on save.

function isTextComponent(comp: any): boolean {
  return !!comp && (comp.is?.('text') || comp.get?.('type') === 'text')
}

/** Walk up from a DOM node to the GrapesJS component whose element owns it. */
function componentForNode(editor: any, node: Node | null): any {
  const wrapper = editor.getWrapper?.()
  let el: HTMLElement | null =
    node && node.nodeType === 1 ? (node as HTMLElement) : node?.parentElement ?? null
  if (!wrapper || !el) return null
  const search = (comp: any, target: HTMLElement): any => {
    if (comp?.getEl?.() === target) return comp
    const kids = comp?.components?.()
    const arr = kids?.models ?? kids ?? []
    for (const k of arr) { const r = search(k, target); if (r) return r }
    return null
  }
  const body = editor.Canvas?.getBody?.()
  while (el && el !== body) {
    const found = search(wrapper, el)
    if (found) return found
    el = el.parentElement
  }
  return null
}

/** First text component anywhere in the design (fallback insert target). */
function firstTextComponent(editor: any): any {
  const wrapper = editor.getWrapper?.()
  if (!wrapper) return null
  let found: any = null
  const walk = (comp: any) => {
    if (found) return
    if (isTextComponent(comp)) { found = comp; return }
    const kids = comp?.components?.()
    const arr = kids?.models ?? kids ?? []
    for (const k of arr) { walk(k); if (found) return }
  }
  walk(wrapper)
  return found
}

const GrapesEditor = forwardRef<GrapesEditorHandle, GrapesEditorProps>(({ stages = [], labels = [], onReady }, ref) => {
  const t = useT()
  const tRef = useRef(t)
  tRef.current = t
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  // Last caret position inside the canvas iframe. Captured continuously so a
  // token chip in the parent toolbar can insert there even after the button
  // click pulls focus out of the iframe.
  const lastRangeRef = useRef<Range | null>(null)
  const stagesRef = useRef(stages)
  const labelsRef = useRef(labels)
  stagesRef.current = stages
  labelsRef.current = labels
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return

    const t = tRef.current

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

    const ACTION_TYPE_TRAIT = makeActionTypeTrait(t)
    const ALIGN_TRAIT = makeAlignTrait(t)
    const REDIRECT_URL_TRAIT = makeRedirectUrlTrait(t)

    editor.DomComponents.addType('yippie-button', {
      isComponent: (el: HTMLElement) =>
        el.tagName === 'A' && el.hasAttribute('data-yippie-button'),
      model: {
        defaults: {
          tagName: 'a',
          draggable: true,
          droppable: false,
          attributes: { 'data-yippie-button': '1', 'data-action-type': 'pipeline_stage', 'data-align': 'center', href: '#', id: crypto.randomUUID() },
          traits: [
            ACTION_TYPE_TRAIT,
            buildSecondaryTrait('pipeline_stage', [], [], t),
            REDIRECT_URL_TRAIT,
            ALIGN_TRAIT,
          ],
        },
      },
    })

    // Ensure every yippie-button has a stable, unique id for iframe highlighting.
    editor.on('component:add', (component: any) => {
      if (component.get('type') !== 'yippie-button') return
      const attrs = component.getAttributes()
      if (!attrs['id']) {
        component.addAttributes({ id: crypto.randomUUID() })
      }
    })

    // Auto-switch to traits panel when a yippie-button is selected
    editor.on('component:selected', (component: any) => {
      if (component.get('type') === 'yippie-button') {
        editor.Panels.getButton('views', 'open-tm')?.set('active', true)
      }
    })

    // Swap secondary trait + apply alignment when attributes change
    editor.on('component:update', (component: any) => {
      if (component.get('type') !== 'yippie-button') return
      const attrs = component.getAttributes()
      const actionType: string = attrs['data-action-type'] ?? 'pipeline_stage'
      const align: string = attrs['data-align'] ?? 'center'

      // Push text-align onto the closest td ancestor so email clients honour it
      const alignMap: Record<string, string> = { left: 'left', center: 'center', right: 'right' }
      const td: any = component.parent()
      if (td) {
        const current = td.getStyle()?.['text-align']
        const target = alignMap[align] ?? 'center'
        if (current !== target) td.setStyle({ ...td.getStyle(), 'text-align': target })
      }

      // Rebuild traits only when the secondary field needs to change
      const traitsModels = component.get('traits')?.models
      const currentSecondary: string | undefined = traitsModels?.[1]?.get?.('name')
      if (currentSecondary === secondaryName(actionType)) return
      const _redir = makeRedirectUrlTrait(t)
      const _align = makeAlignTrait(t)
      const _actionType = makeActionTypeTrait(t)
      const extraTraits = actionType === 'pipeline_stage' ? [_redir] : []
      component.set('traits', [
        _actionType,
        buildSecondaryTrait(actionType, stagesRef.current, labelsRef.current, t),
        ...extraTraits,
        _align,
      ])
    })

    // Remove the newsletter preset's generic button block so ours is the only one
    editor.BlockManager.remove('button')
    editor.BlockManager.add('yippie-button', {
      label: t('admin_block_action_button'),
      category: t('admin_block_basic'),
      media: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="7" width="20" height="10" rx="2"/>
        <polyline points="9 10 12 12 9 14"/>
        <path d="M15 10l2 2-2 2" stroke-width="1.5"/>
      </svg>`,
      content: `<table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:8px 0;text-align:center;">
            <a data-yippie-button="1" data-action-type="pipeline_stage" data-align="center" href="#"
               style="display:inline-block;padding:12px 28px;background:#5BA4F5;color:#ffffff;text-decoration:none;border-radius:4px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">
              Click here
            </a>
          </td>
        </tr>
      </table>`,
    })

    editor.BlockManager.add('yippie-signature', {
      label: t('admin_block_signature'),
      category: t('admin_block_basic'),
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

    // Continuously remember the caret inside the canvas iframe so a token chip
    // in the parent toolbar can insert at that spot after the button click has
    // pulled focus out of the iframe.
    editor.on('load', () => {
      const cdoc = editor.Canvas.getDocument() as Document | undefined
      if (!cdoc) return
      const capture = () => {
        const s = cdoc.getSelection?.()
        if (s && s.rangeCount > 0 && cdoc.body.contains(s.getRangeAt(0).commonAncestorContainer)) {
          lastRangeRef.current = s.getRangeAt(0).cloneRange()
        }
      }
      cdoc.addEventListener('selectionchange', capture)
      cdoc.addEventListener('mouseup', capture)
      cdoc.addEventListener('keyup', capture)
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
    insertToken(token: string) {
      const editor = editorRef.current
      if (!editor) return
      const doc = editor.Canvas.getDocument() as Document | undefined
      if (!doc) return
      const win = (editor.Canvas as any).getWindow?.() as Window | undefined
      const sel = (win?.getSelection?.() ?? doc.getSelection?.()) as Selection | null

      // Insert at the caret via the Selection API. Unlike execCommand('insertText')
      // this does not need the canvas iframe to hold focus, so it works from a chip
      // button in the parent document too (execCommand silently no-ops there — the
      // "clicking {{}} does nothing" bug). We accept the live selection OR the last
      // caret captured before the button stole focus, so pressing the chip behaves
      // exactly like typing the token where the cursor was.
      const liveRange =
        sel && sel.rangeCount > 0 && doc.body.contains(sel.getRangeAt(0).commonAncestorContainer)
          ? sel.getRangeAt(0)
          : null
      const savedRange =
        lastRangeRef.current && doc.body.contains(lastRangeRef.current.commonAncestorContainer)
          ? lastRangeRef.current
          : null
      const range = liveRange ?? savedRange

      if (range) {
        range.deleteContents()
        const node = doc.createTextNode(token)
        range.insertNode(node)
        range.setStartAfter(node)
        range.collapse(true)
        if (sel) { sel.removeAllRanges(); sel.addRange(range) }
        lastRangeRef.current = range.cloneRange()
        // Persist by re-parsing the owning text component from its own element.
        // Use components(), NOT set('content'): setting content on a text
        // component that has child components makes GrapesJS drop the whole block
        // on the next render. Only ever touch a real text component that actually
        // contains the inserted node, so we never collapse a wrapper/table.
        const selected = editor.getSelected() as any
        let owner: any = null
        if (isTextComponent(selected) && selected.getEl?.()?.contains?.(node)) {
          owner = selected
        } else {
          const c = componentForNode(editor, node)
          if (isTextComponent(c) && c.getEl?.()?.contains?.(node)) owner = c
        }
        if (owner) { try { owner.components(owner.getEl().innerHTML) } catch { /* noop */ } }
        return
      }

      // No caret anywhere yet — never a no-op. Append to the selected text block,
      // else the first text block in the design, else drop a fresh line so the
      // click always produces a visible result.
      const selected = editor.getSelected() as any
      const target = selected && isTextComponent(selected) ? selected : firstTextComponent(editor)
      if (target) {
        const current = target.getInnerHTML?.() ?? String(target.get?.('content') ?? '')
        target.components(current + token)
        return
      }
      editor.getWrapper()?.append(
        `<div data-gjs-type="text" style="font-family:Arial,sans-serif;font-size:14px;">${token}</div>`,
      )
    },
  }))

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
})

GrapesEditor.displayName = 'GrapesEditor'
export default GrapesEditor
