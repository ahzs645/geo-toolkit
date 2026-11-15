import { Check, ChevronDown, ChevronLeft, Pencil } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { colorRampCss } from '../scales/colorRamps.js'
import {
  CUSTOM_RAMP_LIMITS,
  customRampColors,
  customRampId,
  customRampNameProblem,
  freeCustomRampName,
  parseRampStops,
  type CustomRamp,
} from '../scales/customRamps.js'
import { cn } from '../utils.js'
import { GradientStopsEditor } from './gradient-editor.js'
import { Popover, PopoverContent, PopoverTrigger } from './popover.js'

/** A ramp a `RampField` can offer: a stable id, a name and its colours low to high. */
export interface RampOption {
  id: string
  label: string
  colors: readonly string[]
  /** Ramps with the same group are listed under one heading, in the order groups first appear. */
  group?: string
}

/** A person's own ramps and what to do when they make, change or delete one. */
export interface RampFieldCustom {
  ramps: readonly CustomRamp[]
  /** Save a ramp; `editing` is the name of the ramp it replaces. The field then picks it. */
  onSave: (ramp: CustomRamp, editing?: string) => void
  onDelete: (name: string) => void
}

export interface RampFieldProps {
  /** The chosen ramp's id. An id that is not offered shows as its own text, never as another ramp. */
  value: string
  /**
   * A ramp was picked. For one of the person's own (`customRampId(name)`), `colors` are its
   * anchors, so a host can keep them with the style and draw it where the ramp is not saved.
   */
  onChange: (id: string, colors: readonly string[]) => void
  ramps: readonly RampOption[]
  /** Accessible name, e.g. "Colour ramp". */
  label: string
  /** Draw every ramp high to low. With `onReverseChange` the list's footer adds a Reverse switch. */
  reverse?: boolean
  onReverseChange?: (reverse: boolean) => void
  /** Let the person make gradients of their own: "+ New gradient" in the footer, and a pencil on each. */
  custom?: RampFieldCustom
  disabled?: boolean
  className?: string
}

const CUSTOM_GROUP = 'Yours'

/**
 * Pick a colour ramp from a list that shows each one as its gradient, with the chosen ramp's
 * gradient on the button too. The list's footer reverses the ramp and, with `custom`, starts a
 * gradient of the person's own: the list gives way to an editor with draggable colour stops, and
 * a saved gradient is listed under "Yours" with a pencil to change or delete it.
 */
export function RampField({
  value,
  onChange,
  ramps,
  label,
  reverse = false,
  onReverseChange,
  custom,
  disabled,
  className,
}: RampFieldProps) {
  const [open, setOpen] = useState(false)
  // null: the list. Otherwise the editor, on a new gradient ('') or one of the person's own (its name).
  const [editing, setEditing] = useState<string | null>(null)
  const own: RampOption[] = (custom?.ramps ?? []).map((ramp) => ({
    id: customRampId(ramp.name),
    label: ramp.name,
    colors: customRampColors(ramp),
    group: CUSTOM_GROUP,
  }))
  const all = [...ramps, ...own]
  const selected = all.find((ramp) => ramp.id === value)
  const groups: { name: string | undefined; ramps: RampOption[] }[] = []
  for (const ramp of all) {
    const group = groups.find(({ name }) => name === ramp.group)
    if (group) group.ramps.push(ramp)
    else groups.push({ name: ramp.group, ramps: [ramp] })
  }
  const editingRamp = editing ? custom?.ramps.find(({ name }) => name === editing) : undefined

  return (
    <span className={cn('flex min-w-0 items-center', className)} data-ramp-field="">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setEditing(null)
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${label}: ${selected?.label ?? value}${reverse ? ', reversed' : ''}`}
            aria-haspopup="dialog"
            disabled={disabled}
            data-ramp-value={value}
            className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background px-2 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              aria-hidden="true"
              className="h-3.5 w-16 shrink-0 rounded-sm border border-border"
              style={{ background: selected ? colorRampCss(selected.colors, reverse) : undefined }}
            />
            <span className="min-w-0 flex-1 truncate">{selected?.label ?? value}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          // The editor is tall: beside the field it has the height of the window, and where even
          // that is short it scrolls rather than running off the screen.
          side={editing === null ? 'bottom' : 'right'}
          className={cn(
            'max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-1',
            editing === null ? 'w-64' : 'w-72',
          )}
          aria-label={editing === null ? label : editing ? `Edit ${editing}` : 'New gradient'}
          // Escape leaves the editor first, then the list.
          onEscapeKeyDown={(event) => {
            if (editing === null) return
            event.preventDefault()
            setEditing(null)
          }}
        >
          {editing !== null && custom ? (
            <RampEditor
              key={editing}
              label={label}
              editing={editingRamp}
              startFrom={selected?.colors ?? ramps[0]?.colors ?? ['#ffffff', '#000000']}
              taken={[...ramps.map((ramp) => ramp.label), ...custom.ramps.map((ramp) => ramp.name)]}
              onCancel={() => setEditing(null)}
              onSave={(ramp) => {
                custom.onSave(ramp, editingRamp?.name)
                setEditing(null)
                onChange(customRampId(ramp.name), customRampColors(ramp))
              }}
              onDelete={
                editingRamp
                  ? () => {
                      custom.onDelete(editingRamp.name)
                      setEditing(null)
                      // A deleted ramp cannot stay chosen: fall back to the first one offered.
                      if (value === customRampId(editingRamp.name) && ramps[0]) onChange(ramps[0].id, ramps[0].colors)
                    }
                  : undefined
              }
            />
          ) : (
            <>
              <div role="listbox" aria-label={label} className="max-h-64 overflow-y-auto">
                {groups.map(({ name, ramps: members }) => (
                  <div key={name ?? ''} role="group" aria-label={name}>
                    {name && (
                      <div className="px-2 pb-0.5 pt-1.5 text-2xs font-medium text-muted-foreground">{name}</div>
                    )}
                    {members.map((ramp) => (
                      <div key={ramp.id} className="flex items-center">
                        <button
                          type="button"
                          role="option"
                          aria-selected={ramp.id === value}
                          data-ramp-option={ramp.id}
                          className={cn(
                            'flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent',
                            ramp.id === value && 'bg-accent',
                          )}
                          onClick={() => {
                            onChange(ramp.id, ramp.colors)
                            setOpen(false)
                          }}
                        >
                          <span
                            aria-hidden="true"
                            className="h-3.5 w-20 shrink-0 rounded-sm border border-border"
                            style={{ background: colorRampCss(ramp.colors, reverse) }}
                          />
                          <span className="min-w-0 flex-1 truncate">{ramp.label}</span>
                          {ramp.id === value && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
                        </button>
                        {ramp.group === CUSTOM_GROUP && custom && (
                          <button
                            type="button"
                            aria-label={`Edit ${ramp.label}`}
                            title="Edit or delete this gradient"
                            className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => setEditing(ramp.label)}
                          >
                            <Pencil className="size-3" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {(custom || onReverseChange) && (
                <div className="mt-1 flex items-center justify-between gap-2 border-t border-border px-2 pb-1 pt-2 text-xs">
                  {custom ? (
                    <button
                      type="button"
                      className="rounded-sm text-link underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      title="Make your own gradient from colours you pick, kept in this browser"
                      onClick={() => setEditing('')}
                    >
                      + New gradient
                    </button>
                  ) : (
                    <span />
                  )}
                  {onReverseChange && (
                    <label
                      className="flex cursor-pointer items-center gap-1.5"
                      title="Swap the colours of the low and high ends"
                    >
                      <input
                        type="checkbox"
                        checked={reverse}
                        aria-label={`${label}: reverse`}
                        onChange={(event) => onReverseChange(event.target.checked)}
                      />
                      Reverse
                    </label>
                  )}
                </div>
              )}
            </>
          )}
        </PopoverContent>
      </Popover>
    </span>
  )
}

/** Three colours of the ramp in use (its ends and middle): where a new gradient starts. */
const startingStops = (colors: readonly string[]) => [
  colors[0],
  colors[Math.floor((colors.length - 1) / 2)],
  colors[colors.length - 1],
]

/**
 * Make or edit a gradient: a name, its colour stops on a bar, a preview of the ramp as a map will
 * use it, and the colours as hex codes to type or paste. Nothing is saved until Save.
 */
function RampEditor({
  label,
  editing,
  startFrom,
  taken,
  onCancel,
  onSave,
  onDelete,
}: {
  label: string
  editing?: CustomRamp
  startFrom: readonly string[]
  taken: readonly string[]
  onCancel: () => void
  onSave: (ramp: CustomRamp) => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(() => editing?.name ?? freeCustomRampName(taken))
  const [ramp, setRamp] = useState<{ stops: string[]; at?: number[] }>(() =>
    editing ? { stops: [...editing.stops], at: editing.at } : { stops: startingStops(startFrom) },
  )
  const [text, setText] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const problem = customRampNameProblem(name, taken, editing?.name)
  const takeText = () => {
    const stops = text === null ? null : parseRampStops(text)
    setText(null)
    if (stops && stops.join(' ') !== ramp.stops.join(' ')) setRamp({ stops })
  }
  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!problem) onSave({ name: name.trim(), stops: ramp.stops, ...(ramp.at ? { at: ramp.at } : {}) })
  }
  const field =
    'h-7 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring'
  return (
    <form className="grid gap-2 p-1.5" onSubmit={save} data-ramp-editor="">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        <button
          type="button"
          aria-label="Back to the ramps"
          title="Back to the ramps (Esc)"
          className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onCancel}
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
        </button>
        {editing ? 'Edit gradient' : 'New gradient'}
      </div>
      <label className="grid gap-1 text-2xs text-muted-foreground">
        Name
        <input
          className={cn(field, 'text-foreground')}
          value={name}
          maxLength={CUSTOM_RAMP_LIMITS.maxName}
          aria-invalid={problem ? true : undefined}
          aria-label={`${label}: gradient name`}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {problem && (
        <span role="alert" className="text-2xs text-danger">
          {problem}
        </span>
      )}
      <GradientStopsEditor
        label="Gradient"
        stops={ramp.stops}
        at={ramp.at}
        onChange={(stops, at) => setRamp({ stops, ...(at ? { at } : {}) })}
      />
      <div className="grid gap-1 text-2xs text-muted-foreground">
        As the map uses it, low to high
        <span
          aria-hidden="true"
          className="h-3.5 rounded-sm border border-border"
          style={{ background: colorRampCss(customRampColors(ramp)) }}
        />
      </div>
      <label className="grid gap-1 text-2xs text-muted-foreground">
        Hex codes
        <input
          className={cn(field, 'font-mono text-foreground')}
          value={text ?? ramp.stops.join(' ')}
          spellCheck={false}
          autoComplete="off"
          aria-label={`${label}: gradient colours as hex codes`}
          title="Type or paste a list of colours, with spaces or commas between, then Enter"
          onChange={(event) => setText(event.target.value)}
          onBlur={takeText}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            takeText()
          }}
        />
      </label>
      <div className="flex items-center gap-2 pt-1 text-xs">
        {onDelete &&
          (confirmDelete ? (
            <button
              type="button"
              className="rounded-sm px-1.5 py-1 font-medium text-danger outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              onClick={onDelete}
            >
              Delete it
            </button>
          ) : (
            <button
              type="button"
              className="rounded-sm px-1.5 py-1 text-muted-foreground outline-none hover:text-danger focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          ))}
        <span className="flex-1" />
        <button
          type="button"
          className="rounded-md px-2 py-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!!problem}
          className="rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </form>
  )
}
