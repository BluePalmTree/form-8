import { useState } from 'react'

interface Props {
  value: number
  min: number
  max: number
  step?: number
  /** Only whole numbers: typed decimals are rounded. */
  integer?: boolean
  disabled?: boolean
  onCommit: (v: number) => void
  'aria-label'?: string
}

/** Number input that keeps free-form text while typing and commits valid values. */
export function NumField({ value, min, max, step = 1, integer, disabled, onCommit, ...rest }: Props) {
  const [text, setText] = useState<string | null>(null)
  const [seen, setSeen] = useState(value)
  // The value changed from outside (another formation, undo, ...): drop stale typed text.
  // Needed because buttons don't blur the field on iOS/Safari, so onBlur alone is not enough.
  if (value !== seen) {
    setSeen(value)
    if (text !== null && parseFloat(text) !== value) setText(null)
  }
  return (
    <input
      type="number"
      inputMode={integer ? 'numeric' : 'decimal'}
      min={min}
      max={max}
      step={integer ? 1 : step}
      disabled={disabled}
      aria-label={rest['aria-label']}
      value={text ?? String(value)}
      onChange={(e) => {
        setText(e.target.value)
        const parsed = parseFloat(e.target.value)
        const v = integer ? Math.round(parsed) : parsed
        if (Number.isFinite(v) && v >= min && v <= max) onCommit(v)
      }}
      onBlur={() => setText(null)}
    />
  )
}
