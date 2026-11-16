import { useState } from 'react'

/**
 * A layout that folds below a size (API.md, **Measured sizes and folds**). Folding usually
 * changes the size it was measured on: a chart that hides its readouts can give its panel back some
 * padding and read taller, which unfolds it, which shrinks it again, every frame. So it
 * folds below `foldBelow` and unfolds only from `unfoldFrom`, a gap wider than anything folding
 * gives back or takes.
 */
export interface FoldThresholds {
  foldBelow: number
  unfoldFrom: number
}

/** Whether a layout is folded at `size`, given whether it was. An unmeasured or hidden size (0) keeps it as it was. */
export function nextFold(folded: boolean, size: number, { foldBelow, unfoldFrom }: FoldThresholds): boolean {
  if (!(unfoldFrom >= foldBelow))
    throw new Error(`A fold must unfold at or above where it folds (${unfoldFrom} < ${foldBelow}).`)
  if (!(size > 0)) return folded
  return size < (folded ? unfoldFrom : foldBelow)
}

/** `nextFold` kept across renders: true while the layout is folded. `initial` holds until a size is measured. */
export function useSizeFold(size: number, thresholds: FoldThresholds, initial = false): boolean {
  const [folded, setFolded] = useState(initial)
  const next = nextFold(folded, size, thresholds)
  // React's pattern for state that follows a previous render: set during render, before children see it.
  if (next !== folded) setFolded(next)
  return next
}
