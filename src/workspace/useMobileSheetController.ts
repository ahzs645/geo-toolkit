import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  MOBILE_FEATURE_CARD_COMPACT_HEIGHT,
  MOBILE_FEATURE_CARD_COLLAPSED_HEIGHT,
  MOBILE_FEATURE_CARD_COLLAPSE_STATE_EVENT,
  MOBILE_FEATURE_CARD_DOCK_EVENT,
  MOBILE_FEATURE_CARD_FRONT_EVENT,
  MOBILE_FEATURE_CARD_CLOSE_EVENT,
  MOBILE_FEATURE_CARD_OPEN_EVENT,
  MOBILE_FEATURE_CARD_PEEK_EVENT,
  MOBILE_MAP_CONTROLS_FRONT_EVENT,
  MOBILE_MAP_CONTROLS_VISIBLE_HEIGHT_EVENT,
  MOBILE_MAP_INTERACTION_EVENT,
  MOBILE_MAP_SHEET_COLLAPSE_EVENT,
  MOBILE_MAP_SHEET_STACK_EVENT,
} from '../ui/mobile-feature-card.js'
import { useIsMobile } from './useIsMobile.js'
import { MAP_SEARCH_REQUEST } from './map-search.js'
import { useWorkspace, useWorkspaceInteractions } from './workspace-context.js'
import { MOTION_DURATION, MOTION_EASING, useReducedMotion } from '../ui/motion.js'

import { useMobileSheetGestures } from './useMobileSheetGestures.js'
import { moveSheet } from './sheet-motion.js'
import { useVisibleMapPanel } from './visible-map-panels.js'
import { CONTROLS_STACK_ID, MOBILE_CARD_STACK_MAX_VISIBLE_DEPTH, mobileCardStackView } from './mobile-card-store.js'
import { useWorkspaceSheetStack } from '../ui/mobile-card-stack.js'
import type { MapSectionLayoutProps } from './MapSectionLayout.js'
import {
  DEFAULT_FULL_SNAP_OFFSET,
  MOBILE_TOOLBAR_GAP,
  MOBILE_STACK_REAR_SHEET_VISIBLE_GAP,
  MOBILE_FEATURE_CARD_FRONT_OFFSET,
  getSnapPositions,
  stateFromTranslate,
  sheetOpenProgress,
  type MobileSheetState,
} from './sheet-math.js'

type SheetControllerOptions = Required<
  Pick<
    MapSectionLayoutProps,
    | 'mobileInitialSheetState'
    | 'mobileCollapsedVisibleHeight'
    | 'mobileSheetInteractive'
    | 'mobileScrimEnabled'
    | 'disableSidebar'
    | 'suppressMobileSheet'
    | 'showDesktopRightSidebar'
  >
> &
  Pick<
    MapSectionLayoutProps,
    | 'mobileInitialSheetState'
    | 'mobileCollapsedVisibleHeight'
    | 'mobileSheetInteractive'
    | 'mobileScrimEnabled'
    | 'onMobileSheetStateChange'
    | 'disableSidebar'
    | 'suppressMobileSheet'
    | 'showDesktopRightSidebar'
    | 'onToggleDesktopRightSidebar'
    | 'mobileSnapVisibleHeight'
    | 'mobileSnapFromVisibleHeight'
    | 'mobileSnapKey'
    | 'mobileSnapTo'
  > & { showDesktopSidebar: boolean; onToggleDesktopSidebar: () => void }

/** Owns sheet snapping, coordinated cards, search focus, and lifecycle independently of JSX layout. */
export function useMobileSheetController({
  mobileInitialSheetState,
  mobileCollapsedVisibleHeight,
  mobileSheetInteractive,
  mobileScrimEnabled,
  onMobileSheetStateChange,
  disableSidebar,
  suppressMobileSheet,
  showDesktopRightSidebar,
  onToggleDesktopRightSidebar,
  mobileSnapVisibleHeight,
  mobileSnapFromVisibleHeight,
  mobileSnapKey,
  mobileSnapTo,
  showDesktopSidebar,
  onToggleDesktopSidebar,
}: SheetControllerOptions) {
  const workspace = useWorkspace()
  const interactions = useWorkspaceInteractions()
  const setWorkspaceRoot = workspace?.setRoot
  const isMobile = useIsMobile()
  const reducedMotion = useReducedMotion()
  const [mobileSheetState, setMobileSheetState] = useState<MobileSheetState>(mobileInitialSheetState)
  const mobileSheetStateRef = useRef<MobileSheetState>(mobileInitialSheetState)
  const [mobileFeatureCardOpen, setMobileFeatureCardOpenState] = useState(false)
  const featureCardOpenRef = useRef(false)
  const setMobileFeatureCardOpen = useCallback((open: boolean) => {
    featureCardOpenRef.current = open
    setMobileFeatureCardOpenState(open)
  }, [])
  // The controls sheet is one member of the workspace's sheet stack, with the
  // cards. Whether it is in front is read from that stack, never kept here.
  const sheetStack = useWorkspaceSheetStack()
  const stackEntries = useSyncExternalStore(sheetStack.subscribe, sheetStack.getSnapshot, sheetStack.getServerSnapshot)
  const mobileControlsInFront = mobileCardStackView(stackEntries, CONTROLS_STACK_ID).controlsInFront
  const controlsInFrontRef = useRef(mobileControlsInFront)
  controlsInFrontRef.current = mobileControlsInFront
  const stackCards = stackEntries.filter((entry) => entry.id !== CONTROLS_STACK_ID)
  /** Cards drawn in the stack: the controls sheet's strip goes above the rearmost. */
  const visibleCardCount = Math.min(stackCards.length, MOBILE_CARD_STACK_MAX_VISIBLE_DEPTH)
  const visibleCardCountRef = useRef(visibleCardCount)
  visibleCardCountRef.current = visibleCardCount
  const frontCardHeight = stackCards[stackCards.length - 1]?.visibleHeight ?? 0
  const setMobileControlsInFront = useCallback(
    (front: boolean) => {
      controlsInFrontRef.current = front
      if (front) sheetStack.push(CONTROLS_STACK_ID)
      else sheetStack.sendToBack(CONTROLS_STACK_ID)
    },
    [sheetStack],
  )
  useEffect(() => {
    sheetStack.sendToBack(CONTROLS_STACK_ID)
    return () => sheetStack.remove(CONTROLS_STACK_ID)
  }, [sheetStack])
  const [mobileFeaturePeek, setMobileFeaturePeek] = useState<{ title?: string; subtitle?: string }>({})

  // DOM refs
  const rootRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    setWorkspaceRoot?.(rootRef.current)
    return () => setWorkspaceRoot?.(null)
  }, [setWorkspaceRoot])
  const sheetRef = useRef<HTMLDivElement>(null)
  useVisibleMapPanel(sheetRef, isMobile && !disableSidebar && !suppressMobileSheet)
  const handleRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const rightSidebarRef = useRef<HTMLDivElement>(null)
  const searchTargetRef = useRef<HTMLInputElement | null>(null)
  const [searchRequest, setSearchRequest] = useState(0)

  // Drag bookkeeping (refs for zero re-renders during drag)
  const draggingRef = useRef(false)
  const translateRef = useRef(0)
  const suppressScrim = useRef(false)
  const cancelMotionRef = useRef<(() => void) | null>(null)
  const motionTargetRef = useRef<number | null>(null)
  /** Geometry the sheet was last snapped for; see the resize effect. */
  const lastSnapLayoutRef = useRef<string | null>(null)

  // ------ helpers ----------------------------------------------------------

  const getSheetHeight = useCallback(() => {
    return sheetRef.current?.getBoundingClientRect().height || window.innerHeight
  }, [])

  const getFullSnapOffset = useCallback(() => {
    if (!isMobile) return DEFAULT_FULL_SNAP_OFFSET
    const toolbar =
      workspace?.toolbar ?? rootRef.current?.querySelector<HTMLElement>('[data-map-mobile-toolbar="true"]')
    const toolbarBottom = toolbar
      ? toolbar.getBoundingClientRect().bottom -
        (workspace?.placement === 'container' ? (rootRef.current?.getBoundingClientRect().top ?? 0) : 0)
      : 0
    return toolbarBottom > 0 ? toolbarBottom + MOBILE_TOOLBAR_GAP : DEFAULT_FULL_SNAP_OFFSET
  }, [workspace?.toolbar, workspace?.placement, isMobile])

  const publishTransform = useCallback(
    (y: number) => {
      const sheetHeight = getSheetHeight()
      translateRef.current = y
      const visibleHeight = Math.max(0, sheetHeight - y)
      rootRef.current?.style.setProperty('--map-mobile-sheet-visible-height', `${visibleHeight}px`)
      if (controlsInFrontRef.current && featureCardOpenRef.current) {
        interactions.dispatchEvent(
          new CustomEvent(MOBILE_MAP_CONTROLS_VISIBLE_HEIGHT_EVENT, {
            detail: { visibleHeight, direct: true },
          }),
        )
      }

      // Scrim opacity: 0 up to the half detent → 0.4 at full. At half the map
      // stays usable (pan, tap a feature), as it does beside a half-height card;
      // only the full sheet takes over the screen and dims what it covers.
      const snaps = getSnapPositions(sheetHeight, getFullSnapOffset(), mobileCollapsedVisibleHeight)
      const t = sheetOpenProgress(y, snaps.full, snaps.half)
      if (scrimRef.current) {
        const showScrim = mobileSheetInteractive && mobileScrimEnabled && !suppressScrim.current
        scrimRef.current.style.opacity = showScrim ? String(t * 0.4) : '0'
        scrimRef.current.style.pointerEvents = showScrim && t > 0.05 ? 'auto' : 'none'
        // This opacity already follows the rendered sheet on every frame.
        scrimRef.current.style.transition = 'none'
      }
    },
    [
      getFullSnapOffset,
      getSheetHeight,
      interactions,
      mobileCollapsedVisibleHeight,
      mobileScrimEnabled,
      mobileSheetInteractive,
    ],
  )
  const publishTransformRef = useRef(publishTransform)
  useLayoutEffect(() => {
    publishTransformRef.current = publishTransform
  }, [publishTransform])

  const applyTransform = useCallback(
    (y: number, animate: boolean) => {
      cancelMotionRef.current?.()
      cancelMotionRef.current = null
      const sheet = sheetRef.current
      if (!sheet) return
      motionTargetRef.current = y
      sheet.dataset.mapTargetVisibleHeight = String(Math.max(0, getSheetHeight() - y))
      cancelMotionRef.current = moveSheet(sheet, y, {
        durationMs: animate && !reducedMotion ? MOTION_DURATION.panel : 0,
        easing: MOTION_EASING,
        onFrame: (renderedY) => publishTransformRef.current(renderedY),
      })
      if (draggingRef.current) sheet.style.willChange = 'transform'
    },
    [getSheetHeight, reducedMotion],
  )

  useLayoutEffect(() => () => cancelMotionRef.current?.(), [])

  useLayoutEffect(() => {
    if (isMobile && reducedMotion && motionTargetRef.current !== null) {
      applyTransform(motionTargetRef.current, false)
    }
  }, [applyTransform, isMobile, reducedMotion])

  const updateMobileSheetState = useCallback(
    (state: MobileSheetState) => {
      if (mobileSheetStateRef.current === state) return
      mobileSheetStateRef.current = state
      setMobileSheetState(state)
      onMobileSheetStateChange?.(state)
    },
    [onMobileSheetStateChange],
  )

  const snapTo = useCallback(
    (state: MobileSheetState, animate = true) => {
      suppressScrim.current = false
      updateMobileSheetState(state)
      applyTransform(
        getSnapPositions(getSheetHeight(), getFullSnapOffset(), mobileCollapsedVisibleHeight)[state],
        animate,
      )
    },
    [applyTransform, getFullSnapOffset, getSheetHeight, mobileCollapsedVisibleHeight, updateMobileSheetState],
  )

  const stackBehindFeatureCard = useCallback(
    (collapsedFeature = false, visibleFeatureHeight?: number, animate = true) => {
      if (!isMobile) return
      const sheetHeight = getSheetHeight()
      const featureHeight = Math.min(
        visibleFeatureHeight ??
          (collapsedFeature ? MOBILE_FEATURE_CARD_COLLAPSED_HEIGHT : MOBILE_FEATURE_CARD_COMPACT_HEIGHT),
        Math.max(
          160,
          (workspace?.placement === 'container'
            ? (rootRef.current?.clientHeight ?? window.innerHeight)
            : window.innerHeight) - 104,
        ),
      )
      // The controls sheet is the rearmost strip: one gap above the last card
      // drawn behind the front one. A lone compact card sits offset downwards.
      const cards = Math.max(1, visibleCardCountRef.current)
      const visibleHeight =
        collapsedFeature || cards > 1
          ? featureHeight + MOBILE_STACK_REAR_SHEET_VISIBLE_GAP * cards
          : featureHeight + MOBILE_STACK_REAR_SHEET_VISIBLE_GAP - MOBILE_FEATURE_CARD_FRONT_OFFSET
      const snaps = getSnapPositions(sheetHeight, getFullSnapOffset(), mobileCollapsedVisibleHeight)
      const y = Math.max(snaps.full, Math.min(snaps.collapsed, sheetHeight - visibleHeight))
      suppressScrim.current = true
      updateMobileSheetState(stateFromTranslate(y, sheetHeight, getFullSnapOffset(), mobileCollapsedVisibleHeight))
      applyTransform(y, animate)
      if (scrimRef.current) {
        scrimRef.current.style.opacity = '0'
        scrimRef.current.style.pointerEvents = 'none'
      }
    },
    [
      applyTransform,
      getFullSnapOffset,
      getSheetHeight,
      mobileCollapsedVisibleHeight,
      updateMobileSheetState,
      workspace?.placement,
      isMobile,
    ],
  )

  const stackControlsOverFeatureCard = useCallback(
    (collapsedFeature = false, visibleFeatureHeight?: number, animate = true) => {
      if (!isMobile) return
      const sheetHeight = getSheetHeight()
      const featureHeight = Math.min(
        visibleFeatureHeight ??
          (collapsedFeature ? MOBILE_FEATURE_CARD_COLLAPSED_HEIGHT : MOBILE_FEATURE_CARD_COMPACT_HEIGHT),
        Math.max(
          160,
          (workspace?.placement === 'container'
            ? (rootRef.current?.clientHeight ?? window.innerHeight)
            : window.innerHeight) - 104,
        ),
      )
      const snaps = getSnapPositions(sheetHeight, getFullSnapOffset(), mobileCollapsedVisibleHeight)
      const y = Math.max(snaps.full, Math.min(snaps.collapsed, sheetHeight - featureHeight))
      suppressScrim.current = true
      updateMobileSheetState(stateFromTranslate(y, sheetHeight, getFullSnapOffset(), mobileCollapsedVisibleHeight))
      applyTransform(y, animate)
      if (scrimRef.current) {
        scrimRef.current.style.opacity = '0'
        scrimRef.current.style.pointerEvents = 'none'
      }
    },
    [
      applyTransform,
      getFullSnapOffset,
      getSheetHeight,
      mobileCollapsedVisibleHeight,
      updateMobileSheetState,
      workspace?.placement,
      isMobile,
    ],
  )

  // A card joining or leaving a stack that already has cards moves the controls
  // strip with it. The first card's opening already positions it (the stack
  // event), so that is not done twice.
  const previousCardCountRef = useRef(visibleCardCount)
  useEffect(() => {
    const previous = previousCardCountRef.current
    if (previous === visibleCardCount) return
    previousCardCountRef.current = visibleCardCount
    if (previous === 0 || visibleCardCount === 0) return
    if (!isMobile || controlsInFrontRef.current || frontCardHeight <= 0) return
    stackBehindFeatureCard(frontCardHeight <= MOBILE_FEATURE_CARD_COLLAPSED_HEIGHT + 1, frontCardHeight)
  }, [frontCardHeight, isMobile, stackBehindFeatureCard, visibleCardCount])

  const bringControlsToFront = useCallback(() => {
    if (!isMobile) return
    setMobileControlsInFront(true)
    suppressScrim.current = true
    interactions.dispatchEvent(new CustomEvent(MOBILE_MAP_CONTROLS_FRONT_EVENT))
    stackControlsOverFeatureCard(false)
  }, [interactions, setMobileControlsInFront, stackControlsOverFeatureCard, isMobile])

  const bringFeatureCardToFront = useCallback(() => {
    if (!isMobile) return
    setMobileControlsInFront(false)
    interactions.dispatchEvent(new CustomEvent(MOBILE_FEATURE_CARD_FRONT_EVENT))
    stackBehindFeatureCard(false)
  }, [interactions, setMobileControlsInFront, stackBehindFeatureCard, isMobile])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const openSearch = (event: Event) => {
      const selector = 'input[data-map-search-input="true"]'
      const leftInput = contentRef.current?.querySelector<HTMLInputElement>(selector)
      const rightInput = rightSidebarRef.current?.querySelector<HTMLInputElement>(selector)
      const input = leftInput ?? rightInput
      if (!input || disableSidebar || (isMobile && suppressMobileSheet)) return
      event.preventDefault()
      searchTargetRef.current = input
      if (isMobile) {
        setMobileControlsInFront(true)
        interactions.dispatchEvent(new CustomEvent(MOBILE_MAP_CONTROLS_FRONT_EVENT))
        suppressScrim.current = false
        updateMobileSheetState('full')
        // Reveal synchronously before focus; do not let scroll-to-focus move the map.
        applyTransform(getFullSnapOffset(), false)
      } else if (leftInput && !showDesktopSidebar) {
        onToggleDesktopSidebar()
      } else if (!leftInput && !showDesktopRightSidebar) {
        onToggleDesktopRightSidebar?.()
      }
      setSearchRequest((request) => request + 1)
    }
    root.addEventListener(MAP_SEARCH_REQUEST, openSearch)
    return () => root.removeEventListener(MAP_SEARCH_REQUEST, openSearch)
  }, [
    applyTransform,
    disableSidebar,
    getFullSnapOffset,
    interactions,
    onToggleDesktopRightSidebar,
    onToggleDesktopSidebar,
    showDesktopRightSidebar,
    showDesktopSidebar,
    suppressMobileSheet,
    setMobileControlsInFront,
    updateMobileSheetState,
    isMobile,
  ])

  useLayoutEffect(() => {
    const input = searchTargetRef.current
    const root = rootRef.current
    if (!searchRequest || !input || !root || !input.getClientRects().length) return
    input.focus({ preventScroll: true })
    input.select()
    // Only scroll the panel's own scroll containers, never the map/layout ancestors.
    const reveal = () => {
      const viewportBottom = window.visualViewport
        ? window.visualViewport.offsetTop + window.visualViewport.height
        : window.innerHeight
      for (let parent = input.parentElement; parent && parent !== root; parent = parent.parentElement) {
        if (!/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) continue
        const field = input.getBoundingClientRect()
        const pane = parent.getBoundingClientRect()
        const bottom = Math.min(pane.bottom, viewportBottom) - 16
        if (field.bottom > bottom) parent.scrollTop += field.bottom - bottom
        else if (field.top < pane.top + 16) parent.scrollTop -= pane.top + 16 - field.top
      }
    }
    reveal()
    const revealFocused = () => {
      if (document.activeElement === input) reveal()
    }
    window.visualViewport?.addEventListener('resize', revealFocused)
    return () => window.visualViewport?.removeEventListener('resize', revealFocused)
  }, [searchRequest])

  useEffect(() => {
    if (!isMobile) return
    if (mobileSnapVisibleHeight != null) {
      const sheetHeight = getSheetHeight()
      const snaps = getSnapPositions(sheetHeight, getFullSnapOffset(), mobileCollapsedVisibleHeight)
      const y = Math.max(snaps.full, Math.min(snaps.collapsed, sheetHeight - mobileSnapVisibleHeight))
      if (mobileSnapFromVisibleHeight != null && sheetRef.current) {
        const fromY = Math.max(snaps.full, Math.min(snaps.collapsed, sheetHeight - mobileSnapFromVisibleHeight))
        applyTransform(fromY, false)
        applyTransform(y, true)
        updateMobileSheetState(stateFromTranslate(y, sheetHeight, getFullSnapOffset(), mobileCollapsedVisibleHeight))
        return
      }
      updateMobileSheetState(stateFromTranslate(y, sheetHeight, getFullSnapOffset(), mobileCollapsedVisibleHeight))
      applyTransform(y, true)
      return
    }
    if (!mobileSnapTo) return
    snapTo(mobileSnapTo)
  }, [
    applyTransform,
    getFullSnapOffset,
    getSheetHeight,
    mobileCollapsedVisibleHeight,
    mobileSnapFromVisibleHeight,
    mobileSnapKey,
    mobileSnapTo,
    mobileSnapVisibleHeight,
    snapTo,
    updateMobileSheetState,
    isMobile,
  ])

  // ------ lifecycle --------------------------------------------------------

  // Chrome pinned to the map's top corners (zoom and compass) clears a toolbar
  // floating over the map on phones: publish how far the toolbar reaches into
  // the layout. A hidden toolbar measures zero.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const toolbar = workspace?.toolbar ?? root.querySelector<HTMLElement>('[data-map-mobile-toolbar="true"]')
    if (!isMobile || !toolbar) {
      root.style.removeProperty('--map-mobile-toolbar-height')
      return
    }
    const sync = () => {
      const rect = toolbar.getBoundingClientRect()
      const overlap = rect.height > 0 ? Math.max(0, Math.ceil(rect.bottom - root.getBoundingClientRect().top)) : 0
      root.style.setProperty('--map-mobile-toolbar-height', `${overlap}px`)
    }
    sync()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync)
    observer?.observe(toolbar)
    window.addEventListener('resize', sync)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', sync)
      root.style.removeProperty('--map-mobile-toolbar-height')
    }
  }, [isMobile, workspace?.toolbar])

  // Position on first paint (before browser paints → no flash)
  useLayoutEffect(() => {
    // No bottom sheet is rendered when the sidebar is disabled. Keep publishing
    // an explicit 0px height so nested map overlays do not fall back to their
    // mobile sheet offsets.
    if (disableSidebar) {
      rootRef.current?.style.setProperty('--map-mobile-sheet-visible-height', '0px')
      return
    }
    if (isMobile) {
      const sheetHeight = getSheetHeight()
      const fullSnapOffset = getFullSnapOffset()
      const y = getSnapPositions(sheetHeight, fullSnapOffset, mobileCollapsedVisibleHeight)[mobileInitialSheetState]
      lastSnapLayoutRef.current = `${Math.round(sheetHeight)}:${Math.round(fullSnapOffset)}:${mobileCollapsedVisibleHeight}`
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${y}px)`
        sheetRef.current.style.transition = 'none'
      }
      translateRef.current = y
      motionTargetRef.current = y
      if (sheetRef.current) {
        sheetRef.current.dataset.mapTargetVisibleHeight = String(Math.max(0, getSheetHeight() - y))
      }
      rootRef.current?.style.setProperty('--map-mobile-sheet-visible-height', `${Math.max(0, getSheetHeight() - y)}px`)
      if (scrimRef.current) {
        scrimRef.current.style.opacity = '0'
        scrimRef.current.style.pointerEvents = 'none'
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle viewport resize & orientation change
  useEffect(() => {
    const onResize = () => {
      if (!isMobile) {
        cancelMotionRef.current?.()
        cancelMotionRef.current = null
        motionTargetRef.current = null
        draggingRef.current = false
        // Desktop — clear mobile transforms
        if (sheetRef.current) {
          sheetRef.current.style.transform = ''
          sheetRef.current.style.transition = ''
          delete sheetRef.current.dataset.mapTargetVisibleHeight
        }
        rootRef.current?.style.removeProperty('--map-mobile-sheet-visible-height')
        if (scrimRef.current) {
          scrimRef.current.style.opacity = '0'
          scrimRef.current.style.pointerEvents = 'none'
        }
        lastSnapLayoutRef.current = null
      } else {
        const sheetHeight = getSheetHeight()
        const fullSnapOffset = getFullSnapOffset()
        // This effect also re-runs when its callbacks change identity, e.g. when a
        // feature card opens. That is not a resize: re-snapping then would pull a sheet
        // stacked behind the card back up to its plain snap point, leaving the card
        // floating over half of the sheet. Only snap again when the geometry moved.
        const layout = `${Math.round(sheetHeight)}:${Math.round(fullSnapOffset)}:${mobileCollapsedVisibleHeight}`
        if (layout === lastSnapLayoutRef.current) return
        lastSnapLayoutRef.current = layout
        draggingRef.current = false
        // Desktop has no translateY. Preserve the logical mobile snap when
        // crossing a breakpoint rather than interpreting that zero as "full".
        applyTransform(
          getSnapPositions(sheetHeight, fullSnapOffset, mobileCollapsedVisibleHeight)[mobileSheetStateRef.current],
          false,
        )
      }
    }
    onResize()
    let orientationTimer: ReturnType<typeof setTimeout> | undefined
    const onOrientationChange = () => {
      clearTimeout(orientationTimer)
      orientationTimer = setTimeout(onResize, 150)
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onOrientationChange)
    // React can change the pane height after the window resize event (for
    // example when Index Lab removes its desktop header on a phone).
    const observer = new ResizeObserver(onResize)
    if (rootRef.current) observer.observe(rootRef.current)
    return () => {
      clearTimeout(orientationTimer)
      observer.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onOrientationChange)
    }
  }, [applyTransform, getFullSnapOffset, getSheetHeight, mobileCollapsedVisibleHeight, isMobile])

  // Tapping outside the sheet dismisses what the scrim was raised for. With a
  // card docked behind the controls that is the controls sheet itself: the card
  // the person was reading comes back to the front rather than everything
  // collapsing into a peek that hides it.
  const handleScrimClick = useCallback(() => {
    if (featureCardOpenRef.current && controlsInFrontRef.current) bringFeatureCardToFront()
    else snapTo('collapsed')
  }, [bringFeatureCardToFront, snapTo])

  const { handleMobileSheetKeyDown, startHandlePointerDrag, moveHandlePointerDrag, endHandlePointerDrag } =
    useMobileSheetGestures({
      sheetRef,
      handleRef,
      draggingRef,
      translateRef,
      mobileFeatureCardOpen,
      mobileControlsInFront,
      bringControlsToFront,
      applyTransform,
      getFullSnapOffset,
      getSheetHeight,
      mobileCollapsedVisibleHeight,
      snapTo,
      mobileSheetState,
      isMobile,
    })

  useEffect(() => {
    const collapse = () => {
      if (!isMobile) return
      setMobileControlsInFront(false)
      snapTo('collapsed')
    }
    const collapseForMapInteraction = () => {
      if (!isMobile) return
      setMobileControlsInFront(false)
      snapTo('collapsed')
    }
    const stack = () => {
      setMobileFeatureCardOpen(true)
      setMobileControlsInFront(false)
      stackBehindFeatureCard(false)
    }
    const handleFeatureOpen = () => {
      setMobileFeatureCardOpen(true)
      setMobileControlsInFront(false)
    }
    const handleFeatureClose = () => {
      setMobileFeatureCardOpen(false)
      setMobileControlsInFront(false)
    }
    const handleFeaturePeek = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      setMobileFeaturePeek({
        title: typeof event.detail?.title === 'string' ? event.detail.title : undefined,
        subtitle: typeof event.detail?.subtitle === 'string' ? event.detail.subtitle : undefined,
      })
    }
    const handleFeatureCollapseState = (event: Event) => {
      if (!isMobile || !(event instanceof CustomEvent)) return
      const collapsed = Boolean(event.detail?.collapsed)
      const direct = event.detail?.direct === true
      const visibleHeight = typeof event.detail?.visibleHeight === 'number' ? event.detail.visibleHeight : undefined
      if (mobileControlsInFront) {
        stackControlsOverFeatureCard(collapsed, visibleHeight, !direct)
        return
      }
      if (collapsed) {
        snapTo('collapsed', !direct)
        return
      }
      stackBehindFeatureCard(collapsed, visibleHeight, !direct)
    }
    const handleFeatureDock = () => {
      setMobileFeatureCardOpen(true)
      bringControlsToFront()
    }
    interactions.addEventListener(MOBILE_MAP_INTERACTION_EVENT, collapseForMapInteraction)
    interactions.addEventListener(MOBILE_MAP_SHEET_COLLAPSE_EVENT, collapse)
    interactions.addEventListener(MOBILE_MAP_SHEET_STACK_EVENT, stack)
    interactions.addEventListener(MOBILE_FEATURE_CARD_COLLAPSE_STATE_EVENT, handleFeatureCollapseState)
    interactions.addEventListener(MOBILE_FEATURE_CARD_DOCK_EVENT, handleFeatureDock)
    interactions.addEventListener(MOBILE_FEATURE_CARD_OPEN_EVENT, handleFeatureOpen)
    interactions.addEventListener(MOBILE_FEATURE_CARD_CLOSE_EVENT, handleFeatureClose)
    interactions.addEventListener(MOBILE_FEATURE_CARD_PEEK_EVENT, handleFeaturePeek)
    return () => {
      interactions.removeEventListener(MOBILE_MAP_INTERACTION_EVENT, collapseForMapInteraction)
      interactions.removeEventListener(MOBILE_MAP_SHEET_COLLAPSE_EVENT, collapse)
      interactions.removeEventListener(MOBILE_MAP_SHEET_STACK_EVENT, stack)
      interactions.removeEventListener(MOBILE_FEATURE_CARD_COLLAPSE_STATE_EVENT, handleFeatureCollapseState)
      interactions.removeEventListener(MOBILE_FEATURE_CARD_DOCK_EVENT, handleFeatureDock)
      interactions.removeEventListener(MOBILE_FEATURE_CARD_OPEN_EVENT, handleFeatureOpen)
      interactions.removeEventListener(MOBILE_FEATURE_CARD_CLOSE_EVENT, handleFeatureClose)
      interactions.removeEventListener(MOBILE_FEATURE_CARD_PEEK_EVENT, handleFeaturePeek)
    }
  }, [
    bringControlsToFront,
    interactions,
    mobileControlsInFront,
    snapTo,
    stackBehindFeatureCard,
    stackControlsOverFeatureCard,
    setMobileControlsInFront,
    setMobileFeatureCardOpen,
    isMobile,
  ])

  return {
    rootRef,
    sheetRef,
    handleRef,
    contentRef,
    scrimRef,
    rightSidebarRef,
    mobileSheetState,
    mobileControlsInFront,
    mobileFeatureCardOpen,
    mobileFeaturePeek,
    bringFeatureCardToFront,
    bringControlsToFront,
    snapTo,
    handleScrimClick,
    handleMobileSheetKeyDown,
    startHandlePointerDrag,
    moveHandlePointerDrag,
    endHandlePointerDrag,
  }
}
