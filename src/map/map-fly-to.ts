import { useEffect, useRef } from 'react'
import { useMap } from './map-context.js'
import { useWorkspace, useWorkspaceInteractions } from '../workspace/workspace-context.js'
import { VISIBLE_MAP_PANELS_CHANGE, workspaceMapPanels } from '../workspace/visible-map-panels.js'
import { MOBILE_MAP_INTERACTION_EVENT } from '../workspace/workspace-events.js'
import { MOTION_DURATION, useReducedMotion } from '../ui/motion.js'
import { cameraOffset, visibleMapInsets, type CameraInsets, type ScreenRect } from './camera-framing.js'

export interface FlyToTarget {
  longitude: number
  latitude: number
}

export interface UseFlyToSelectionOptions {
  /** Zoom to settle at. Omit to keep the current zoom. */
  zoom?: number
  /** Animation length in ms. Defaults to the shared 350 ms camera timing. */
  duration?: number
  /** Use a short local ease instead of a flight for table/nearby selections. */
  mode?: 'fly' | 'ease'
  /** Extra space inside the visible map area; never persists as map padding. */
  padding?: number | Partial<CameraInsets>
  /** Keep the selection clear of workspace sheets until the user moves the map. */
  keepVisible?: boolean
  /**
   * Change to re-fly to the same target — for "show me this again" affordances
   * where the selection itself has not changed.
   */
  focusKey?: unknown
}

/**
 * Recentre the map whenever a selected feature changes. Pass null to leave the
 * camera alone.
 *
 * Only covers the fly-to-a-point case. Selections that frame an extent
 * (parks, trails) call fitBounds with their own padding and maxZoom, which
 * varies enough per section that sharing it would just move the arguments.
 */
export function useFlyToSelection(
  target: FlyToTarget | null | undefined,
  {
    zoom,
    duration = MOTION_DURATION.camera,
    focusKey,
    mode = 'fly',
    padding,
    keepVisible = true,
  }: UseFlyToSelectionOptions = {},
): void {
  const { map, isLoaded } = useMap()
  const workspace = useWorkspace()
  const interactions = useWorkspaceInteractions()
  const reducedMotion = useReducedMotion()
  const intent = useRef<{
    map: typeof map
    longitude: number
    latitude: number
    focusKey: unknown
    following: boolean
  } | null>(null)
  const longitude = target?.longitude
  const latitude = target?.latitude
  const top = typeof padding === 'number' ? padding : (padding?.top ?? 0)
  const right = typeof padding === 'number' ? padding : (padding?.right ?? 0)
  const bottom = typeof padding === 'number' ? padding : (padding?.bottom ?? 0)
  const left = typeof padding === 'number' ? padding : (padding?.left ?? 0)

  useEffect(() => {
    if (!map || longitude == null || latitude == null) {
      intent.current = null
      return
    }
    if (!isLoaded) return
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return
    const container = map.getContainer()
    const root = workspace?.root ?? container.closest<HTMLElement>('[data-map-layout-root="true"]') ?? container
    if (
      !intent.current ||
      intent.current.map !== map ||
      intent.current.longitude !== longitude ||
      intent.current.latitude !== latitude ||
      !Object.is(intent.current.focusKey, focusKey)
    ) {
      intent.current = { map, longitude, latitude, focusKey, following: true }
    }
    const currentIntent = intent.current
    let following = currentIntent.following
    let initial = true
    let frame = 0
    let resizeTimer: ReturnType<typeof setTimeout> | undefined
    let manipulatingPanel = false
    let lastGeometry = ''
    const observed = new Set<HTMLElement>()

    const getPanels = () => {
      const ownerRoot = root.matches('.geo-toolkit') ? root : root.closest('.geo-toolkit')
      const local = Array.from(
        root.querySelectorAll<HTMLElement>(
          '[data-map-mobile-sheet="true"], [data-map-feature-card-panel="true"], [data-map-right-sidebar="true"]',
        ),
      ).filter((panel) => !ownerRoot || panel.closest('.geo-toolkit') === ownerRoot)
      // A shared bus also finds sibling/portal cards without a document-wide
      // query or crossing the boundary of an independent embedded workspace.
      return Array.from(new Set([...local, ...workspaceMapPanels(interactions)]))
    }

    const reframe = () => {
      frame = 0
      if (!following) return
      const bounds = container.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      const panels: ScreenRect[] = []
      if (keepVisible)
        for (const panel of getPanels()) {
          if (!panel.getClientRects().length || getComputedStyle(panel).display === 'none') continue
          if (
            panel.closest(
              '[data-map-sidebar-wrapper="true"][aria-hidden="true"], [data-map-right-sidebar="true"][aria-hidden="true"]',
            )
          )
            continue
          if (panel.dataset.featureCardState === 'closing') continue
          const rect = panel.getBoundingClientRect()
          const targetHeight = Number(panel.dataset.mapTargetVisibleHeight)
          panels.push(
            Number.isFinite(targetHeight) && panel.dataset.mapTargetVisibleHeight !== undefined
              ? {
                  left: rect.left,
                  right: rect.right,
                  top: bounds.bottom - Math.max(0, targetHeight),
                  bottom: bounds.bottom,
                }
              : rect,
          )
        }
      const insets = visibleMapInsets(bounds, panels)
      insets.top += Math.max(0, top)
      insets.right += Math.max(0, right)
      insets.bottom += Math.max(0, bottom)
      insets.left += Math.max(0, left)
      const offset = cameraOffset(insets)
      const geometry = `${Math.round(bounds.width)},${Math.round(bounds.height)},${offset.map(Math.round).join(',')}`
      if (!initial && geometry === lastGeometry) return
      lastGeometry = geometry
      const options = {
        center: [longitude, latitude] as [number, number],
        ...(zoom === undefined ? {} : { zoom }),
        offset,
        duration: reducedMotion ? 0 : duration,
        easing: (t: number) => 1 - (1 - t) ** 3,
      }
      // Native camera offset respects the actual map pane and does not leak
      // persistent padding into a later unrelated navigation action.
      if (initial && mode === 'fly') map.flyTo(options)
      else map.easeTo(options)
      initial = false
    }
    const schedule = () => {
      if (!following || manipulatingPanel || frame) return
      frame = requestAnimationFrame(reframe)
    }
    const panelObserver = new MutationObserver(schedule)
    const resizeObserver = new ResizeObserver(() => {
      // Layout may resize for every frame of a desktop pane transition. Keep
      // one camera correction for its settled size instead of restarting it.
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(schedule, 60)
    })
    resizeObserver.observe(container)
    const discover = () => {
      const panels = new Set(getPanels())
      for (const panel of observed)
        if (!panels.has(panel)) {
          observed.delete(panel)
          resizeObserver.unobserve(panel)
          panel.removeEventListener('pointerdown', onPanelDown, true)
        }
      panelObserver.disconnect()
      for (const panel of panels) {
        if (!observed.has(panel)) {
          observed.add(panel)
          resizeObserver.observe(panel)
          panel.addEventListener('pointerdown', onPanelDown, true)
        }
        // Target changes are discrete intents, unlike animated style updates.
        panelObserver.observe(panel, {
          attributes: true,
          attributeFilter: ['data-map-target-visible-height', 'data-feature-card-state', 'aria-hidden'],
        })
      }
      schedule()
    }
    const childrenObserver = new MutationObserver(discover)
    childrenObserver.observe(root, { childList: true, subtree: true })
    interactions.addEventListener(VISIBLE_MAP_PANELS_CHANGE, discover)
    const onGesture = (event: { originalEvent?: Event }) => {
      if (!event.originalEvent) return
      following = false
      currentIntent.following = false
      cancelAnimationFrame(frame)
      frame = 0
    }
    const onWorkspaceGesture = (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.type === 'gesture') {
        following = false
        currentIntent.following = false
        cancelAnimationFrame(frame)
        clearTimeout(resizeTimer)
        frame = 0
      }
    }
    const onPanelDown = (event: PointerEvent) => {
      manipulatingPanel =
        event.target instanceof Element &&
        Boolean(event.target.closest('[data-map-mobile-sheet="true"], [data-map-feature-card-panel="true"]'))
    }
    const onPanelUp = () => {
      if (!manipulatingPanel) return
      manipulatingPanel = false
      schedule()
    }
    root.addEventListener('pointerdown', onPanelDown, true)
    window.addEventListener('pointerup', onPanelUp)
    window.addEventListener('pointercancel', onPanelUp)
    interactions.addEventListener(MOBILE_MAP_INTERACTION_EVENT, onWorkspaceGesture)
    map.on('movestart', onGesture)
    map.on('dragstart', onGesture)
    map.on('zoomstart', onGesture)
    discover()
    return () => {
      following = false
      cancelAnimationFrame(frame)
      clearTimeout(resizeTimer)
      resizeObserver.disconnect()
      panelObserver.disconnect()
      childrenObserver.disconnect()
      interactions.removeEventListener(VISIBLE_MAP_PANELS_CHANGE, discover)
      interactions.removeEventListener(MOBILE_MAP_INTERACTION_EVENT, onWorkspaceGesture)
      for (const panel of observed) panel.removeEventListener('pointerdown', onPanelDown, true)
      root.removeEventListener('pointerdown', onPanelDown, true)
      window.removeEventListener('pointerup', onPanelUp)
      window.removeEventListener('pointercancel', onPanelUp)
      map.off('movestart', onGesture)
      map.off('dragstart', onGesture)
      map.off('zoomstart', onGesture)
    }
  }, [
    map,
    isLoaded,
    longitude,
    latitude,
    zoom,
    duration,
    focusKey,
    mode,
    keepVisible,
    top,
    right,
    bottom,
    left,
    reducedMotion,
    workspace?.root,
    interactions,
  ])
}
