// Config column of the template builder ([TMPL2]) — per block settings for the
// selected block; template settings (invoice defaults) when nothing is selected.
import { useRef } from 'react'
import type { Block, DocType } from './blocks'
import { BLOCK_LABELS } from './blocks'
import { MergeFieldChips } from './MergeFieldMenu'

const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

export interface TemplateSettings {
  default_tax_rate_pct: number | null
  default_due_days: number | null
  default_notes: string
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer py-1">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="rounded border-slate-300 text-yippie focus:ring-yippie" />
      {label}
    </label>
  )
}

function SegPicker({ label, value, options, onChange }: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex gap-1">
        {options.map(o => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              value === o.value ? 'border-yippie bg-yippie/10 text-slate-900' : 'border-slate-200 text-slate-500 hover:border-slate-300'
            }`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]

function BlockConfig({ block, docType, fields, onChange }: {
  block: Block
  docType: DocType
  fields: string[]
  onChange: (config: Record<string, any>) => void
}) {
  const cfg = block.config
  const set = (patch: Record<string, any>) => onChange({ ...cfg, ...patch })
  const textRef = useRef<HTMLTextAreaElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  switch (block.type) {
    case 'logo_header':
      return (
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Title (right side)</label>
            <input ref={titleRef} className="input-base" value={cfg.title ?? ''} placeholder={docType === 'invoice' ? 'FACTUUR' : 'Optional'}
              onChange={e => set({ title: e.target.value })} />
          </div>
          <div>
            <Toggle label="Company name" checked={!!cfg.show_logo} onChange={v => set({ show_logo: v })} />
            <Toggle label="Address and phone" checked={!!cfg.show_address} onChange={v => set({ show_address: v })} />
            <Toggle label="KvK and BTW numbers" checked={!!cfg.show_kvk_btw} onChange={v => set({ show_kvk_btw: v })} />
            <Toggle label="IBAN" checked={!!cfg.show_iban} onChange={v => set({ show_iban: v })} />
          </div>
          {docType === 'invoice' && (
            <p className="text-xs text-slate-400">The invoice number and dates always appear on the right.</p>
          )}
        </div>
      )
    case 'heading':
      return (
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Text</label>
            <textarea ref={textRef} className="input-base resize-y min-h-[64px]" value={cfg.text ?? ''}
              onChange={e => set({ text: e.target.value })} />
            <MergeFieldChips fields={fields} targetRef={textRef} value={cfg.text ?? ''} onChange={text => set({ text })} />
          </div>
          <SegPicker label="Size" value={String(cfg.level ?? 1)} onChange={v => set({ level: Number(v) })}
            options={[{ value: '1', label: 'Large' }, { value: '2', label: 'Small' }]} />
          <SegPicker label="Alignment" value={cfg.align ?? 'left'} options={ALIGN_OPTIONS} onChange={align => set({ align })} />
        </div>
      )
    case 'text':
      return (
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Text</label>
            <textarea ref={textRef} className="input-base resize-y min-h-[160px] font-mono text-xs leading-relaxed"
              value={cfg.text ?? ''} onChange={e => set({ text: e.target.value })} />
            <MergeFieldChips fields={fields} targetRef={textRef} value={cfg.text ?? ''} onChange={text => set({ text })} />
          </div>
          <SegPicker label="Size" value={cfg.size ?? 'md'} onChange={size => set({ size })}
            options={[{ value: 'md', label: 'Normal' }, { value: 'sm', label: 'Small' }]} />
          <SegPicker label="Alignment" value={cfg.align ?? 'left'} options={ALIGN_OPTIONS} onChange={align => set({ align })} />
        </div>
      )
    case 'divider':
      return (
        <SegPicker label="Style" value={cfg.style ?? 'line'} onChange={style => set({ style })}
          options={[{ value: 'line', label: 'Line' }, { value: 'space', label: 'Blank space' }]} />
      )
    case 'notes':
      return (
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Label</label>
            <input className="input-base" value={cfg.label ?? ''} placeholder="e.g. BETALINGSINFORMATIE"
              onChange={e => set({ label: e.target.value })} />
          </div>
          <SegPicker label="Content" value={cfg.source ?? 'document'} onChange={source => set({ source })}
            options={[
              { value: 'document', label: docType === 'invoice' ? 'Invoice notes' : 'Contract notes' },
              { value: 'custom', label: 'Fixed text' },
            ]} />
          {cfg.source === 'custom' && (
            <div>
              <label className={labelCls}>Fixed text</label>
              <textarea ref={textRef} className="input-base resize-y min-h-[80px]" value={cfg.text ?? ''}
                onChange={e => set({ text: e.target.value })} />
              <MergeFieldChips fields={fields} targetRef={textRef} value={cfg.text ?? ''} onChange={text => set({ text })} />
            </div>
          )}
        </div>
      )
    case 'footer':
      return (
        <div>
          <label className={labelCls}>Text</label>
          <input ref={titleRef} className="input-base" value={cfg.text ?? ''} placeholder="Gegenereerd met Yippie"
            onChange={e => set({ text: e.target.value })} />
          <MergeFieldChips fields={fields} targetRef={titleRef} value={cfg.text ?? ''} onChange={text => set({ text })} />
        </div>
      )
    case 'line_items':
      return (
        <div>
          <Toggle label="Alternating row colors" checked={!!cfg.zebra} onChange={v => set({ zebra: v })} />
          <Toggle label="VAT column" checked={!!cfg.show_vat_column} onChange={v => set({ show_vat_column: v })} />
          <p className="text-xs text-slate-400 mt-2">Filled with the invoice's own line items.</p>
        </div>
      )
    case 'totals':
      return (
        <div>
          <Toggle label="VAT breakdown per rate" checked={!!cfg.show_vat_breakdown} onChange={v => set({ show_vat_breakdown: v })} />
          <p className="text-xs text-slate-400 mt-2">Amounts always come from the invoice itself.</p>
        </div>
      )
    case 'signature':
      return (
        <div>
          <Toggle label="Show signing date" checked={!!cfg.show_date} onChange={v => set({ show_date: v })} />
          <Toggle label="Show signer IP address" checked={!!cfg.show_ip} onChange={v => set({ show_ip: v })} />
          <p className="text-xs text-slate-400 mt-2">On signed contracts the audit trail always prints, even without this block.</p>
        </div>
      )
    default:
      return <p className="text-xs text-slate-400">This block has no settings.</p>
  }
}

export function BlockConfigPanel({
  block, docType, fields, settings, onConfigChange, onSettingsChange,
}: {
  block: Block | null
  docType: DocType
  fields: string[]
  settings: TemplateSettings | null
  onConfigChange: (config: Record<string, any>) => void
  onSettingsChange: (settings: TemplateSettings) => void
}) {
  if (block) {
    return (
      <div className="bg-white rounded-2xl shadow-md p-5">
        <h3 className="heading-sm text-slate-500 mb-4">{BLOCK_LABELS[block.type] ?? block.type}</h3>
        <BlockConfig block={block} docType={docType} fields={fields} onChange={onConfigChange} />
      </div>
    )
  }
  if (docType === 'invoice' && settings) {
    return (
      <div className="bg-white rounded-2xl shadow-md p-5 flex flex-col gap-3">
        <h3 className="heading-sm text-slate-500">Template settings</h3>
        <p className="text-xs text-slate-400 -mt-2">Defaults applied to new invoices that use this template.</p>
        <div>
          <label className={labelCls}>Default VAT rate</label>
          <select className="input-base" value={settings.default_tax_rate_pct ?? ''}
            onChange={e => onSettingsChange({ ...settings, default_tax_rate_pct: e.target.value === '' ? null : Number(e.target.value) })}>
            <option value="">No default</option>
            <option value="21">21%</option>
            <option value="9">9%</option>
            <option value="0">0%</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Payment term (days until due)</label>
          <input type="number" min={0} max={365} className="input-base" value={settings.default_due_days ?? ''}
            placeholder="e.g. 14"
            onChange={e => onSettingsChange({ ...settings, default_due_days: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
        <div>
          <label className={labelCls}>Default payment notes</label>
          <textarea className="input-base resize-y min-h-[80px]" value={settings.default_notes}
            placeholder="e.g. Gelieve het bedrag over te maken onder vermelding van het factuurnummer."
            onChange={e => onSettingsChange({ ...settings, default_notes: e.target.value })} />
        </div>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-2xl shadow-md p-5">
      <h3 className="heading-sm text-slate-500 mb-2">Settings</h3>
      <p className="text-xs text-slate-400">Select a block to edit its settings.</p>
    </div>
  )
}
