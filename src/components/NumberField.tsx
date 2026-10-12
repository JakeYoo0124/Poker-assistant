interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
}

export default function NumberField({ label, value, onChange, step = 0.5, min = 0 }: NumberFieldProps) {
  return (
    <label className="text-xs text-slate-500">
      {label}
      <input
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value)))}
        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-right text-sm text-slate-900 tabular-nums dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
    </label>
  )
}
