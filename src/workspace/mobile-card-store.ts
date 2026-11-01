export interface MobileCardStackEntry {
  id: string
  visibleHeight: number
}

/**
 * The layout's own controls sheet, as a member of the same stack as the cards.
 * One ordered list decides which sheet is in front, so a card can never keep a
 * stale idea of whether the controls are above it.
 */
export const CONTROLS_STACK_ID = 'geo-toolkit:controls'

/** Sheets this many places behind the front one are hidden, as Felt does. */
export const MOBILE_CARD_STACK_MAX_VISIBLE_DEPTH = 3

export interface MobileCardStackView {
  /** Places from the front of the whole stack, the controls sheet included. */
  depth: number
  /** Places behind the frontmost *card*, ignoring the controls sheet. */
  cardDepth: number
  /** This card is the frontmost card (the controls sheet may still be above it). */
  isFrontCard: boolean
  /** The controls sheet is the front of the stack, above every card. */
  controlsInFront: boolean
  hasCardsBehind: boolean
  /** Visible height last reported by the frontmost card, for cards behind it to match. */
  frontCardVisibleHeight: number | null
}

/** Where `id` sits in the stack. Pure so the rules can be tested without React. */
export function mobileCardStackView(entries: readonly MobileCardStackEntry[], id: string): MobileCardStackView {
  const cards = entries.filter((entry) => entry.id !== CONTROLS_STACK_ID)
  const index = entries.findIndex((entry) => entry.id === id)
  const cardIndex = cards.findIndex((entry) => entry.id === id)
  const frontCard = cards[cards.length - 1]
  const cardDepth = cardIndex < 0 ? 0 : cards.length - 1 - cardIndex
  return {
    depth: index < 0 ? 0 : entries.length - 1 - index,
    cardDepth,
    isFrontCard: cardIndex >= 0 && cardDepth === 0,
    controlsInFront: entries[entries.length - 1]?.id === CONTROLS_STACK_ID && cards.length > 0,
    hasCardsBehind: cardIndex >= 0 && cards.length > 1,
    frontCardVisibleHeight: cardIndex >= 0 && cardDepth > 0 && frontCard ? frontCard.visibleHeight : null,
  }
}

const EMPTY: MobileCardStackEntry[] = []
/** Independent external store: no card state is shared between workspaces. */
export function createMobileCardStack() {
  let entries: MobileCardStackEntry[] = []
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((listener) => listener())
  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => entries,
    getServerSnapshot: () => EMPTY,
    /** Bring `id` to the front, adding it if absent. */
    push(id: string) {
      const existing = entries.find((entry) => entry.id === id)
      if (existing && entries[entries.length - 1] === existing) return
      entries = [...entries.filter((entry) => entry.id !== id), existing ?? { id, visibleHeight: 0 }]
      emit()
    },
    /** Move `id` behind every other sheet, adding it if absent. */
    sendToBack(id: string) {
      const existing = entries.find((entry) => entry.id === id)
      if (existing && entries[0] === existing) return
      entries = [existing ?? { id, visibleHeight: 0 }, ...entries.filter((entry) => entry.id !== id)]
      emit()
    },
    remove(id: string) {
      if (!entries.some((entry) => entry.id === id)) return
      entries = entries.filter((entry) => entry.id !== id)
      emit()
    },
    setHeight(id: string, visibleHeight: number) {
      const index = entries.findIndex((entry) => entry.id === id)
      if (index < 0 || entries[index].visibleHeight === visibleHeight) return
      entries = entries.map((entry, i) => (i === index ? { ...entry, visibleHeight } : entry))
      emit()
    },
    reset() {
      entries = []
      emit()
    },
  }
}
export type MobileCardStackStore = ReturnType<typeof createMobileCardStack>
