// Block based document templates ([TMPL2]) — client side mirror of
// backend app/core/doc_blocks.py. The builder edits {version, blocks[]} and
// the backend validates on save; keep block types and config keys in sync.
import {
  AlignLeft, Heading1, Minus, PanelTop, PenLine, Sigma, StickyNote, Table2, Type,
  type LucideIcon,
} from 'lucide-react'

export type DocType = 'contract' | 'invoice'

export interface Block {
  id: string
  type: string
  config: Record<string, any>
}

export interface BlockDoc {
  version: number
  blocks: Block[]
}

export function newBlockId(): string {
  return `b_${Math.random().toString(16).slice(2, 10)}`
}

export function defaultConfig(type: string): Record<string, any> {
  switch (type) {
    case 'logo_header': return { title: '', show_logo: true, show_address: true, show_kvk_btw: true, show_iban: true }
    case 'heading':     return { text: '', level: 1, align: 'left' }
    case 'text':        return { text: '', size: 'md', align: 'left' }
    case 'divider':     return { style: 'line' }
    case 'notes':       return { label: '', source: 'document', text: '' }
    case 'footer':      return { text: '' }
    case 'line_items':  return { zebra: true, show_vat_column: true }
    case 'totals':      return { show_vat_breakdown: true }
    case 'signature':   return { show_date: true, show_ip: true }
    default:            return {}
  }
}

export interface PaletteEntry {
  type: string
  label: string
  hint: string
  Icon: LucideIcon
}

const SHARED_PALETTE: PaletteEntry[] = [
  { type: 'logo_header', label: 'Company header', hint: 'Your name, address and registration details', Icon: PanelTop },
  { type: 'heading',     label: 'Heading',        hint: 'A title, supports merge fields',              Icon: Heading1 },
  { type: 'text',        label: 'Text',           hint: 'Paragraphs with merge fields',                Icon: Type },
  { type: 'divider',     label: 'Divider',        hint: 'A line or blank space',                       Icon: Minus },
  { type: 'notes',       label: 'Notes',          hint: 'Document notes or fixed text',                Icon: StickyNote },
  { type: 'footer',      label: 'Footer',         hint: 'Small centered line at the bottom',           Icon: AlignLeft },
]

export const PALETTE: Record<DocType, PaletteEntry[]> = {
  invoice: [
    ...SHARED_PALETTE,
    { type: 'line_items', label: 'Line items', hint: 'The invoice lines, filled automatically', Icon: Table2 },
    { type: 'totals',     label: 'Totals',     hint: 'Subtotal, VAT breakdown and total',       Icon: Sigma },
  ],
  contract: [
    ...SHARED_PALETTE,
    { type: 'signature', label: 'Signature', hint: 'The e signing audit block', Icon: PenLine },
  ],
}

export const BLOCK_LABELS: Record<string, string> = Object.fromEntries(
  [...PALETTE.invoice, ...PALETTE.contract].map(e => [e.type, e.label]),
)

// Starter layouts for newly created templates — one obvious block set per type.
export function starterBlocks(docType: DocType): BlockDoc {
  const b = (type: string, config: Record<string, any> = {}): Block => ({
    id: newBlockId(), type, config: { ...defaultConfig(type), ...config },
  })
  if (docType === 'invoice') {
    return {
      version: 1,
      blocks: [
        b('logo_header', { title: 'FACTUUR' }),
        b('line_items'),
        b('totals'),
        b('notes', { label: 'BETALINGSINFORMATIE', source: 'document' }),
        b('footer', { text: 'Gegenereerd met Yippie' }),
      ],
    }
  }
  return {
    version: 1,
    blocks: [
      b('heading', { text: '{{contract.title}}' }),
      b('text', { text: 'This agreement is made on {{date.today}} between {{tenant.name}} and {{company.name}}.' }),
      b('signature'),
    ],
  }
}
