// Shared builder inputs used by the [FLOW3] canvas inspector. Same controls the
// modal builder (FlowsPage) renders, extracted so both surfaces write the exact
// same flows JSON.
import {
  Condition, FlowsMeta, MetaField, MetaOption, MetaTrigger, OP_LABELS, WAIT_UNITS,
} from '../lib'

const base = 'px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

export function OptionSelect({
  value, onChange, options, placeholder,
}: { value: string; onChange: (v: string) => void; options: MetaOption[]; placeholder: string }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`${base} bg-white w-full`}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  )
}

export function ConfigField({
  field, value, meta, onChange,
}: { field: MetaField; value: any; meta: FlowsMeta; onChange: (v: any) => void }) {
  if (field.type === 'select') {
    return (
      <select value={value ?? ''} onChange={e => onChange(e.target.value)} className={`${base} bg-white w-full`}>
        <option value="">{field.label}…</option>
        {(field.options ?? []).map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
      </select>
    )
  }
  if (field.type === 'user_select') {
    return <OptionSelect value={value ?? ''} onChange={onChange} options={meta.users} placeholder={`${field.label}…`} />
  }
  if (field.type === 'stage_select') {
    return <OptionSelect value={value ?? ''} onChange={onChange} options={meta.stages} placeholder={`${field.label}…`} />
  }
  if (field.type === 'template_select') {
    return <OptionSelect value={value ?? ''} onChange={onChange} options={meta.templates} placeholder={`${field.label}…`} />
  }
  if (field.type === 'textarea') {
    return (
      <textarea
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={field.label}
        rows={2}
        className={`${base} w-full resize-y`}
      />
    )
  }
  return (
    <input
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={field.label}
      className={`${base} w-full`}
    />
  )
}

export function WaitConfig({
  config, onChange,
}: { config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const unit = WAIT_UNITS.find(u => u in config) ?? 'hours'
  const amount = config[unit] ?? ''
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-slate-600">Wait for</span>
      <input
        type="number"
        min={1}
        value={amount}
        onChange={e => onChange(e.target.value === '' ? {} : { [unit]: Number(e.target.value) })}
        placeholder="0"
        className={`${base} w-20`}
      />
      <select
        value={unit}
        onChange={e => onChange(amount === '' ? {} : { [e.target.value]: Number(amount) })}
        className={`${base} bg-white`}
      >
        {WAIT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
    </div>
  )
}

export function ConditionRow({
  condition, trigger, meta, onChange, onRemove,
}: {
  condition: Condition
  trigger: MetaTrigger | undefined
  meta: FlowsMeta
  onChange: (patch: Partial<Condition>) => void
  onRemove: () => void
}) {
  const fieldMeta = trigger?.fields.find(f => f.key === condition.field)

  function valueInput() {
    if (condition.op === 'in') {
      const display = Array.isArray(condition.value) ? condition.value.join(', ') : (condition.value ?? '')
      return (
        <input
          value={display}
          onChange={e => onChange({ value: e.target.value })}
          placeholder="value1, value2, …"
          className={`${base} w-full`}
        />
      )
    }
    if (fieldMeta?.type === 'select') {
      return (
        <select
          value={condition.value ?? ''}
          onChange={e => onChange({ value: e.target.value })}
          className={`${base} bg-white w-full`}
        >
          <option value="">value…</option>
          {(fieldMeta.options ?? []).map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
        </select>
      )
    }
    if (fieldMeta?.type === 'stage_select') {
      return (
        <OptionSelect
          value={condition.value ?? ''}
          onChange={v => onChange({ value: v })}
          options={meta.stages}
          placeholder="stage…"
        />
      )
    }
    return (
      <input
        value={condition.value ?? ''}
        onChange={e => onChange({ value: e.target.value })}
        placeholder="value"
        className={`${base} w-full`}
      />
    )
  }

  return (
    <div className="space-y-1.5 border border-slate-200 rounded-lg p-2 bg-white">
      <div className="flex items-center gap-1.5">
        {trigger?.free_fields ? (
          <input
            value={condition.field}
            onChange={e => onChange({ field: e.target.value })}
            placeholder="payload field…"
            className={`${base} flex-1 min-w-0`}
          />
        ) : (
          <select
            value={condition.field}
            onChange={e => onChange({ field: e.target.value, value: '' })}
            className={`${base} bg-white flex-1 min-w-0`}
          >
            <option value="">field…</option>
            {(trigger?.fields ?? []).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        )}
        <select
          value={condition.op}
          onChange={e => onChange({ op: e.target.value })}
          className={`${base} bg-white`}
        >
          {Object.entries(OP_LABELS).map(([op, label]) => <option key={op} value={op}>{label}</option>)}
        </select>
        <button
          onClick={onRemove}
          className="p-1 text-slate-400 hover:text-red-500 rounded"
          title="Remove condition"
        >
          ×
        </button>
      </div>
      {valueInput()}
    </div>
  )
}
