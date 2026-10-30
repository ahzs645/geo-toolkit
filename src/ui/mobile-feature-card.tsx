import { ChevronDown, X } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '../utils.js'
import { MAP_OVERLAY_Z } from './map-overlay.js'
import { MOBILE_CARD_STACK_PEEK, useMobileCardStack } from './mobile-card-stack.js'
import { MOBILE_MEDIA_QUERY, useIsMobile } from '../workspace/useIsMobile.js'
import type { MobileSheetState } from '../workspace/sheet-math.js'
import { featureCardHeights, stepFeatureCard } from './feature-card-math.js'
import { useFeatureCardGestures } from './useFeatureCardGestures.js'
import { MOTION_DURATION, MOTION_EASING, useMotionPresence, useReducedMotion } from './motion.js'

export const MOBILE_FEATURE_CARD_MEDIA_QUERY = MOBILE_MEDIA_QUERY
export const MOBILE_FEATURE_CARD_HEIGHT = 720
export const MOBILE_FEATURE_CARD_COMPACT_HEIGHT = 300
export const MOBILE_FEATURE_CARD_COLLAPSED_HEIGHT = 92
export * from '../workspace/workspace-events.js'
import {
  MOBILE_MAP_INTERACTION_EVENT,
  MOBILE_MAP_BLANK_CLICK_EVENT,
  MOBILE_MAP_SHEET_COLLAPSE_EVENT,
  MOBILE_MAP_SHEET_STACK_EVENT,
  MOBILE_MAP_CONTROLS_FRONT_EVENT,
  MOBILE_MAP_CONTROLS_VISIBLE_HEIGHT_EVENT,
  MOBILE_FEATURE_CARD_DOCK_EVENT,
  MOBILE_FEATURE_CARD_FRONT_EVENT,
  MOBILE_FEATURE_CARD_PEEK_EVENT,
  MOBILE_FEATURE_CARD_OPEN_EVENT,
  MOBILE_FEATURE_CARD_CLOSE_EVENT,
  MOBILE_FEATURE_CARD_COLLAPSE_STATE_EVENT,
} from '../workspace/workspace-events.js'
import { useWorkspace, useWorkspaceInteractions } from '../workspace/workspace-context.js'
import { useVisibleMapPanel } from '../workspace/visible-map-panels.js'

/**
 * Picks between a map popup and a mobile bottom-sheet card for the same
 * selected feature — the fork every section used to write inline as a pair of
 * `{!isMobile && <MapPopup>}` / `{isMobile && <Card>}` blocks.
 *
 * Both slots are plain nodes, so only the chosen one is mounted. Pass just
 * `card` for sections whose desktop detail lives in the sidebar instead.
 */
export function ResponsiveFeatureDetail({ popup, card }: { popup?: ReactNode; card?: ReactNode }) {
  const isMobile = useIsMobile()
  return <>{isMobile ? card : popup}</>
}

export function MobileFeatureCard({
  title,
  subtitle,
  children,
  className,
  cardKey,
  contentClassName,
  height = MOBILE_FEATURE_CARD_HEIGHT,
  initialVisibleHeight = MOBILE_FEATURE_CARD_COMPACT_HEIGHT,
  collapseOnMapInteraction = true,
  closeOnBlankMapClick = true,
  showDockAction = true,
  stackId = 'feature',
  onClose,
}: {
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  className?: string
  cardKey?: string | number
  contentClassName?: string
  height?: number
  initialVisibleHeight?: number
  collapseOnMapInteraction?: boolean
  closeOnBlankMapClick?: boolean
  showDockAction?: boolean
  /**
   * Identity in the mobile card stack. Cards with different ids stack instead of
   * colliding — e.g. the data table (`table`) behind a focused feature.
   */
  stackId?: string
  onClose: () => void
}) {
  const interactions = useWorkspaceInteractions()
  const workspace = useWorkspace()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [expanded, setExpanded] = useState(initialVisibleHeight >= height)
  const [controlsInFront, setControlsInFront] = useState(false)
  const [controlsVisibleHeight, setControlsVisibleHeight] = useState<number | null>(null)
  const [hasDockTarget, setHasDockTarget] = useState(false)
  const dragMovedRef = useRef(false)
  const lastGestureAtRef = useRef(0)
  const frameRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const returnFocusRef = useRef(false)
  const closingRef = useRef(false)
  const heightFrameRef = useRef(0)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const reducedMotion = useReducedMotion()
  const presence = useMotionPresence(open, MOTION_DURATION.panel + 50)
  useVisibleMapPanel(panelRef, presence.present)
  const [frameHeight, setFrameHeight] = useState(height)
  const heights = useMemo(
    () => featureCardHeights(frameHeight, initialVisibleHeight, MOBILE_FEATURE_CARD_COLLAPSED_HEIGHT),
    [frameHeight, initialVisibleHeight],
  )
  const detent: MobileSheetState = collapsed ? 'collapsed' : expanded ? 'full' : 'half'
  const transition = reducedMotion
    ? 'none'
    : `height ${MOTION_DURATION.panel}ms ${MOTION_EASING}, transform ${MOTION_DURATION.panel}ms ${MOTION_EASING}, opacity ${MOTION_DURATION.feedback}ms ${MOTION_EASING}`

  useLayoutEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const { depth, isFront, hasCardsBehind, frontVisibleHeight, bringToFront, reportVisibleHeight } = useMobileCardStack(
    stackId,
    presence.present,
  )
  /** Behind another *card* (not the controls sheet), so it peeks above it instead. */
  const stackedBehind = !isFront && !controlsInFront
  /** Front card of a stack sits flush, so only the thin edge of the card behind shows. */
  const coversStack = isFront && hasCardsBehind && !controlsInFront

  const titleText = typeof title === 'string' ? title : undefined
  const subtitleText = typeof subtitle === 'string' ? subtitle : undefined
  const canDockBehindControls = showDockAction && hasDockTarget && isFront

  useEffect(() => {
    const syncDockTarget = () => {
      const sheet = workspace?.root?.querySelector<HTMLElement>('[data-map-mobile-sheet="true"]')
      const wrapper = sheet?.closest<HTMLElement>('[data-map-sidebar-wrapper="true"]')
      const target = wrapper ?? sheet
      if (!target) {
        setHasDockTarget(false)
        return
      }
      setHasDockTarget(window.getComputedStyle(target).display !== 'none')
    }

    syncDockTarget()
    window.addEventListener('resize', syncDockTarget)
    return () => window.removeEventListener('resize', syncDockTarget)
  }, [workspace?.root])

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    interactions.dispatchEvent(new CustomEvent(MOBILE_FEATURE_CARD_OPEN_EVENT))
    return () => {
      interactions.dispatchEvent(new CustomEvent(MOBILE_FEATURE_CARD_CLOSE_EVENT))
    }
  }, [interactions])

  // A newer selection reverses an in-flight exit before it can clear that selection.
  useLayoutEffect(() => {
    closingRef.current = false
    returnFocusRef.current = false
    const focused = document.activeElement
    if (focused instanceof HTMLElement && focused !== document.body && !panelRef.current?.contains(focused))
      openerRef.current = focused
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Replace an exiting selection before it can paint or call its stale close callback.
    setCollapsed(false)
    setExpanded(initialVisibleHeight >= height)
    setOpen(true)
    interactions.dispatchEvent(new CustomEvent(MOBILE_MAP_SHEET_STACK_EVENT))
    interactions.dispatchEvent(
      new CustomEvent(MOBILE_FEATURE_CARD_PEEK_EVENT, {
        detail: { title: titleText, subtitle: subtitleText },
      }),
    )
  }, [cardKey, height, initialVisibleHeight, interactions, subtitleText, titleText])

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const measure = () => setFrameHeight(frame.clientHeight || height)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [height, presence.present])

  useEffect(() => {
    const sendBehind = () => {
      setCollapsed(false)
      setExpanded(false)
      setControlsInFront(true)
    }
    const bringFront = () => {
      setControlsInFront(false)
      setControlsVisibleHeight(null)
      interactions.dispatchEvent(new CustomEvent(MOBILE_MAP_SHEET_STACK_EVENT))
    }
    const syncControlsHeight = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const visibleHeight = event.detail?.visibleHeight
      if (typeof visibleHeight === 'number') {
        setControlsVisibleHeight(visibleHeight)
      }
    }
    interactions.addEventListener(MOBILE_MAP_CONTROLS_FRONT_EVENT, sendBehind)
    interactions.addEventListener(MOBILE_MAP_CONTROLS_VISIBLE_HEIGHT_EVENT, syncControlsHeight)
    interactions.addEventListener(MOBILE_FEATURE_CARD_FRONT_EVENT, bringFront)
    return () => {
      interactions.removeEventListener(MOBILE_MAP_CONTROLS_FRONT_EVENT, sendBehind)
      interactions.removeEventListener(MOBILE_MAP_CONTROLS_VISIBLE_HEIGHT_EVENT, syncControlsHeight)
      interactions.removeEventListener(MOBILE_FEATURE_CARD_FRONT_EVENT, bringFront)
    }
  }, [interactions])

  useEffect(() => {
    if (!collapseOnMapInteraction) return

    const collapse = (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.type === 'gesture') {
        lastGestureAtRef.current = Date.now()
        interactions.dispatchEvent(new CustomEvent(MOBILE_MAP_SHEET_COLLAPSE_EVENT))
      }
      setCollapsed(true)
    }
    interactions.addEventListener(MOBILE_MAP_INTERACTION_EVENT, collapse)
    return () => interactions.removeEventListener(MOBILE_MAP_INTERACTION_EVENT, collapse)
  }, [collapseOnMapInteraction, interactions])

  const publishVisibleHeight = useCallback(
    (visibleHeight: number, direct = false) => {
      reportVisibleHeight(visibleHeight)
      if (!isFront || controlsInFront) return
      interactions.dispatchEvent(
        new CustomEvent(MOBILE_FEATURE_CARD_COLLAPSE_STATE_EVENT, {
          detail: { collapsed: visibleHeight <= heights.collapsed + 1, visibleHeight, direct },
        }),
      )
    },
    [controlsInFront, heights.collapsed, interactions, isFront, reportVisibleHeight],
  )

  const trackRenderedHeight = useCallback(() => {
    cancelAnimationFrame(heightFrameRef.current)
    const started = performance.now()
    const report = () => {
      const panel = panelRef.current
      if (!panel || closingRef.current) return
      publishVisibleHeight(panel.getBoundingClientRect().height, true)
      if (!reducedMotion && performance.now() - started < MOTION_DURATION.panel + 32) {
        heightFrameRef.current = requestAnimationFrame(report)
      }
    }
    heightFrameRef.current = requestAnimationFrame(report)
  }, [publishVisibleHeight, reducedMotion])

  useEffect(() => () => cancelAnimationFrame(heightFrameRef.current), [])

  const applyCardHeight = useCallback(
    (visibleHeight: number, animate: boolean) => {
      const panel = panelRef.current
      if (!panel) return
      cancelAnimationFrame(heightFrameRef.current)
      const boundedHeight = Math.max(heights.collapsed, Math.min(heights.full, visibleHeight))
      panel.dataset.mapTargetVisibleHeight = String(boundedHeight)
      panel.style.transition = animate ? transition : 'none'
      panel.style.height = `${boundedHeight}px`
      publishVisibleHeight(boundedHeight, !animate)
      if (animate) trackRenderedHeight()
    },
    [heights, publishVisibleHeight, trackRenderedHeight, transition],
  )

  const snapCard = useCallback(
    (state: MobileSheetState) => {
      setCollapsed(state === 'collapsed')
      setExpanded(state === 'full')
      applyCardHeight(heights[state], true)
      if (panelRef.current)
        panelRef.current.style.transform = `translateY(${state === 'collapsed' || coversStack ? 0 : 8}px)`
    },
    [applyCardHeight, coversStack, heights],
  )

  const bringCardForward = useCallback(() => {
    if (stackedBehind) bringToFront()
  }, [bringToFront, stackedBehind])

  const { cancelGesture, ...gestureHandlers } = useFeatureCardGestures({
    panelRef,
    heights,
    disabled: !open || controlsInFront,
    movedRef: dragMovedRef,
    onBringToFront: bringCardForward,
    onHeightChange: applyCardHeight,
    onSnap: snapCard,
  })

  const finishClose = useCallback(() => {
    if (!closingRef.current) return
    closingRef.current = false
    if (returnFocusRef.current) {
      const target =
        openerRef.current?.isConnected && !openerRef.current.closest('[inert]')
          ? openerRef.current
          : workspace?.root?.querySelector<HTMLElement>('[data-map-mobile-sheet-handle="true"]')
      target?.focus({ preventScroll: true })
    }
    onCloseRef.current()
  }, [workspace?.root])

  const closeWithAnimation = useCallback(() => {
    if (closingRef.current) return
    returnFocusRef.current = !!panelRef.current?.contains(document.activeElement)
    closingRef.current = true
    cancelGesture()
    cancelAnimationFrame(heightFrameRef.current)
    if (panelRef.current) panelRef.current.dataset.mapTargetVisibleHeight = '0'
    setOpen(false)
    interactions.dispatchEvent(new CustomEvent(MOBILE_MAP_SHEET_COLLAPSE_EVENT))
  }, [cancelGesture, interactions])

  useEffect(() => {
    // Presence also completes when the browser does not emit transitionend.
    if (!open && !presence.present) finishClose()
  }, [finishClose, open, presence.present])

  useEffect(() => {
    if (!closeOnBlankMapClick) return
    const closeOnBlankClick = () => {
      if (Date.now() - lastGestureAtRef.current < 450) return
      closeWithAnimation()
    }
    interactions.addEventListener(MOBILE_MAP_BLANK_CLICK_EVENT, closeOnBlankClick)
    return () => interactions.removeEventListener(MOBILE_MAP_BLANK_CLICK_EVENT, closeOnBlankClick)
  }, [closeOnBlankMapClick, closeWithAnimation, interactions])

  const dockBehindControls = useCallback(() => {
    if (!canDockBehindControls) return
    setCollapsed(false)
    setExpanded(false)
    setControlsVisibleHeight(null)
    interactions.dispatchEvent(new CustomEvent(MOBILE_FEATURE_CARD_DOCK_EVENT))
  }, [canDockBehindControls, interactions])

  const handleDockClick = useCallback(() => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }
    dockBehindControls()
  }, [dockBehindControls])

  const handleHandleClick = useCallback(() => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }
    // Tapping the exposed top edge of a card behind brings it forward, so the
    // stack can be flipped through without closing anything.
    if (stackedBehind) {
      bringToFront()
      return
    }
    snapCard(collapsed ? 'half' : expanded ? 'half' : 'full')
  }, [bringToFront, collapsed, expanded, snapCard, stackedBehind])

  // A card sent behind another one un-collapses so it can match the front card's
  // height and peek above it, rather than hiding beneath a taller card.
  const effectiveCollapsed = collapsed && !stackedBehind
  const visibleCardHeight = effectiveCollapsed
    ? MOBILE_FEATURE_CARD_COLLAPSED_HEIGHT
    : controlsInFront && controlsVisibleHeight != null
      ? Math.max(MOBILE_FEATURE_CARD_COLLAPSED_HEIGHT, Math.min(height, controlsVisibleHeight))
      : stackedBehind && frontVisibleHeight != null
        ? Math.max(MOBILE_FEATURE_CARD_COLLAPSED_HEIGHT, Math.min(height, frontVisibleHeight))
        : expanded
          ? height
          : initialVisibleHeight

  const boundedVisibleHeight = Math.min(frameHeight, visibleCardHeight)
  const stackOffset = stackedBehind ? MOBILE_CARD_STACK_PEEK * depth : 0
  const bodyHidden = !open || effectiveCollapsed || stackedBehind || controlsInFront

  useLayoutEffect(() => {
    const body = bodyRef.current
    const panel = panelRef.current
    if (!body || !panel) return
    if (bodyHidden && body.contains(document.activeElement)) {
      const target = controlsInFront
        ? workspace?.root?.querySelector<HTMLElement>('[data-map-mobile-sheet-handle="true"]')
        : handleRef.current
      target?.focus({ preventScroll: true })
    }
    body.inert = bodyHidden
    panel.inert = !open || controlsInFront
    if (actionsRef.current) actionsRef.current.inert = stackedBehind
  }, [bodyHidden, controlsInFront, open, presence.present, stackedBehind, workspace?.root])

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!open || !panel || panel.dataset.featureCardDragging === 'true') return
    panel.dataset.mapTargetVisibleHeight = String(boundedVisibleHeight)
    if (controlsInFront || stackedBehind) reportVisibleHeight(boundedVisibleHeight)
    else {
      publishVisibleHeight(boundedVisibleHeight)
      trackRenderedHeight()
    }
  }, [
    boundedVisibleHeight,
    controlsInFront,
    open,
    presence.present,
    publishVisibleHeight,
    reportVisibleHeight,
    stackedBehind,
    trackRenderedHeight,
  ])

  if (!presence.present) return null

  return (
    <div
      className={cn(
        cn(
          'pointer-events-none inset-0 workspace-desktop:hidden',
          workspace?.placement === 'container' ? 'absolute' : 'fixed',
        ),
        controlsInFront && MAP_OVERLAY_Z.passiveOverlay,
      )}
      // Front card sits at the active overlay level; each card behind drops one
      // step so they layer instead of colliding at the same z-index.
      style={controlsInFront ? undefined : { zIndex: 50 - depth }}
      aria-label="Selected feature"
      data-mobile-feature-card-root="true"
    >
      <div
        ref={frameRef}
        className="absolute inset-x-0 bottom-0 pointer-events-none grid will-change-transform"
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget && event.propertyName === 'transform' && !open) finishClose()
        }}
        style={{
          height:
            workspace?.placement === 'container'
              ? `min(${height}px, 100%)`
              : `min(${height}px, calc(100dvh - 4.75rem))`,
          bottom: 0,
          transform: presence.visible ? 'translateY(0)' : 'translateY(100%)',
          transition: reducedMotion ? 'none' : `transform ${MOTION_DURATION.panel}ms ${MOTION_EASING}`,
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-labelledby={titleId}
          aria-hidden={!open || controlsInFront}
          data-map-feature-card-panel="true"
          data-feature-card-detent={detent}
          data-feature-card-state={open ? 'open' : 'closing'}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && isFront && !event.defaultPrevented) {
              event.preventDefault()
              event.stopPropagation()
              closeWithAnimation()
            }
          }}
          className={cn(
            'pointer-events-auto col-start-1 row-start-1 flex self-end flex-col overflow-hidden rounded-t-lg border border-b-0 border-border bg-background shadow-[0_-2px_16px_rgba(0,0,0,0.24)]',
            controlsInFront && 'pointer-events-none -translate-y-1.5 shadow-[0_-3px_14px_rgba(0,0,0,0.24)]',
            controlsInFront && !collapsed && expanded && 'h-full',
            !controlsInFront &&
              !stackedBehind &&
              (collapsed
                ? 'translate-y-0'
                : coversStack
                  ? expanded
                    ? 'h-full translate-y-0'
                    : 'translate-y-0'
                  : expanded
                    ? 'h-full translate-y-2'
                    : 'translate-y-2'),
            stackedBehind && 'shadow-[0_-3px_14px_rgba(0,0,0,0.24)]',
            className,
          )}
          style={{
            alignSelf: 'end',
            height: `${boundedVisibleHeight}px`,
            maxHeight: '100%',
            transform: `translateY(${stackedBehind ? -stackOffset : controlsInFront ? -6 : effectiveCollapsed || coversStack ? 0 : 8}px)`,
            transition: (controlsInFront && controlsVisibleHeight != null) || stackedBehind ? 'none' : transition,
          }}
        >
          <div
            ref={handleRef}
            className="flex min-h-11 shrink-0 cursor-grab touch-none items-center justify-center py-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:cursor-grabbing"
            role="separator"
            aria-label="Resize selected feature card"
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={2}
            aria-valuenow={collapsed ? 0 : expanded ? 2 : 1}
            aria-valuetext={`${collapsed ? 'collapsed' : expanded ? 'expanded' : 'compact'} card`}
            tabIndex={0}
            data-mobile-feature-card-handle="true"
            {...gestureHandlers}
            onClick={handleHandleClick}
            onKeyDown={(event) => {
              const next = stepFeatureCard(detent, event.key)
              if (!next) return
              event.preventDefault()
              bringCardForward()
              snapCard(next)
            }}
          >
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>
          <header
            className={cn(
              'shrink-0 cursor-grab touch-none border-b border-border px-4 active:cursor-grabbing',
              effectiveCollapsed ? 'pb-0' : 'pb-3',
            )}
            {...gestureHandlers}
          >
            <div className="flex items-start justify-between gap-3">
              {stackedBehind ? (
                <button
                  type="button"
                  className="group min-h-11 min-w-0 flex-1 rounded-md py-0.5 pr-1 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={bringToFront}
                  aria-label={titleText ? `Bring ${titleText} to front` : 'Bring card to front'}
                >
                  <div id={titleId} className="truncate text-base font-semibold leading-tight text-foreground">
                    {title}
                  </div>
                  {subtitle ? (
                    <div className="mt-1 line-clamp-2 text-sm leading-snug text-muted-foreground">{subtitle}</div>
                  ) : null}
                </button>
              ) : canDockBehindControls ? (
                <button
                  type="button"
                  className="group min-h-11 min-w-0 flex-1 rounded-md py-0.5 pr-1 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={handleDockClick}
                  aria-label="Dock selected feature behind map controls"
                >
                  <div id={titleId} className="truncate text-base font-semibold leading-tight text-foreground">
                    {title}
                  </div>
                  {subtitle ? (
                    <div className="mt-1 line-clamp-2 text-sm leading-snug text-muted-foreground">{subtitle}</div>
                  ) : null}
                </button>
              ) : (
                <div className="min-w-0 flex-1 py-0.5 pr-1 text-left">
                  <div id={titleId} className="truncate text-base font-semibold leading-tight text-foreground">
                    {title}
                  </div>
                  {subtitle ? (
                    <div className="mt-1 line-clamp-2 text-sm leading-snug text-muted-foreground">{subtitle}</div>
                  ) : null}
                </div>
              )}
              <div ref={actionsRef} className="flex shrink-0 items-center gap-1">
                {canDockBehindControls ? (
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Dock selected feature behind map controls"
                    data-mobile-feature-card-action="true"
                    onClick={dockBehindControls}
                  >
                    <ChevronDown className="size-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Close feature card"
                  data-mobile-feature-card-action="true"
                  onClick={closeWithAnimation}
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          </header>
          <div
            ref={bodyRef}
            data-mobile-feature-card-body="true"
            className={cn(
              'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] transition-opacity duration-300',
              bodyHidden ? 'pointer-events-none opacity-0' : 'opacity-100',
              contentClassName,
            )}
            aria-hidden={bodyHidden}
            style={bodyHidden ? { flexBasis: 0, padding: 0 } : undefined}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
