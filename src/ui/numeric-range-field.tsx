import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../utils.js'

export interface NumericRangeControlProps {
  id: string
  value: number
  min: number
  max: number
  step: number
  disabled?: boolean
  onChange: (value: number) => void
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-valuetext'?: string
}

export interface NumericRangeFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'min' | 'max' | 'step' | 'onChange' | 'children'
> {
  label: ReactNode
  value: number
  /** Fires continuously as the range changes; the host decides when to recalculate. */
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: ReactNode
  display?: ReactNode
  description?: ReactNode
  /** Inline preserves compact engineering labels such as "Recovery · 80%". */
  layout?: 'split' | 'inline'
  valueSeparator?: ReactNode
  hideValue?: boolean
  inputClassName?: string
  headerClassName?: string
  labelClassName?: string
  valueClassName?: string
  /** Optional adapter for a custom slider, retaining the same label and value contract. */
  renderControl?: (props: NumericRangeControlProps) => ReactNode
}

/** A labeled, controlled numeric range with a native input or a supplied slider adapter. */
export const NumericRangeField = forwardRef<HTMLInputElement, NumericRangeFieldProps>(function NumericRangeField(
  {
    label,
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    unit,
    display,
    description,
    layout = 'split',
    valueSeparator = ': ',
    hideValue = false,
    className,
    inputClassName,
    headerClassName,
    labelClassName,
    valueClassName,
    renderControl,
    id,
    disabled,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-valuetext': ariaValueText,
    ...props
  },
  ref,
) {
  const generated = useId()
  const inputId = id ?? generated
  const labelId = `${inputId}-label`
  const descriptionId = `${inputId}-description`
  const shown = display ?? (
    <>
      {value}
      {unit != null ? <> {unit}</> : null}
    </>
  )
  const controlProps: NumericRangeControlProps = {
    id: inputId,
    value,
    min,
    max,
    step,
    disabled,
    onChange,
    'aria-label': ariaLabel ?? (typeof label === 'string' ? label : undefined),
    'aria-labelledby': ariaLabelledBy ?? (ariaLabel || typeof label === 'string' ? undefined : labelId),
    'aria-describedby':
      [ariaDescribedBy, description != null ? descriptionId : undefined].filter(Boolean).join(' ') || undefined,
    'aria-valuetext':
      ariaValueText ??
      (typeof display === 'string' ? display : typeof unit === 'string' ? `${value} ${unit}` : undefined),
  }
  return (
    <div className={cn('space-y-2', className)}>
      <div className={cn(layout === 'split' ? 'flex items-center justify-between gap-3' : undefined, headerClassName)}>
        <label id={labelId} htmlFor={inputId} className={labelClassName}>
          {label}
        </label>
        {!hideValue && (
          <>
            {layout === 'inline' ? valueSeparator : null}
            <span className={cn('tabular-nums', valueClassName)}>{shown}</span>
          </>
        )}
      </div>
      {renderControl ? (
        renderControl(controlProps)
      ) : (
        <input
          {...props}
          {...controlProps}
          ref={ref}
          type="range"
          className={cn('h-2 w-full accent-primary', inputClassName)}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      )}
      {description != null && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  )
})
