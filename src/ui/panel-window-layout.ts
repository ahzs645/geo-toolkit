export type PanelWindowMode = 'window' | 'tab'

/** Serializable placement only; the host retains the panel's project and editing state. */
export interface PanelWindowLayout {
  slot: string
  mode: PanelWindowMode
  width?: number
  height?: number
  left?: number
  top?: number
}

/** Strict, DOM-free parsing for saved layouts and host-authored configuration. */
export function parsePanelWindowLayouts(value: unknown): PanelWindowLayout[] {
  if (!Array.isArray(value) || value.length > 30) throw Error('Panel windows must be a list of at most 30 panels.')
  const seen = new Set<string>()
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw Error('Each panel window must be an object.')
    const source = entry as Record<string, unknown>
    if (Object.keys(source).some((key) => !['slot', 'mode', 'width', 'height', 'left', 'top'].includes(key)))
      throw Error('Unknown panel window setting.')
    if (typeof source.slot !== 'string' || !source.slot.trim() || source.slot.length > 200 || seen.has(source.slot))
      throw Error('Panel window slots must be nonempty and unique.')
    seen.add(source.slot)
    if (source.mode !== 'window' && source.mode !== 'tab') throw Error('Panel window mode must be window or tab.')
    const placement: PanelWindowLayout = { slot: source.slot, mode: source.mode }
    for (const key of ['width', 'height', 'left', 'top'] as const) {
      const number = source[key]
      if (number === undefined) continue
      const minimum = key === 'width' ? 320 : key === 'height' ? 200 : -100_000
      const maximum = key === 'width' || key === 'height' ? 10_000 : 100_000
      if (typeof number !== 'number' || !Number.isInteger(number) || number < minimum || number > maximum)
        throw Error(`Panel window ${key} must be an integer between ${minimum} and ${maximum}.`)
      placement[key] = number
    }
    return placement
  })
}
