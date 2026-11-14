type ColorValue = string | { [key: string]: ColorValue }

export const toolkitTheme: {
  fontSize: Record<string, string>
  zIndex: Record<string, string>
  borderRadius: Record<string, string>
  colors: Record<string, ColorValue>
}

/** Tailwind's default `r g b` values, shade 50 to 950, for the families a host theme can recolour. */
export const themeablePalette: Record<'tint' | 'neutral', Record<string, string>>

/** Families one page may use as its accent; each shade reads `--palette-<family>-<shade>`. */
export const pageAccentPalette: Record<string, string>

export function touchVariant(api: { addVariant: (name: string, definition: string) => void }): void
