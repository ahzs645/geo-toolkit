'use client'

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Layers } from 'lucide-react'

import { cn } from '../utils.js'

/** Which side of the map a control stack sits on, so a popover opens towards the map's middle. */
export const MapControlsSideContext = createContext<'left' | 'right' | null>(null)

export type MapLayersBasemap<T extends string = string> = {
  value: T
  label: ReactNode
  /** A second line under the label, e.g. the source. */
  description?: ReactNode
}

export type MapLayersOverlay = {
  id: string
  label: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  description?: ReactNode
  disabled?: boolean
}

export type MapLayersControlProps<T extends string = string> = {
  /** The button's accessible name and tooltip (default "Layers"). */
  label?: string
  /** The basemaps to choose between, as a radio list. Omit for a control with overlays only. */
  basemaps?: ReadonlyArray<MapLayersBasemap<T>>
  basemap?: T
  onBasemapChange?: (value: T) => void
  /** Heading over the basemaps (default "Basemap"). */
  basemapTitle?: ReactNode
  /** Layers drawn over the basemap, as checkboxes. */
  overlays?: ReadonlyArray<MapLayersOverlay>
  /** Heading over the overlays (default "Overlays"). */
  overlaysTitle?: ReactNode
  /** Anything else the panel should hold, after the lists. */
  children?: ReactNode
  /**
   * Which edge the panel lines up with. Inside `MapControls` it follows the
   * stack's side; elsewhere it defaults to `end` (the panel grows to the left).
   */
  align?: 'start' | 'end'
  /** Start with the panel open (it still closes on a press outside or Escape). */
  defaultOpen?: boolean
  className?: string
}

/** How long the panel stays after the pointer leaves, so a diagonal move to it does not close it. */
const CLOSE_DELAY_MS = 180

/**
 * A layers button that opens a small panel on hover (or tap, or keyboard
 * focus) for choosing the basemap and switching overlays. Put it in
 * `MapControls` as a child to stack it under the zoom and compass buttons:
 *
 * ```tsx
 * <MapControls position="top-right" showZoom showCompass>
 *   <MapLayersControl basemaps={...} basemap={basemap} onBasemapChange={setBasemap} />
 * </MapControls>
 * ```
 *
 * The control only reports choices; the page applies them (a `styles` swap,
 * or a raster layer under the labels where a `setStyle` would drop layers).
 */
export function MapLayersControl<T extends string = string>({
  label = 'Layers',
  basemaps,
  basemap,
  onBasemapChange,
  basemapTitle = 'Basemap',
  overlays,
  overlaysTitle = 'Overlays',
  children,
  align,
  defaultOpen = false,
  className,
}: MapLayersControlProps<T>) {
  const side = useContext(MapControlsSideContext)
  const edge = align ?? (side === 'left' ? 'start' : 'end')
  const [open, setOpen] = useState(defaultOpen)
  // A click that follows the hover which opened the panel must not close it again.
  const openedByHoverAt = useRef(0)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const panelId = useId()
  const radioName = useId()

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }, [])
  useEffect(() => cancelClose, [cancelClose])

  // Close on a press outside, and on Escape (returning focus to the button).
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const hasBasemaps = !!basemaps?.length
  const hasOverlays = !!overlays?.length

  return (
    <div
      ref={rootRef}
      className={cn('relative', className)}
      data-map-layers-control=""
      data-state={open ? 'open' : 'closed'}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse') return
        cancelClose()
        if (!open) openedByHoverAt.current = Date.now()
        setOpen(true)
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse') return
        cancelClose()
        closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null) && event.relatedTarget) setOpen(false)
      }}
    >
      <div className="overflow-hidden rounded-md border border-border bg-background shadow-sm">
        <button
          ref={buttonRef}
          type="button"
          title={label}
          aria-label={label}
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => {
            if (open && Date.now() - openedByHoverAt.current < 400) return
            setOpen(!open)
          }}
          className={cn(
            'flex size-11 items-center justify-center transition-colors hover:bg-accent dark:hover:bg-accent/40 workspace-desktop:size-8',
            open && 'bg-accent dark:bg-accent/40',
          )}
        >
          <Layers className="size-4" />
        </button>
      </div>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={label}
          className={cn(
            'absolute top-0 w-max min-w-44 max-w-[min(18rem,calc(100vw-1.5rem))] rounded-md border border-border bg-background/95 p-3 text-xs shadow-md backdrop-blur',
            edge === 'end' ? 'right-0' : 'left-0',
          )}
        >
          <div className="max-h-[min(24rem,70vh)] space-y-3 overflow-y-auto overscroll-contain">
            {hasBasemaps && (
              <fieldset className="min-w-0 space-y-1">
                <legend className="mb-1 font-semibold uppercase tracking-wide text-foreground">{basemapTitle}</legend>
                {basemaps!.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded px-1 py-1 transition-colors hover:bg-accent hover:text-foreground workspace-desktop:py-0.5',
                      basemap === option.value ? 'text-foreground' : 'text-muted-foreground',
                    )}
                    data-basemap={option.value}
                  >
                    <input
                      type="radio"
                      name={radioName}
                      value={option.value}
                      checked={basemap === option.value}
                      onChange={() => onBasemapChange?.(option.value)}
                      className="mt-0.5 accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block">{option.label}</span>
                      {option.description && (
                        <span className="block text-2xs leading-4 text-muted-foreground">{option.description}</span>
                      )}
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            {hasOverlays && (
              <fieldset className="min-w-0 space-y-1">
                <legend className="mb-1 font-semibold uppercase tracking-wide text-foreground">{overlaysTitle}</legend>
                {overlays!.map((overlay) => (
                  <label
                    key={overlay.id}
                    className={cn(
                      'flex items-start gap-2 rounded px-1 py-1 transition-colors workspace-desktop:py-0.5',
                      overlay.checked ? 'text-foreground' : 'text-muted-foreground',
                      overlay.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-accent',
                    )}
                    data-overlay={overlay.id}
                  >
                    <input
                      type="checkbox"
                      checked={overlay.checked}
                      disabled={overlay.disabled}
                      onChange={(event) => overlay.onCheckedChange(event.target.checked)}
                      className="mt-0.5 accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block">{overlay.label}</span>
                      {overlay.description && (
                        <span className="block text-2xs leading-4 text-muted-foreground">{overlay.description}</span>
                      )}
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            {children}
          </div>
        </div>
      )}
    </div>
  )
}
