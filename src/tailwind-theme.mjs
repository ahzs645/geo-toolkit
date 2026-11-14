/**
 * The toolkit's Tailwind theme: the one list of design token names.
 *
 * The toolkit's own build and a host's Tailwind config both extend this, so a
 * class such as `rounded` or `text-warning` means the same thing in package and
 * host markup. Every value reads a CSS variable that `styles.css` declares on
 * `.geo-toolkit`, so a host restyles everything by setting variables, never by
 * editing class names.
 */

const color = (name) => `hsl(var(--${name}))`

// A status colour has four roles: `text-warning` for text and icons on the page
// background, and `bg-warning-surface border-warning-border text-warning-foreground`
// for a tinted box such as `InlineAlert`.
const status = (name) => ({
  DEFAULT: color(name),
  foreground: color(`${name}-foreground`),
  surface: color(`${name}-surface`),
  border: color(`${name}-border`),
})

// Palette families a host theme can recolour. Pages and toolkit parts write their accents as
// fixed Tailwind classes (`text-sky-700`, `focus:ring-cyan-500`, `dark:hover:bg-slate-800/60`),
// a different family per page. Each shade below reads a variable and falls back to Tailwind's
// own value, so nothing changes until a host sets the variables; then every accent family draws
// from one ramp (`--palette-tint-50` … `--palette-tint-950`) and every neutral family from
// another (`--palette-neutral-*`). Values are `r g b` channels. Status and category families
// (red, amber, green, violet, …) are not listed and stay fixed. A subtree that uses a listed
// family as a category colour sets the variables back to `initial`.
const paletteShades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const themeable = (ramp, channels) =>
  Object.fromEntries(
    channels
      .split(', ')
      .map((rgb, index) => [
        paletteShades[index],
        `rgb(var(--palette-${ramp}-${paletteShades[index]}, ${rgb}) / <alpha-value>)`,
      ]),
  )

/** Tailwind's default values for the recolourable families, as `r g b` per shade from 50 to 950. */
export const themeablePalette = {
  tint: {
    sky: '240 249 255, 224 242 254, 186 230 253, 125 211 252, 56 189 248, 14 165 233, 2 132 199, 3 105 161, 7 89 133, 12 74 110, 8 47 73',
    blue: '239 246 255, 219 234 254, 191 219 254, 147 197 253, 96 165 250, 59 130 246, 37 99 235, 29 78 216, 30 64 175, 30 58 138, 23 37 84',
    cyan: '236 254 255, 207 250 254, 165 243 252, 103 232 249, 34 211 238, 6 182 212, 8 145 178, 14 116 144, 21 94 117, 22 78 99, 8 51 68',
    teal: '240 253 250, 204 251 241, 153 246 228, 94 234 212, 45 212 191, 20 184 166, 13 148 136, 15 118 110, 17 94 89, 19 78 74, 4 47 46',
    indigo:
      '238 242 255, 224 231 255, 199 210 254, 165 180 252, 129 140 248, 99 102 241, 79 70 229, 67 56 202, 55 48 163, 49 46 129, 30 27 75',
  },
  neutral: {
    slate:
      '248 250 252, 241 245 249, 226 232 240, 203 213 225, 148 163 184, 100 116 139, 71 85 105, 51 65 85, 30 41 59, 15 23 42, 2 6 23',
    gray: '249 250 251, 243 244 246, 229 231 235, 209 213 219, 156 163 175, 107 114 128, 75 85 99, 55 65 81, 31 41 55, 17 24 39, 3 7 18',
    zinc: '250 250 250, 244 244 245, 228 228 231, 212 212 216, 161 161 170, 113 113 122, 82 82 91, 63 63 70, 39 39 42, 24 24 27, 9 9 11',
    neutral:
      '250 250 250, 245 245 245, 229 229 229, 212 212 212, 163 163 163, 115 115 115, 82 82 82, 64 64 64, 38 38 38, 23 23 23, 10 10 10',
    stone:
      '250 250 249, 245 245 244, 231 229 228, 214 211 209, 168 162 158, 120 113 108, 87 83 78, 68 64 60, 41 37 36, 28 25 23, 12 10 9',
  },
}

/**
 * Families that are a status or category colour almost everywhere, but one page's accent
 * (a parks page in green, a census page in amber). Each reads its own variables
 * (`--palette-green-50` …), which nothing sets by default; a host sets them on that page's
 * panel alone, so the family follows its theme there and stays fixed everywhere else.
 */
export const pageAccentPalette = {
  green:
    '240 253 244, 220 252 231, 187 247 208, 134 239 172, 74 222 128, 34 197 94, 22 163 74, 21 128 61, 22 101 52, 20 83 45, 5 46 22',
  amber:
    '255 251 235, 254 243 199, 253 230 138, 252 211 77, 251 191 36, 245 158 11, 217 119 6, 180 83 9, 146 64 14, 120 53 15, 69 26 3',
}

const themeableColors = Object.fromEntries(
  Object.entries(themeablePalette).flatMap(([ramp, families]) =>
    Object.entries(families).map(([family, channels]) => [family, themeable(ramp, channels)]),
  ),
)
for (const [family, channels] of Object.entries(pageAccentPalette))
  themeableColors[family] = themeable(family, channels)

export const toolkitTheme = {
  // Also registered in `cn` (utils.ts), or tailwind-merge reads `text-2xs` as a
  // colour and drops it next to one. Add a name in both places.
  fontSize: {
    '3xs': '10px',
    '2xs': '11px',
  },
  zIndex: {
    menu: '1300',
    overlay: '1400',
    'workspace-menu': '1500',
    'workspace-popover': '1600',
    notification: '2200',
  },
  // Every step follows `--radius`, so one variable sets every corner. At the
  // default 0.5rem these are Tailwind's own sizes (4, 4, 6, 8, 12, 16 px). A
  // negative calc() clamps to 0, so `--radius: 0` squares every corner.
  borderRadius: {
    sm: 'calc(var(--radius) - 4px)',
    DEFAULT: 'calc(var(--radius) - 4px)',
    md: 'calc(var(--radius) - 2px)',
    lg: 'var(--radius)',
    xl: 'calc(var(--radius) + 4px)',
    '2xl': 'calc(var(--radius) + 8px)',
  },
  colors: {
    ...themeableColors,
    background: color('background'),
    foreground: color('foreground'),
    card: { DEFAULT: color('card'), foreground: color('card-foreground') },
    popover: { DEFAULT: color('popover'), foreground: color('popover-foreground') },
    primary: { DEFAULT: color('primary'), foreground: color('primary-foreground') },
    secondary: { DEFAULT: color('secondary'), foreground: color('secondary-foreground') },
    muted: { DEFAULT: color('muted'), foreground: color('muted-foreground') },
    accent: { DEFAULT: color('accent'), foreground: color('accent-foreground') },
    destructive: { DEFAULT: color('destructive'), foreground: color('destructive-foreground') },
    warning: status('warning'),
    danger: status('danger'),
    success: status('success'),
    info: status('info'),
    // UI state colours a host theme can recolour: a selected row's fill (whose alpha is its own
    // token, 0.3 in the dark theme), its edge and focus ring; text links; the band round a map.
    selected: {
      DEFAULT: 'hsl(var(--selected) / var(--selected-alpha))',
      border: color('selected-border'),
      focus: color('selected-focus'),
    },
    link: { DEFAULT: color('link'), hover: color('link-hover') },
    'map-surround': color('map-surround'),
    border: color('border'),
    input: color('input'),
    ring: color('ring'),
    chart: {
      1: color('chart-1'),
      2: color('chart-2'),
      3: color('chart-3'),
      4: color('chart-4'),
      5: color('chart-5'),
    },
  },
}

/** `touch:` targets coarse pointers (phones, tablets) so controls can grow to a finger-sized hit area. */
export function touchVariant({ addVariant }) {
  addVariant('touch', '@media (pointer: coarse)')
}
