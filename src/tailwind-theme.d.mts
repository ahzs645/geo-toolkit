type ColorValue = string | { [key: string]: ColorValue }

export const toolkitTheme: {
  fontSize: Record<string, string>
  zIndex: Record<string, string>
  borderRadius: Record<string, string>
  colors: Record<string, ColorValue>
}

export function touchVariant(api: { addVariant: (name: string, definition: string) => void }): void
