// The document column of the template builder ([TMPL2]) — a sortable stack of
// approximate block previews. Exact output comes from the server PDF preview.
import { GripVertical, Trash2 } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Block, DocType } from './blocks'
import { BLOCK_LABELS } from './blocks'
import { useT } from '../../hooks/useT'

const SAMPLE_ROWS = [
  { desc: 'Consultancy', qty: 8, price: 'EUR 95,00', vat: '21%', total: 'EUR 760,00' },
  { desc: 'Hosting en onderhoud', qty: 1, price: 'EUR 49,00', vat: '21%', total: 'EUR 49,00' },
]

function BlockPreview({ block, docType }: { block: Block; docType: DocType }) {
  const t = useT()
  const cfg = block.config
  const align = cfg.align === 'center' ? 'text-center' : cfg.align === 'right' ? 'text-right' : 'text-left'
  switch (block.type) {
    case 'logo_header':
      return (
        <div>
          <div className="h-1 rounded bg-yippie mb-2" />
          <div className="flex items-start justify-between">
            <div>
              {cfg.show_logo && <p className="text-sm font-bold text-slate-800">Your company</p>}
              {cfg.show_address && <p className="text-xs text-slate-400">Street address · Postal code · City</p>}
              {cfg.show_kvk_btw && <p className="text-xs text-slate-400">KvK · BTW</p>}
              {cfg.show_iban && <p className="text-xs text-slate-400">IBAN</p>}
            </div>
            <div className="text-right">
              {cfg.title && <p className="text-base font-bold text-yippie">{cfg.title}</p>}
              {docType === 'invoice' && <p className="text-xs text-slate-400">Number · Date · Due date</p>}
            </div>
          </div>
          {/* The recipient block is drawn with the header on every invoice — it
              is legally required and has no block of its own, so it is shown
              here rather than looking like something the user forgot to add. */}
          {docType === 'invoice' && (
            <div className="mt-3">
              <p className="text-[10px] font-bold text-slate-400 tracking-wide">FACTUUR AAN</p>
              <p className="text-xs font-semibold text-slate-700">Client name</p>
              <p className="text-xs text-slate-400">Street address · Postal code · City</p>
              <p className="text-xs text-slate-400">BTW (reverse charge only)</p>
            </div>
          )}
        </div>
      )
    case 'heading':
      return (
        <p className={`${cfg.level === 2 ? 'text-sm' : 'text-base'} font-bold text-slate-800 ${align} ${cfg.text ? '' : 'text-slate-300'}`}>
          {cfg.text || t('tpl_empty_heading')}
        </p>
      )
    case 'text':
      return (
        <p className={`${cfg.size === 'sm' ? 'text-xs' : 'text-sm'} text-slate-600 whitespace-pre-wrap ${align} ${cfg.text ? '' : 'text-slate-300'}`}>
          {cfg.text || t('tpl_empty_text')}
        </p>
      )
    case 'divider':
      return cfg.style === 'space'
        ? <div className="h-4" />
        : <hr className="border-slate-200" />
    case 'line_items':
      return (
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-yippie text-white">
              <th className="text-left px-2 py-1 font-semibold">Omschrijving</th>
              <th className="text-center px-2 py-1 font-semibold">Aantal</th>
              <th className="text-right px-2 py-1 font-semibold">Prijs excl.</th>
              {cfg.show_vat_column && <th className="text-center px-2 py-1 font-semibold">BTW %</th>}
              <th className="text-right px-2 py-1 font-semibold">Bedrag excl.</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_ROWS.map((r, i) => (
              <tr key={r.desc} className={cfg.zebra && i % 2 === 1 ? 'bg-slate-50' : ''}>
                <td className="px-2 py-1 text-slate-600">{r.desc}</td>
                <td className="px-2 py-1 text-center text-slate-600">{r.qty}</td>
                <td className="px-2 py-1 text-right text-slate-600">{r.price}</td>
                {cfg.show_vat_column && <td className="px-2 py-1 text-center text-slate-600">{r.vat}</td>}
                <td className="px-2 py-1 text-right text-slate-600">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    case 'totals':
      return (
        <div className="flex flex-col items-end gap-0.5 text-xs text-slate-600">
          <p>Subtotaal excl. BTW <span className="inline-block w-20 text-right">EUR 809,00</span></p>
          {cfg.show_vat_breakdown
            ? <p>BTW 21% <span className="inline-block w-20 text-right">EUR 169,89</span></p>
            : <p>BTW <span className="inline-block w-20 text-right">EUR 169,89</span></p>}
          <p className="bg-yippie text-white font-semibold px-2 py-0.5 rounded">
            Totaal incl. BTW <span className="inline-block w-20 text-right">EUR 978,89</span>
          </p>
        </div>
      )
    case 'notes':
      return (
        <div>
          {cfg.label && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{cfg.label}</p>}
          <p className={`text-xs whitespace-pre-wrap ${cfg.source === 'custom' && cfg.text ? 'text-slate-600' : 'text-slate-300 italic'}`}>
            {cfg.source === 'custom'
              ? (cfg.text || t('tpl_empty_custom'))
              : `Filled with the ${docType === 'invoice' ? 'invoice' : 'contract'} notes`}
          </p>
        </div>
      )
    case 'footer':
      return <p className={`text-xs text-center ${cfg.text ? 'text-slate-400' : 'text-slate-300'}`}>{cfg.text || t('tpl_empty_footer')}</p>
    case 'signature':
      return (
        <div>
          <div className="w-32 border-b-2 border-yippie mb-1" />
          <p className="text-xs font-semibold text-slate-600">Signed by …</p>
          {(cfg.show_date || cfg.show_ip) && (
            <p className="text-xs text-slate-400">
              {[cfg.show_date && 'Date', cfg.show_ip && 'IP address'].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      )
    default:
      return <p className="text-xs text-slate-300 italic">{t('tpl_unknown_block')}</p>
  }
}

function SortableBlock({
  block, docType, selected, onSelect, onDelete,
}: {
  block: Block
  docType: DocType
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const t = useT()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      onClick={onSelect}
      className={`group relative rounded-lg border px-4 py-3 pl-8 cursor-pointer transition-colors ${
        selected ? 'border-yippie bg-yippie/5' : 'border-transparent hover:border-slate-200'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={e => e.preventDefault()}
        tabIndex={-1}
        aria-label={t('tpl_drag_to_reorder')}
        className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-slate-500 cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={14} />
      </button>
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        aria-label={t('tpl_delete_block').replace('{label}', BLOCK_LABELS[block.type] ?? block.type)}
        className="absolute right-1.5 top-1.5 p-1 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-danger-600"
      >
        <Trash2 size={14} />
      </button>
      <BlockPreview block={block} docType={docType} />
    </div>
  )
}

export function BlockStack({
  blocks, docType, selectedId, onSelect, onDelete,
}: {
  blocks: Block[]
  docType: DocType
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  const t = useT()
  // Droppable so palette tiles can be dropped on the empty page area too.
  const { setNodeRef } = useDroppable({ id: 'block-stack' })
  return (
    <div ref={setNodeRef} className="bg-white rounded-2xl shadow-md p-6 min-h-[540px] flex flex-col gap-1">
      <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
        {blocks.map(b => (
          <SortableBlock
            key={b.id}
            block={b}
            docType={docType}
            selected={selectedId === b.id}
            onSelect={() => onSelect(b.id)}
            onDelete={() => onDelete(b.id)}
          />
        ))}
      </SortableContext>
      {blocks.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-16">
          {t('tpl_drag_to_start')}
        </p>
      )}
    </div>
  )
}
