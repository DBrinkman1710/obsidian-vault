// Palette column of the template builder ([TMPL2]) — drag a tile onto the
// document, or click it to append.
import { useDraggable } from '@dnd-kit/core'
import type { DocType, PaletteEntry } from './blocks'
import { PALETTE } from './blocks'
import { useT } from '../../hooks/useT'

export const PALETTE_PREFIX = 'palette:'

function PaletteTile({ entry, onAdd }: { entry: PaletteEntry; onAdd: (type: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${PALETTE_PREFIX}${entry.type}`,
  })
  const { Icon } = entry
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onAdd(entry.type)}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-left hover:border-yippie/50 hover:shadow-sm cursor-grab active:cursor-grabbing transition-colors"
    >
      <Icon size={14} className="text-yippie mt-0.5 shrink-0" />
      <span>
        <span className="block text-sm font-medium text-slate-700">{entry.label}</span>
        <span className="block text-xs text-slate-400">{entry.hint}</span>
      </span>
    </button>
  )
}

export function BlockPalette({ docType, onAdd }: { docType: DocType; onAdd: (type: string) => void }) {
  const t = useT()
  return (
    <div className="flex flex-col gap-2">
      <h3 className="heading-sm text-slate-500">{t('tpl_blocks_header')}</h3>
      {PALETTE[docType].map(entry => (
        <PaletteTile key={entry.type} entry={entry} onAdd={onAdd} />
      ))}
      <p className="text-xs text-slate-400 mt-1">{t('tpl_palette_hint')}</p>
    </div>
  )
}
