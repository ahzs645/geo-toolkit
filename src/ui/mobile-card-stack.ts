import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import {
  createMobileCardStack,
  mobileCardStackView,
  type MobileCardStackStore,
  type MobileCardStackView,
} from '../workspace/mobile-card-store.js'
import { useWorkspace } from '../workspace/workspace-context.js'
export type { MobileCardStackEntry } from '../workspace/mobile-card-store.js'
export { CONTROLS_STACK_ID, MOBILE_CARD_STACK_MAX_VISIBLE_DEPTH } from '../workspace/mobile-card-store.js'

/**
 * Height of each card's strip left showing above the card in front of it. The
 * same gap the controls sheet keeps behind a card, so every rear sheet in the
 * stack reads alike and is large enough to tap.
 */
export const MOBILE_CARD_STACK_PEEK = 10

export interface MobileCardStackState extends MobileCardStackView {
  /** @deprecated Use isFrontCard; kept for hosts that read it. */
  isFront: boolean
  /** @deprecated Use frontCardVisibleHeight. */
  frontVisibleHeight: number | null
  bringToFront: () => void
  reportVisibleHeight: (height: number) => void
}

/** The workspace's single sheet stack, shared by the controls sheet and every card. */
export function useWorkspaceSheetStack(): MobileCardStackStore {
  const workspace = useWorkspace()
  const [fallback] = useState(createMobileCardStack)
  return workspace?.cards ?? fallback
}

export function useMobileCardStack(id: string, active = true): MobileCardStackState {
  const store = useWorkspaceSheetStack()
  const entries = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
  useEffect(() => {
    if (!active) return
    store.push(id)
    return () => store.remove(id)
  }, [active, id, store])
  const view = mobileCardStackView(entries, id)
  const bringToFront = useCallback(() => store.push(id), [id, store])
  const reportVisibleHeight = useCallback((height: number) => store.setHeight(id, height), [id, store])
  return {
    ...view,
    isFront: view.isFrontCard,
    frontVisibleHeight: view.frontCardVisibleHeight,
    bringToFront,
    reportVisibleHeight,
  }
}
