/**
 * Class boundaries for a numeric column, beyond equal intervals and quantiles. Every function
 * takes the observations sorted ascending and returns interior boundaries: strictly ascending,
 * inside the range (above the minimum; natural breaks alone may end on the maximum), and
 * possibly fewer than asked for when the data cannot support that many classes. A value equal to a boundary belongs to the class above it, as everywhere
 * else in the palette scale. No DOM or network access.
 */

/** Natural breaks are found on at most this many observations, spread evenly through the sorted sample. */
export const NATURAL_BREAKS_MAX_VALUES = 2000

const insideAscending = (breaks: readonly number[], min: number, max: number) =>
  breaks.filter((value, index) => value > min && value < max && (index === 0 || value > breaks[index - 1]))

/**
 * Natural breaks (Fisher–Jenks): the boundaries that make the classes as tight as they can be,
 * minimising the squared deviation of every value from its own class mean. Every observation
 * counts, so a value that occurs often pulls a class towards it. Exact for samples up to
 * `NATURAL_BREAKS_MAX_VALUES`; a larger sample is thinned evenly first.
 */
export function naturalBreaks(sorted: readonly number[], classes: number): number[] {
  if (classes < 2 || sorted.length < 2) return []
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  if (min === max) return []
  const data =
    sorted.length > NATURAL_BREAKS_MAX_VALUES
      ? Array.from(
          { length: NATURAL_BREAKS_MAX_VALUES },
          (_, index) => sorted[Math.round((index * (sorted.length - 1)) / (NATURAL_BREAKS_MAX_VALUES - 1))],
        )
      : sorted
  const n = data.length
  const k = Math.min(classes, new Set(data).size)
  if (k < 2) return []
  // lower[l][j]: the first observation (1-based) of class j when the first l observations make j classes.
  const lower = new Int32Array((n + 1) * (k + 1))
  const variance = new Float64Array((n + 1) * (k + 1)).fill(Infinity)
  const at = (row: number, column: number) => row * (k + 1) + column
  for (let j = 1; j <= k; j++) {
    lower[at(1, j)] = 1
    variance[at(1, j)] = 0
  }
  for (let l = 2; l <= n; l++) {
    let sum = 0
    let squares = 0
    let spread = 0
    for (let m = 1; m <= l; m++) {
      const first = l - m + 1
      const value = data[first - 1]
      sum += value
      squares += value * value
      spread = squares - (sum * sum) / m
      if (first === 1) continue
      for (let j = 2; j <= k; j++) {
        const candidate = spread + variance[at(first - 1, j - 1)]
        if (variance[at(l, j)] >= candidate) {
          lower[at(l, j)] = first
          variance[at(l, j)] = candidate
        }
      }
    }
    lower[at(l, 1)] = 1
    variance[at(l, 1)] = spread
  }
  const breaks: number[] = []
  for (let j = k, last = n; j >= 2; j--) {
    const first = lower[at(last, j)]
    breaks.unshift(data[first - 1])
    last = first - 1
  }
  // The top class may be the maximum alone (an outlier is a class of its own), so a boundary may
  // equal the maximum here, though never the minimum.
  return breaks.filter((value, index) => value > min && (index === 0 || value > breaks[index - 1]))
}

/**
 * Standard deviation classes: one deviation wide and centred on the mean, so the legend reads as
 * distance from the average. An even count puts a boundary on the mean; an odd count lets the
 * middle class straddle it. Boundaries past the data are dropped, leaving the end classes to
 * hold the tails. Uses the population deviation.
 */
export function standardDeviationBreaks(sorted: readonly number[], classes: number): number[] {
  if (classes < 2 || sorted.length < 2) return []
  const mean = sorted.reduce((total, value) => total + value, 0) / sorted.length
  const deviation = Math.sqrt(sorted.reduce((total, value) => total + (value - mean) ** 2, 0) / sorted.length)
  if (!(deviation > 0)) return []
  return insideAscending(
    Array.from({ length: classes - 1 }, (_, index) => mean + (index + 1 - classes / 2) * deviation),
    sorted[0],
    sorted[sorted.length - 1],
  )
}

/**
 * Geometric classes: each boundary a constant multiple of the one before, for a column whose
 * values span orders of magnitude (areas, populations). Needs a positive minimum; returns `null`
 * otherwise, and the caller falls back to equal intervals.
 */
export function geometricBreaks(sorted: readonly number[], classes: number): number[] | null {
  if (classes < 2 || sorted.length < 2) return []
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  if (!(min > 0)) return null
  if (min === max) return []
  const ratio = (max / min) ** (1 / classes)
  return insideAscending(
    Array.from({ length: classes - 1 }, (_, index) => min * ratio ** (index + 1)),
    min,
    max,
  )
}
