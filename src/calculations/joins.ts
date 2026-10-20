export type JoinCode = string

export type JoinOf<TRow> = (row: TRow) => JoinCode | null

export interface CrosswalkResolverOptions {
  /** Reviewed source-code to target-code links, checked first. */
  links?: Iterable<readonly [string, string]> | ReadonlyMap<string, string> | Readonly<Record<string, string>>
  /** Target codes a source may already use natively; joined unchanged. */
  native?: Iterable<string>
}

/**
 * Resolves a source key to a target geography code: a reviewed crosswalk link
 * first, then a native code. Anything else, including blank keys, is
 * unmatched (`null`) rather than guessed.
 */
export function crosswalkResolver({ links, native }: CrosswalkResolverOptions): (key: unknown) => JoinCode | null {
  const linked = new Map<string, string>(
    !links ? [] : Symbol.iterator in links ? (links as Iterable<readonly [string, string]>) : Object.entries(links),
  )
  const nativeCodes = new Set(native ?? [])
  return (key) => {
    if (key === null || key === undefined || key === '') return null
    const code = String(key)
    return linked.get(code) || (nativeCodes.has(code) ? code : null)
  }
}

/** Rows grouped by join code, in first-seen order. Unjoined rows are omitted. */
export function groupByJoin<TRow>(rows: readonly TRow[], joinOf: JoinOf<TRow>): Map<JoinCode, TRow[]> {
  const groups = new Map<JoinCode, TRow[]>()
  for (const row of rows) {
    const code = joinOf(row)
    if (!code) continue
    const group = groups.get(code)
    if (group) group.push(row)
    else groups.set(code, [row])
  }
  return groups
}

export interface GroupValueOptions {
  /** True only when the metric is declared additive, so several rows may be summed. */
  allowsSum: boolean
}

/**
 * The one value a joined place can show. A single finite value is shown as is.
 * Several values are summed only for an additive metric; otherwise they are
 * ambiguous. Any missing or nonfinite input withholds the value.
 */
export function groupValue(values: readonly unknown[], { allowsSum }: GroupValueOptions): number | null {
  if (!values.length) return null
  if (!values.every((value): value is number => typeof value === 'number' && Number.isFinite(value))) return null
  if (values.length === 1) return values[0]
  return allowsSum ? values.reduce((total, value) => total + value, 0) : null
}

export interface JoinDiagnosticsOptions<TRow> extends GroupValueOptions {
  joinOf: JoinOf<TRow>
  /** Value of the mapped metric, used to count matched rows with no value. */
  valueOf: (row: TRow) => unknown
  /** Codes present in the loaded geometry. Omit until it has loaded. */
  available?: ReadonlySet<JoinCode> | null
}

export interface JoinDiagnostics {
  total: number
  /** Rows that join to available geometry and can be shown. */
  matched: number
  /** Matched rows whose metric value is missing or nonfinite. */
  missing: number
  /** Rows with no join code, or a code absent from the geometry. */
  unmatched: number
  /** Rows sharing a code with another row when the metric cannot be summed. */
  ambiguous: number
}

/** Counts how source rows reach the map, consistent with `groupValue`. */
export function joinDiagnostics<TRow>(
  rows: readonly TRow[],
  { joinOf, valueOf, available, allowsSum }: JoinDiagnosticsOptions<TRow>,
): JoinDiagnostics {
  const codes = rows.map(joinOf)
  const counts = new Map<JoinCode, number>()
  for (const code of codes) if (code) counts.set(code, (counts.get(code) ?? 0) + 1)
  const result: JoinDiagnostics = { total: rows.length, matched: 0, missing: 0, unmatched: 0, ambiguous: 0 }
  rows.forEach((row, index) => {
    const code = codes[index]
    if (!code || (available && !available.has(code))) result.unmatched++
    else if ((counts.get(code) ?? 0) > 1 && !allowsSum) result.ambiguous++
    else {
      result.matched++
      const value = valueOf(row)
      if (typeof value !== 'number' || !Number.isFinite(value)) result.missing++
    }
  })
  return result
}

/** Circle area encodes magnitude, so it cannot show a signed value. */
export function canEncodeAsArea(values: Iterable<unknown>): boolean {
  for (const value of values) if (typeof value === 'number' && value < 0) return false
  return true
}
