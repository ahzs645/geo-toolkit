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
