import { useState } from 'react'

interface Props {
  value: number
  min: number
  max: number
  step?: number
  disabled?: boolean
  onCommit: (v: number) => void
  'aria-label'?: string
}

/** Number input that keeps free-form text while typing and commits valid values. */
export function NumField({ value, min, max, step = 1, disabled, onCommit, ...rest }: Props) {
  const [text, setText] = useState<string | null>(null)
  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      aria-label={rest['aria-label']}
      value={text ?? String(value)}
      onChange={(e) => {
        setText(e.target.value)
        const v = parseFloat(e.target.value)
        if (Number.isFinite(v) && v >= min && v <= max) onCommit(v)
      }}
      onBlur={() => setText(null)}
    />
  )
}
