/**
 * Rows that share a comparison scope (for example a period and a measure
 * definition) with any shown row. Size proportional symbols from this cohort,
 * not from the shown rows, so a filter that hides comparators cannot make the
 * remaining symbols look larger. With no scope fields the cohort is every row.
 */
export function cohortRows<TRow extends object>(
  all: readonly TRow[],
  shown: readonly TRow[],
  scopeFields: readonly (keyof TRow)[],
): TRow[] {
  const fields = [...new Set(scopeFields)]
  if (!fields.length) return [...all]
  const key = (row: TRow) => JSON.stringify(fields.map((field) => row[field]))
  const scopes = new Set(shown.map(key))
  return all.filter((row) => scopes.has(key(row)))
}

export interface AreaRadiusScaleOptions {
  /** Radius, in pixels, of the largest absolute value. */
  maxRadius: number
  /**
   * Smallest radius for a nonzero value, keeping tiny values visible. It
   * distorts area ratios below that size; zero and missing values stay 0.
   */
  minRadius?: number
}

export interface AreaRadiusScale {
  /** Largest absolute finite value; 0 when there is none. */
  maximum: number
  /** Radius whose circle area is proportional to the absolute value. */
  radius(value: number | null | undefined): number
}

/** Circle radius from area: `maxRadius * sqrt(|value| / maximum)`. */
export function areaRadiusScale(
  values: Iterable<number | null | undefined>,
  { maxRadius, minRadius = 0 }: AreaRadiusScaleOptions,
): AreaRadiusScale {
  let maximum = 0
  for (const value of values)
    if (typeof value === 'number' && Number.isFinite(value)) maximum = Math.max(maximum, Math.abs(value))
  return {
    maximum,
    radius(value) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value === 0 || maximum === 0) return 0
      return Math.max(minRadius, maxRadius * Math.sqrt(Math.abs(value) / maximum))
    },
  }
}
