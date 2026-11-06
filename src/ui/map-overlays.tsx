import type { CSSProperties, ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '../utils.js'
import { MAP_OVERLAY_ROOT_STYLE, MAP_OVERLAY_Z } from './map-overlay.js'

type MapOverlayRootProps = ComponentPropsWithoutRef<'div'> & {
  initializeVariables?: boolean
}

export function MapOverlayRoot({ className, style, initializeVariables = true, ...props }: MapOverlayRootProps) {
  return (
    <div
      data-map-layout-root="true"
      className={cn('relative h-full w-full', className)}
      style={{ ...(initializeVariables ? MAP_OVERLAY_ROOT_STYLE : null), ...style } as CSSProperties}
      {...props}
    />
  )
}

type FloatingPanelPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

// Bottom panels stack above whatever holds the bottom edge: MapLibre's own
// corner box (the attribution) and, on the right, the legend panel it sits on.
// Phones also clear the sheet, and reserve a wide legend's height on the left.
const floatingPanelPositionClasses: Record<FloatingPanelPosition, string> = {
  'top-left': 'left-3 top-3',
  'top-right': 'right-3 top-3',
  'bottom-left':
    'left-3 bottom-[calc(var(--map-mobile-sheet-visible-height,0px)_+_var(--map-safe-bottom-offset,0px)_+_var(--map-timeline-height,0px)_+_max(0.75rem,var(--map-legend-stack-height,0px)_+_0.5rem,var(--map-bottom-left-controls-height,0px)_+_0.5rem))] workspace-desktop:bottom-[calc(var(--map-timeline-height,0px)_+_max(0.75rem,var(--map-bottom-left-controls-height,0px)_+_0.5rem))]',
  'bottom-right':
    'right-3 bottom-[calc(var(--map-mobile-sheet-visible-height,0px)_+_var(--map-safe-bottom-offset,0px)_+_var(--map-timeline-height,0px)_+_max(0.75rem,var(--map-legend-panel-visible-height,0px)_+_var(--map-bottom-right-controls-height,0px)_+_0.5rem))] workspace-desktop:bottom-[calc(var(--map-timeline-height,0px)_+_max(0.75rem,var(--map-legend-panel-visible-height,0px)_+_var(--map-bottom-right-controls-height,0px)_+_0.5rem))]',
}

const floatingPanelNoLegendPositionClasses = {
  'bottom-left':
    'left-3 bottom-[calc(var(--map-mobile-sheet-visible-height,0px)_+_var(--map-safe-bottom-offset,0px)_+_var(--map-timeline-height,0px)_+_max(0.75rem,var(--map-bottom-left-controls-height,0px)_+_0.5rem))] workspace-desktop:bottom-[calc(var(--map-timeline-height,0px)_+_max(0.75rem,var(--map-bottom-left-controls-height,0px)_+_0.5rem))]',
  'bottom-right':
    'right-3 bottom-[calc(var(--map-mobile-sheet-visible-height,0px)_+_var(--map-safe-bottom-offset,0px)_+_var(--map-timeline-height,0px)_+_max(0.75rem,var(--map-bottom-right-controls-height,0px)_+_0.5rem))] workspace-desktop:bottom-[calc(var(--map-timeline-height,0px)_+_max(0.75rem,var(--map-bottom-right-controls-height,0px)_+_0.5rem))]',
} as const

type MapFloatingPanelProps = ComponentPropsWithoutRef<'div'> & {
  position?: FloatingPanelPosition
  z?: keyof typeof MAP_OVERLAY_Z
  reserveLegendSpace?: boolean
  children: ReactNode
}

export function MapFloatingPanel({
  position = 'bottom-left',
  z = 'controls',
  reserveLegendSpace = true,
  className,
  children,
  ...props
}: MapFloatingPanelProps) {
  const positionClass =
    !reserveLegendSpace && (position === 'bottom-left' || position === 'bottom-right')
      ? floatingPanelNoLegendPositionClasses[position]
      : floatingPanelPositionClasses[position]

  return (
    <div className={cn('absolute', MAP_OVERLAY_Z[z], positionClass, className)} {...props}>
      {children}
    </div>
  )
}
