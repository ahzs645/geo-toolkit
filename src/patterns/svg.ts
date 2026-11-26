/**
 * A hatch as an editable SVG layer: the recipe's strokes, clipped to the chosen coverage and
 * then to dry land. Coverage shapes are sibling paths of one clip, so where two coverage areas
 * overlap the field is still drawn once, never twice as dark; the land clip sits outside it with
 * the even-odd rule, so islands are painted and lakes are not. No DOM or network access.
 */
import { formatHatchNumber, organicHatchStrokePath } from './organic-hatch.js'
import { recipeStrokes, type OrganicHatchRecipe } from './recipe.js'

export interface OrganicHatchSvgLayerOptions {
  recipe: OrganicHatchRecipe
  /** The area to generate, output units; usually the artboard or the coverage's bounds. */
  window: { x: number; y: number; width: number; height: number }
  /** Dry land as SVG path data (rings; holes for inland water). Omit to paint without a land mask. */
  land?: string
  /** The chosen coverage areas as SVG path data, one per area. Omit to cover the whole window. */
  coverage?: readonly string[]
  /** Prefix for the clip ids, unique in the document. */
  id: string
  maxStrokes?: number
}

const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The layer as one `<g>`: `<defs>` with its clips, then the strokes grouped by width (each stroke
 * still its own path, so it stays editable). Records the recipe on the group for round-tripping.
 */
export function organicHatchSvgLayer({
  recipe,
  window,
  land,
  coverage,
  id,
  maxStrokes,
}: OrganicHatchSvgLayerOptions): string {
  const strokes = recipeStrokes(recipe, window, { maxStrokes })
  const byWidth = new Map<string, string[]>()
  for (const stroke of strokes) {
    const width = formatHatchNumber(stroke.width)
    const list = byWidth.get(width) ?? []
    list.push(`<path d="${organicHatchStrokePath(stroke)}"/>`)
    byWidth.set(width, list)
  }
  const safeId = escapeAttribute(id)
  const defs: string[] = []
  let open = ''
  let close = ''
  if (land) {
    defs.push(`<clipPath id="${safeId}-land"><path d="${escapeAttribute(land)}" clip-rule="evenodd"/></clipPath>`)
    open += `<g clip-path="url(#${safeId}-land)">`
    close = '</g>' + close
  }
  if (coverage?.length) {
    defs.push(
      `<clipPath id="${safeId}-coverage">${coverage.map((d) => `<path d="${escapeAttribute(d)}"/>`).join('')}</clipPath>`,
    )
    open += `<g clip-path="url(#${safeId}-coverage)">`
    close = '</g>' + close
  }
  const groups = [...byWidth]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([width, paths]) => `<g stroke-width="${width}">${paths.join('')}</g>`)
    .join('')
  const opacity = recipe.opacity < 1 ? ` opacity="${formatHatchNumber(recipe.opacity)}"` : ''
  return (
    `<g id="${safeId}" data-pattern="${recipe.type}" data-pattern-version="${recipe.version}" ` +
    `data-recipe="${escapeAttribute(JSON.stringify(recipe))}" data-stroke-count="${strokes.length}">` +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    open +
    `<g fill="none" stroke="${recipe.color}" stroke-linecap="round"${opacity}>${groups}</g>` +
    close +
    '</g>'
  )
}
