import type { MobileSheetState } from '../workspace/sheet-math.js'

export type FeatureCardHeights = Record<MobileSheetState, number>

/** Cards keep an authored compact height while sharing the sheet's three detents. */
export function featureCardHeights(
  frameHeight: number,
  compactHeight: number,
  collapsedHeight: number,
): FeatureCardHeights {
  const full = Math.max(1, frameHeight)
  const collapsed = Math.min(full, Math.max(1, collapsedHeight))
  return { full, half: Math.max(collapsed, Math.min(full, compactHeight)), collapsed }
}

/** The same 200 ms velocity projection as resolveSnap, with card-specific detents. */
export function resolveFeatureCardSnap(
  visibleHeight: number,
  velocityPxMs: number,
  heights: FeatureCardHeights,
): MobileSheetState {
  const projectedHeight = visibleHeight - velocityPxMs * 200
  const states: MobileSheetState[] = ['full', 'half', 'collapsed']
  return states.reduce(
    (best, state) =>
      Math.abs(projectedHeight - heights[state]) < Math.abs(projectedHeight - heights[best]) ? state : best,
    'full',
  )
}

export function stepFeatureCard(state: MobileSheetState, key: string): MobileSheetState | undefined {
  const states: MobileSheetState[] = ['collapsed', 'half', 'full']
  const index = states.indexOf(state)
  if (key === 'ArrowUp') return states[Math.min(2, index + 1)]
  if (key === 'ArrowDown') return states[Math.max(0, index - 1)]
  if (key === 'Home') return 'collapsed'
  if (key === 'End') return 'full'
  if (key === 'Enter' || key === ' ') return states[(index + 1) % states.length]
  return undefined
}
