'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as MapLibreGL from 'maplibre-gl'
import { Minus, Plus, Locate, LocateFixed, Maximize, Loader2 } from 'lucide-react'

import { cn } from '../utils.js'
import { MAP_OVERLAY_Z } from '../ui/map-overlay.js'
import { useMap } from './map-context.js'
import { greatCircleMeters, scaleBarFor, type ScaleBar } from './map-scale.js'

type MapControlsProps = {
  /** Position of the controls on the map (default: "bottom-right") */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /** Optional mobile-only position. Desktop keeps `position`. */
  mobilePosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /** Show zoom in/out buttons (default: true) */
  showZoom?: boolean
  /** Show compass button to reset bearing (default: false) */
  showCompass?: boolean
  /** Show locate button to find user's location (default: false) */
  showLocate?: boolean
  /** Show fullscreen toggle button (default: false) */
  showFullscreen?: boolean
  /** Additional CSS classes for the controls container */
  className?: string
  /** Callback with user coordinates when located (on every position update while tracking) */
  onLocate?: (coords: { longitude: number; latitude: number }) => void
  /**
   * Make the locate button a toggle that keeps following the user's position
   * and marks it on the map, instead of flying there once (default: false).
   */
  trackLocation?: boolean
}

// Top corners clear a toolbar floating over the map on phones (the workspace
// publishes its height). Bottom corners stack above whatever holds the bottom
// edge: on the right the legend panel's footprint, then MapLibre's attribution
// on top of it (Map publishes the corners' heights); phones also clear the
// bottom sheet and the safe area.
const positionClasses = {
  'top-left': 'top-[calc(var(--map-mobile-toolbar-height,0px)_+_0.5rem)] left-2',
  'top-right': 'top-[calc(var(--map-mobile-toolbar-height,0px)_+_0.5rem)] right-2',
  'bottom-left':
    'bottom-[calc(var(--map-timeline-height,0px)_+_var(--map-bottom-left-controls-height,0px)_+_0.5rem)] left-2',
  'bottom-right':
    'bottom-[calc(var(--map-timeline-height,0px)_+_var(--map-legend-panel-visible-height,0px)_+_var(--map-bottom-right-controls-height,0px)_+_0.5rem)] right-2',
}

const desktopPositionClasses = {
  'top-left':
    'workspace-desktop:top-2 workspace-desktop:bottom-auto workspace-desktop:left-2 workspace-desktop:right-auto',
  'top-right':
    'workspace-desktop:top-2 workspace-desktop:bottom-auto workspace-desktop:right-2 workspace-desktop:left-auto',
  'bottom-left':
    'workspace-desktop:bottom-[calc(var(--map-timeline-height,0px)_+_var(--map-bottom-left-controls-height,0px)_+_0.5rem)] workspace-desktop:top-auto workspace-desktop:left-2 workspace-desktop:right-auto',
  'bottom-right':
    'workspace-desktop:bottom-[calc(var(--map-timeline-height,0px)_+_var(--map-legend-panel-visible-height,0px)_+_var(--map-bottom-right-controls-height,0px)_+_0.5rem)] workspace-desktop:top-auto workspace-desktop:right-2 workspace-desktop:left-auto',
}

// A phone's legend can span most of the map's width, so both bottom corners
// reserve its footprint there.
const mobilePanelAwarePositionClasses = {
  'bottom-left':
    'workspace-mobile:bottom-[calc(var(--map-mobile-sheet-visible-height,0px)_+_var(--map-safe-bottom-offset,0px)_+_var(--map-timeline-height,0px)_+_max(0.75rem,var(--map-legend-panel-visible-height,0px)_+_0.5rem,var(--map-bottom-left-controls-height,0px)_+_0.5rem))]',
  'bottom-right':
    'workspace-mobile:bottom-[calc(var(--map-mobile-sheet-visible-height,0px)_+_var(--map-safe-bottom-offset,0px)_+_var(--map-timeline-height,0px)_+_var(--map-legend-panel-visible-height,0px)_+_var(--map-bottom-right-controls-height,0px)_+_0.5rem)]',
}

function ControlGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-md border border-border bg-background shadow-sm overflow-hidden [&>button:not(:last-child)]:border-b [&>button:not(:last-child)]:border-border">
      {children}
    </div>
  )
}

function ControlButton({
  onClick,
  label,
  children,
  disabled = false,
  pressed,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
  disabled?: boolean
  pressed?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      type="button"
      className={cn(
        'flex size-11 items-center justify-center transition-colors hover:bg-accent dark:hover:bg-accent/40 workspace-desktop:size-8',
        disabled && 'opacity-50 pointer-events-none cursor-not-allowed',
      )}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function MapControls({
  position = 'bottom-right',
  mobilePosition,
  showZoom = true,
  showCompass = false,
  showLocate = false,
  showFullscreen = false,
  className,
  onLocate,
  trackLocation = false,
}: MapControlsProps) {
  const { map, isLoaded } = useMap()
  const [waitingForLocation, setWaitingForLocation] = useState(false)
  const [tracking, setTracking] = useState(false)
  const onLocateRef = useRef(onLocate)
  useEffect(() => {
    onLocateRef.current = onLocate
  })

  // Follow the position while tracking: fly on the first fix, then only move the dot.
  useEffect(() => {
    if (!tracking || !map || !('geolocation' in navigator)) return
    const dot = document.createElement('div')
    dot.setAttribute('aria-label', 'Your location')
    dot.style.cssText =
      'width:14px;height:14px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 0 0 4px rgba(37,99,235,0.25)'
    const marker = new MapLibreGL.Marker({ element: dot })
    let first = true
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { longitude: pos.coords.longitude, latitude: pos.coords.latitude }
        marker.setLngLat([coords.longitude, coords.latitude]).addTo(map)
        if (first) {
          first = false
          setWaitingForLocation(false)
          map.flyTo({ center: [coords.longitude, coords.latitude], zoom: Math.max(map.getZoom(), 14), duration: 1500 })
        }
        onLocateRef.current?.(coords)
      },
      () => {
        setWaitingForLocation(false)
        setTracking(false)
      },
      { enableHighAccuracy: true },
    )
    return () => {
      navigator.geolocation.clearWatch(watchId)
      marker.remove()
      setWaitingForLocation(false)
    }
  }, [map, tracking])

  const handleZoomIn = useCallback(() => {
    map?.zoomTo(map.getZoom() + 1, { duration: 300 })
  }, [map])

  const handleZoomOut = useCallback(() => {
    map?.zoomTo(map.getZoom() - 1, { duration: 300 })
  }, [map])

  const handleResetBearing = useCallback(() => {
    map?.resetNorthPitch({ duration: 300 })
  }, [map])

  const handleLocate = useCallback(() => {
    if (trackLocation) {
      setTracking(!tracking)
      setWaitingForLocation(!tracking)
      return
    }
    setWaitingForLocation(true)
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            longitude: pos.coords.longitude,
            latitude: pos.coords.latitude,
          }
          map?.flyTo({
            center: [coords.longitude, coords.latitude],
            zoom: 14,
            duration: 1500,
          })
          onLocate?.(coords)
          setWaitingForLocation(false)
        },
        () => {
          setWaitingForLocation(false)
        },
      )
    }
  }, [map, onLocate, trackLocation, tracking])

  const handleFullscreen = useCallback(() => {
    const container = map?.getContainer()
    if (!container) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      container.requestFullscreen()
    }
  }, [map])

  if (!isLoaded) return null

  return (
    <div
      className={cn(
        'absolute flex flex-col gap-1.5',
        MAP_OVERLAY_Z.controls,
        positionClasses[mobilePosition ?? position],
        mobilePosition ? desktopPositionClasses[position] : null,
        (mobilePosition ?? position) in mobilePanelAwarePositionClasses
          ? mobilePanelAwarePositionClasses[
              (mobilePosition ?? position) as keyof typeof mobilePanelAwarePositionClasses
            ]
          : null,
        className,
      )}
    >
      {showZoom && (
        <ControlGroup>
          <ControlButton onClick={handleZoomIn} label="Zoom in">
            <Plus className="size-4" />
          </ControlButton>
          <ControlButton onClick={handleZoomOut} label="Zoom out">
            <Minus className="size-4" />
          </ControlButton>
        </ControlGroup>
      )}
      {showCompass && (
        <ControlGroup>
          <CompassButton onClick={handleResetBearing} />
        </ControlGroup>
      )}
      {showLocate && (
        <ControlGroup>
          <ControlButton
            onClick={handleLocate}
            label={
              trackLocation ? (tracking ? 'Stop following my location' : 'Follow my location') : 'Find my location'
            }
            disabled={waitingForLocation && !trackLocation}
            pressed={trackLocation ? tracking : undefined}
          >
            {waitingForLocation ? (
              <Loader2 className="size-4 animate-spin" />
            ) : tracking ? (
              <LocateFixed className="size-4 text-sky-500" />
            ) : (
              <Locate className="size-4" />
            )}
          </ControlButton>
        </ControlGroup>
      )}
      {showFullscreen && (
        <ControlGroup>
          <ControlButton onClick={handleFullscreen} label="Toggle fullscreen">
            <Maximize className="size-4" />
          </ControlButton>
        </ControlGroup>
      )}
    </div>
  )
}

function CompassButton({ onClick }: { onClick: () => void }) {
  const { isLoaded, map } = useMap()
  const compassRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!isLoaded || !map || !compassRef.current) return

    const compass = compassRef.current

    const updateRotation = () => {
      const bearing = map.getBearing()
      const pitch = map.getPitch()
      compass.style.transform = `rotateX(${pitch}deg) rotateZ(${-bearing}deg)`
    }

    map.on('rotate', updateRotation)
    map.on('pitch', updateRotation)
    updateRotation()

    return () => {
      map.off('rotate', updateRotation)
      map.off('pitch', updateRotation)
    }
  }, [isLoaded, map])

  return (
    <ControlButton onClick={onClick} label="Reset bearing to north">
      <svg
        ref={compassRef}
        viewBox="0 0 24 24"
        className="size-5 transition-transform duration-200 workspace-desktop:size-4"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <path d="M12 2L16 12H12V2Z" className="fill-red-500" />
        <path d="M12 2L8 12H12V2Z" className="fill-red-300" />
        <path d="M12 22L16 12H12V22Z" className="fill-muted-foreground/60" />
        <path d="M12 22L8 12H12V22Z" className="fill-muted-foreground/30" />
      </svg>
    </ControlButton>
  )
}

/**
 * The control set the PG map sections settled on: zoom and compass in the top
 * right, on phones too (below the floating toolbar), so the bottom corner
 * belongs to the legend and the attribution. `Map` and `SharedMap`
 * render this when their `controls` prop is omitted, so a section only spells
 * controls out when it wants something else.
 */
export const DEFAULT_MAP_CONTROLS = <MapControls position="top-right" showZoom showCompass />

/** The default set plus fullscreen, for a tool whose map is the main work surface. */
export const WORKSPACE_MAP_CONTROLS = <MapControls position="top-right" showZoom showCompass showFullscreen />

type MapScaleBarProps = {
  /** Corner to sit in; bottom corners clear the phone sheet like the controls do. */
  position?: 'bottom-left' | 'bottom-right'
  /** Longest the bar may be, in pixels (default 100). */
  maxWidth?: number
  /** Hide when the map is pitched past this, where one scale no longer holds (default 60°). */
  hideAbovePitch?: number
  className?: string
}

/**
 * A metric scale bar measured across the map's vertical middle, great-circle,
 * as MapLibre's own control is, but drawn in the app's theme. Hidden on a
 * steeply pitched map (an eye-level view), where the scale runs from
 * centimetres at the bottom to kilometres at the horizon.
 */
function MapScaleBar({ position = 'bottom-left', maxWidth = 100, hideAbovePitch = 60, className }: MapScaleBarProps) {
  const { map, isLoaded } = useMap()
  const [bar, setBar] = useState<ScaleBar | null>(null)

  useEffect(() => {
    if (!isLoaded || !map) return
    const update = () => {
      if (map.getPitch() > hideAbovePitch) {
        setBar(null)
        return
      }
      const y = map.getContainer().clientHeight / 2
      const left = map.unproject([0, y])
      const right = map.unproject([maxWidth, y])
      setBar(scaleBarFor(greatCircleMeters(left, right) / maxWidth, maxWidth))
    }
    update()
    map.on('move', update)
    map.on('resize', update)
    return () => {
      map.off('move', update)
      map.off('resize', update)
    }
  }, [isLoaded, map, maxWidth, hideAbovePitch])

  if (!bar) return null
  return (
    <div
      className={cn(
        'pointer-events-none absolute rounded bg-background/80 px-1.5 pb-1 pt-0.5 text-[10px] leading-3 text-foreground shadow-sm',
        MAP_OVERLAY_Z.controls,
        positionClasses[position],
        mobilePanelAwarePositionClasses[position],
        className,
      )}
      role="img"
      aria-label={`Scale: ${bar.label}`}
      data-map-scale={bar.meters}
    >
      <span className="block tabular-nums">{bar.label}</span>
      <span
        className="mt-0.5 block h-1.5 border-x-2 border-b-2 border-foreground"
        style={{ width: `${bar.pixels}px` }}
      />
    </div>
  )
}

export { MapControls, MapScaleBar }
