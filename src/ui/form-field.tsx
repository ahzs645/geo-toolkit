import {
  forwardRef,
  cloneElement,
  isValidElement,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { cn } from '../utils.js'
import { resolveNumberFieldInput, stepNumberFieldValue, type NumberFieldPolicy } from './number-field.js'

export const FORM_INPUT_CLASS =
  'w-full min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-base text-foreground md:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

function descriptionIds(...values: (string | undefined)[]) {
  return [...new Set(values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []))].join(' ') || undefined
}

export interface FormFieldProps {
  label: ReactNode
  children: ReactNode
  hint?: ReactNode
  description?: ReactNode
  error?: ReactNode
  hideLabel?: boolean
  /** Multiple controls should use a group rather than a label around unrelated inputs. */
  group?: boolean
  htmlFor?: string
  className?: string
  labelClassName?: string
  contentClassName?: string
  descriptionClassName?: string
  descriptionId?: string
  /** A help button rendered outside the label so it never changes the input's name. */
  hintAction?: ReactNode
}

export function FormField({
  label,
  children,
  hint,
  description,
  error,
  hideLabel = false,
  group = false,
  htmlFor,
  className,
  labelClassName,
  contentClassName,
  descriptionClassName,
  descriptionId,
  hintAction,
}: FormFieldProps) {
  const generated = useId()
  const Tag = group ? 'div' : 'label'
  const help = error ?? description ?? hint
  const helpId = descriptionId ?? `${generated}-description`
  // Native direct children get associated automatically; compound fields can
  // supply htmlFor/descriptionId and place those attributes on their controls.
  const directInput =
    isValidElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>(children) &&
    ((typeof children.type === 'string' && ['input', 'select', 'textarea'].includes(children.type)) ||
      children.type === NativeSelect)
  const inputId = htmlFor ?? (directInput ? (children.props.id ?? generated) : undefined)
  const content = directInput
    ? cloneElement(children, {
        id: inputId,
        'aria-describedby': descriptionIds(children.props['aria-describedby'], help != null ? helpId : undefined),
        'aria-invalid': error ? true : children.props['aria-invalid'],
      })
    : children
  return (
    <div className={cn('relative min-w-0', className)}>
      <Tag
        className={cn('flex min-w-0 flex-col gap-1 text-xs text-muted-foreground', contentClassName)}
        htmlFor={group ? undefined : inputId}
        role={group ? 'group' : undefined}
        aria-labelledby={group ? `${generated}-label` : undefined}
        aria-describedby={group && help != null ? helpId : undefined}
      >
        <span
          id={group ? `${generated}-label` : undefined}
          className={cn(hideLabel ? 'sr-only' : hintAction && 'pr-5', labelClassName)}
        >
          {label}
        </span>
        {content}
      </Tag>
      {!hideLabel && hintAction}
      {help != null && (
        <span
          id={helpId}
          className={cn(
            'mt-1 block text-xs leading-4',
            error ? 'text-destructive' : 'text-muted-foreground',
            descriptionClassName,
          )}
          role={error ? 'alert' : undefined}
        >
          {help}
        </span>
      )}
    </div>
  )
}

export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function NativeSelect({ className, ...props }, ref) {
    // Existing dense forms own their sizing. In particular a default md:text-sm
    // must not override a caller's unprefixed text-xs at desktop widths.
    return <select {...props} ref={ref} className={className ?? FORM_INPUT_CLASS} />
  },
)

export type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> &
  Omit<FormFieldProps, 'children' | 'htmlFor' | 'className'> & {
    fieldClassName?: string
    children: ReactNode
  }

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  {
    label,
    hint,
    description,
    error,
    hideLabel,
    group,
    labelClassName,
    contentClassName,
    descriptionClassName,
    descriptionId,
    hintAction,
    fieldClassName,
    id,
    children,
    ...props
  },
  ref,
) {
  const generated = useId()
  const inputId = id ?? generated
  const helpId = descriptionId ?? `${inputId}-description`
  return (
    <FormField
      label={label}
      htmlFor={inputId}
      hint={hint}
      description={description}
      error={error}
      hideLabel={hideLabel}
      group={group}
      labelClassName={labelClassName}
      contentClassName={contentClassName}
      descriptionClassName={descriptionClassName}
      descriptionId={helpId}
      hintAction={hintAction}
      className={fieldClassName}
    >
      <NativeSelect
        {...props}
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={descriptionIds(
          props['aria-describedby'],
          (error ?? description ?? hint) != null ? helpId : undefined,
        )}
      >
        {children}
      </NativeSelect>
    </FormField>
  )
})

interface NumericFieldCommon
  extends
    Omit<
      InputHTMLAttributes<HTMLInputElement>,
      'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'onKeyDown' | 'min' | 'max' | 'step' | 'type'
    >,
    Omit<FormFieldProps, 'children' | 'htmlFor' | 'className'>,
    Omit<NumberFieldPolicy, 'nullable'> {
  /** Fires on valid changes by default, or only when committed if requested. */
  updateOn?: 'change' | 'commit'
  /** Native arrows retain the browser's step-grid behavior; increment opts into raw draft stepping. */
  stepMode?: 'native' | 'increment'
  min?: number
  max?: number
  step?: number
  unit?: ReactNode
  /** Alias convenient for existing engineering controls. */
  suffix?: ReactNode
  fieldClassName?: string
  inputClassName?: string
  rowClassName?: string
  unitClassName?: string
  /** Optional display rounding. Omit to retain the source value's full precision. */
  precision?: number
}

export interface NumberFieldProps extends NumericFieldCommon {
  value: number
  onValueChange: (value: number) => void
  onCommit?: (value: number) => void
}
export interface NullableNumberFieldProps extends NumericFieldCommon {
  value: number | null
  onValueChange: (value: number | null) => void
  onCommit?: (value: number | null) => void
}

function NumericField({
  label,
  value,
  onValueChange,
  onCommit,
  nullable,
  updateOn = 'change',
  stepMode = 'native',
  clampOn = 'commit',
  blankValue = 'restore',
  invalidValue = 'restore',
  min,
  max,
  step = 1,
  precision,
  unit,
  suffix,
  hint,
  description,
  error,
  hideLabel,
  group,
  labelClassName,
  contentClassName,
  descriptionClassName,
  descriptionId,
  hintAction,
  fieldClassName,
  inputClassName,
  rowClassName,
  unitClassName,
  id,
  className,
  ...props
}: NullableNumberFieldProps & { nullable: boolean }) {
  const generated = useId()
  const inputId = id ?? generated
  const helpId = descriptionId ?? `${inputId}-description`
  // Display source precision unless a caller explicitly requests a rounded edit
  // surface. Formatting must never alter an untouched measurement on blur.
  const format = (n: number | null) =>
    n === null ? '' : precision === undefined ? String(n) : String(Number(n.toFixed(precision)))
  const [input, setInput] = useState({ value, text: format(value) })
  const dirty = useRef(false)
  const draft = input.value === value ? input.text : format(value)
  const policy = { min, max, clampOn, blankValue, nullable, invalidValue }
  const finish = () => {
    if (!dirty.current) return
    const parsed = resolveNumberFieldInput(draft, 'commit', policy)
    const next = parsed.accepted ? parsed.value : value
    setInput({ value: next, text: format(next) })
    if (parsed.accepted && next !== value) onValueChange(next)
    if (dirty.current) onCommit?.(next)
    dirty.current = false
  }
  const control = (
    <input
      {...props}
      id={inputId}
      type="number"
      className={cn(inputClassName ?? FORM_INPUT_CLASS, className)}
      value={draft}
      min={min}
      max={max}
      step={step}
      aria-invalid={error ? true : props['aria-invalid']}
      aria-describedby={descriptionIds(
        props['aria-describedby'],
        (error ?? description ?? hint) != null ? helpId : undefined,
      )}
      onChange={(event) => {
        dirty.current = true
        const text = event.target.value
        const parsed = resolveNumberFieldInput(text, 'change', policy)
        const emit = parsed.accepted && updateOn === 'change'
        const next = emit && parsed.accepted ? parsed.value : value
        setInput({ value: next, text: clampOn === 'change' && parsed.accepted ? format(parsed.value) : text })
        if (emit && next !== value) onValueChange(next)
      }}
      onBlur={finish}
      onKeyDown={(event) => {
        if (event.key === 'Enter') finish()
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
        if (stepMode === 'native') return
        event.preventDefault()
        // Step the finite draft first, then clamp the final result. Clamping
        // an out-of-range draft before stepping moves one extra step inward.
        const parsed = resolveNumberFieldInput(draft, 'change', {
          ...policy,
          clampOn: 'never',
          blankValue: 'restore',
        })
        const next = stepNumberFieldValue(parsed.accepted ? parsed.value : value, event.key === 'ArrowUp' ? 1 : -1, {
          ...policy,
          step,
          precision,
        })
        dirty.current = true
        setInput({ value: updateOn === 'change' ? next : value, text: format(next) })
        if (updateOn === 'change' && next !== value) onValueChange(next)
      }}
    />
  )
  return (
    <FormField
      label={label}
      htmlFor={inputId}
      hint={hint}
      description={description}
      error={error}
      hideLabel={hideLabel}
      group={group}
      labelClassName={labelClassName}
      contentClassName={contentClassName}
      descriptionClassName={descriptionClassName}
      descriptionId={helpId}
      hintAction={hintAction}
      className={fieldClassName}
    >
      {(unit ?? suffix) != null || rowClassName !== undefined ? (
        <span className={cn('flex min-w-0 items-center gap-1.5', rowClassName)}>
          {control}
          {(unit ?? suffix) != null && (
            <span className={cn('shrink-0 text-xs text-muted-foreground', unitClassName)}>{unit ?? suffix}</span>
          )}
        </span>
      ) : (
        control
      )}
    </FormField>
  )
}

export function NumberField(props: NumberFieldProps) {
  return (
    <NumericField
      {...props}
      nullable={false}
      onValueChange={(value) => {
        if (value !== null) props.onValueChange(value)
      }}
      onCommit={(value) => {
        if (value !== null) props.onCommit?.(value)
      }}
    />
  )
}

export function NullableNumberField(props: NullableNumberFieldProps) {
  return <NumericField {...props} nullable />
}
