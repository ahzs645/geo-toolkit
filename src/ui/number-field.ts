export interface NumberFieldPolicy {
  min?: number
  max?: number
  /** Clamp immediately, on blur/Enter, or leave bounds advisory. */
  clampOn?: 'change' | 'commit' | 'never'
  /** An empty required input is restored by default; zero is opt-in. */
  blankValue?: 'restore' | 'zero'
  nullable?: boolean
  /** Some imported forms intentionally clear an invalid value rather than retaining it. */
  invalidValue?: 'restore' | 'null'
}

export type NumberFieldResult = { accepted: true; value: number | null } | { accepted: false }

/** Parse without conflating an unset measurement, incomplete draft and zero. */
export function resolveNumberFieldInput(
  text: string,
  phase: 'change' | 'commit',
  {
    min = -Infinity,
    max = Infinity,
    clampOn = 'commit',
    blankValue = 'restore',
    nullable = false,
    invalidValue = 'restore',
  }: NumberFieldPolicy = {},
): NumberFieldResult {
  if (!text.trim()) {
    if (nullable) return { accepted: true, value: null }
    if (blankValue !== 'zero') return { accepted: false }
  }
  const value = Number(text)
  if (!Number.isFinite(value))
    return nullable && invalidValue === 'null' ? { accepted: true, value: null } : { accepted: false }
  const shouldClamp = clampOn === 'change' || (clampOn === 'commit' && phase === 'commit')
  if (shouldClamp) return { accepted: true, value: Math.min(max, Math.max(min, value)) }
  if (clampOn === 'commit' && (value < min || value > max)) return { accepted: false }
  return { accepted: true, value }
}

/** Numeric arrow steps deliberately do not snap already-entered measurements. */
export function stepNumberFieldValue(
  value: number | null,
  direction: 1 | -1,
  {
    step = 1,
    min = -Infinity,
    max = Infinity,
    precision = 6,
  }: NumberFieldPolicy & {
    step?: number
    precision?: number
  } = {},
): number {
  const current = value ?? Math.max(min, Math.min(max, 0))
  const next = current + direction * step
  // Match native number-input arrows even when typed bounds are advisory.
  return Number(Math.max(min, Math.min(max, next)).toFixed(precision))
}
