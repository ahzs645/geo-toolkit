/**
 * A hatch as a saved recipe: everything needed to draw the same strokes again, in a project file,
 * on another map or in another program. A recipe is versioned data; reading one checks every value
 * and refuses what it cannot draw rather than quietly substituting a default.
 *
 * Three inputs decide where a hatch is painted, and the recipe is only the first:
 * - the **pattern field** (this recipe): how strokes bend, how dense they are, where the field starts;
 * - the **coverage**: where the treatment is chosen to apply, e.g. a forest region;
 * - the **land mask**: where paint is physically allowed (coastline, islands, lake holes).
 * The painted area is coverage ∩ land. The coastline clips the strokes; it never steers them.
 * No DOM or network access.
 */
import {
  DEFAULT_ORGANIC_HATCH,
  ORGANIC_HATCH_LIMITS,
  organicHatchStrokes,
  type HatchWindow,
  type OrganicHatchOptions,
  type OrganicHatchStroke,
} from './organic-hatch.js'
import { DEFAULT_PATCH_HATCH, PATCH_HATCH_LIMITS, patchHatchStrokes, type PatchHatchOptions } from './patch-hatch.js'

/** Version 1 recipes draw the contour field; version 2 names its `style`, and only it can say `patch`. */
export const ORGANIC_HATCH_RECIPE_VERSION = 1
export const PATCH_HATCH_RECIPE_VERSION = 2

/** The patch field's own settings (`patch-hatch.ts`). */
export type PatchSettings = Pick<PatchHatchOptions, 'patchSize' | 'lean' | 'leanBias' | 'seam'>

export interface OrganicHatchRecipe extends OrganicHatchOptions {
  type: 'organic-hatch'
  version: typeof ORGANIC_HATCH_RECIPE_VERSION | typeof PATCH_HATCH_RECIPE_VERSION
  /**
   * `contour` (version 1 and the default): one continuous banded field. `patch`: the field drawn
   * patch by patch, as the page 8 reference is (`patch-hatch.ts`), with `patch` settings.
   */
  style?: 'contour' | 'patch'
  patch?: PatchSettings
  /** Lower-case `#rrggbb`. */
  color: string
  /** Stroke opacity, 0–1, applied to the hatch as one layer so crossing strokes do not darken. */
  opacity: number
  /**
   * Where the field's origin sits, in output units (points on a page, pixels on an artboard).
   * Every area and chunk drawn with this recipe shares it, so neighbours meet without a seam.
   */
  origin: [number, number]
  /** Output units per pattern unit: 0.5 draws the strokes half as long, wide and far apart. */
  scale: number
}

/** The range of `scale`. */
export const ORGANIC_HATCH_SCALE_LIMITS = Object.freeze({ min: 0.05, max: 20 })

const HEX = /^#[0-9a-f]{6}$/i

/**
 * A recipe from partial values, filling the rest from the default hatch of its style. Values are
 * not checked. A contour recipe is version 1, with no `style`; a patch recipe is version 2.
 */
export function organicHatchRecipe(
  values: Partial<Omit<OrganicHatchRecipe, 'type' | 'version' | 'patch'>> & { patch?: Partial<PatchSettings> } = {},
): OrganicHatchRecipe {
  if (values.style === 'patch') {
    const { patchSize, lean, leanBias, seam, ...rest } = DEFAULT_PATCH_HATCH
    return {
      type: 'organic-hatch',
      version: PATCH_HATCH_RECIPE_VERSION,
      ...rest,
      color: '#bcc454',
      opacity: 1,
      origin: [0, 0],
      scale: 1,
      ...values,
      style: 'patch',
      patch: { patchSize, lean, leanBias, seam, ...values.patch },
    }
  }
  const contour: Partial<OrganicHatchRecipe> = { ...values, patch: undefined }
  delete contour.style
  delete contour.patch
  return {
    type: 'organic-hatch',
    version: ORGANIC_HATCH_RECIPE_VERSION,
    ...DEFAULT_ORGANIC_HATCH,
    color: '#bcc454',
    opacity: 1,
    origin: [0, 0],
    scale: 1,
    ...contour,
  }
}

function numberIn(raw: Record<string, unknown>, key: string, label: string, range: { min: number; max: number }) {
  const value = raw[key]
  if (typeof value !== 'number' || !Number.isFinite(value) || value < range.min || value > range.max)
    throw new Error(`${label} ${key} must be a number from ${range.min} to ${range.max}.`)
  return value
}

/**
 * A recipe read from a file. Unknown types and versions, colours that are not `#rrggbb` and
 * numbers outside the limits are errors with a message. Absent optional fields (`opacity`,
 * `origin`, `scale`) take their defaults.
 */
export function parseOrganicHatchRecipe(value: unknown, label = 'Hatch pattern'): OrganicHatchRecipe {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  const raw = value as Record<string, unknown>
  if (raw.type !== 'organic-hatch') throw new Error(`${label} has an unknown pattern type.`)
  if (raw.version !== ORGANIC_HATCH_RECIPE_VERSION && raw.version !== PATCH_HATCH_RECIPE_VERSION)
    throw new Error(
      `${label} is version ${String(raw.version)}; this reader understands versions ${ORGANIC_HATCH_RECIPE_VERSION} and ${PATCH_HATCH_RECIPE_VERSION}.`,
    )
  if (raw.version === ORGANIC_HATCH_RECIPE_VERSION && (raw.style !== undefined || raw.patch !== undefined))
    throw new Error(`${label} names a style, which needs version ${PATCH_HATCH_RECIPE_VERSION}.`)
  if (raw.version === PATCH_HATCH_RECIPE_VERSION && raw.style !== 'contour' && raw.style !== 'patch')
    throw new Error(`${label} has an unknown style; version 2 draws "contour" or "patch".`)
  const style = raw.style === 'patch' ? 'patch' : 'contour'
  const L = style === 'patch' ? PATCH_HATCH_LIMITS : ORGANIC_HATCH_LIMITS
  const seed = numberIn(raw, 'seed', label, L.seed)
  if (!Number.isInteger(seed)) throw new Error(`${label} seed must be a whole number.`)
  if (typeof raw.color !== 'string' || !HEX.test(raw.color)) throw new Error(`${label} colour must use #RRGGBB.`)
  let patch: PatchSettings | undefined
  if (style === 'patch') {
    if (!raw.patch || typeof raw.patch !== 'object' || Array.isArray(raw.patch))
      throw new Error(`${label} needs its patch settings.`)
    const settings = raw.patch as Record<string, unknown>
    const P = PATCH_HATCH_LIMITS
    patch = {
      patchSize: numberIn(settings, 'patchSize', label, P.patchSize),
      lean: numberIn(settings, 'lean', label, P.lean),
      leanBias: numberIn(settings, 'leanBias', label, P.leanBias),
      seam: numberIn(settings, 'seam', label, P.seam),
    }
  }
  const recipe = organicHatchRecipe({
    ...(style === 'patch' ? { style, patch } : {}),
    seed,
    spacing: numberIn(raw, 'spacing', label, L.spacing),
    bandHeight: numberIn(raw, 'bandHeight', label, L.bandHeight),
    strokeWidth: numberIn(raw, 'strokeWidth', label, L.strokeWidth),
    curvature: numberIn(raw, 'curvature', label, L.curvature),
    color: raw.color.toLowerCase(),
  })
  // A version 2 recipe that says contour keeps saying so.
  if (raw.version === PATCH_HATCH_RECIPE_VERSION && style === 'contour') {
    recipe.version = PATCH_HATCH_RECIPE_VERSION
    recipe.style = 'contour'
  }
  if (raw.opacity !== undefined) recipe.opacity = numberIn(raw, 'opacity', label, { min: 0, max: 1 })
  if (raw.scale !== undefined) recipe.scale = numberIn(raw, 'scale', label, ORGANIC_HATCH_SCALE_LIMITS)
  if (raw.origin !== undefined) {
    const origin = raw.origin
    if (
      !Array.isArray(origin) ||
      origin.length !== 2 ||
      !origin.every((v) => typeof v === 'number' && Number.isFinite(v))
    )
      throw new Error(`${label} origin must be two numbers.`)
    recipe.origin = [origin[0], origin[1]]
  }
  return recipe
}

/** The patch generator's options a patch recipe draws with. */
export const recipePatchOptions = (recipe: OrganicHatchRecipe): PatchHatchOptions => ({
  ...DEFAULT_PATCH_HATCH,
  seed: recipe.seed,
  spacing: recipe.spacing,
  bandHeight: recipe.bandHeight,
  strokeWidth: recipe.strokeWidth,
  curvature: recipe.curvature,
  ...recipe.patch,
})

/**
 * The recipe's field strokes meeting `window`, in pattern units (the field's own coordinates,
 * before origin and scale), by its style.
 */
export function recipeFieldStrokes(
  recipe: OrganicHatchRecipe,
  window: HatchWindow,
  limits?: { maxStrokes?: number },
): OrganicHatchStroke[] {
  return recipe.style === 'patch'
    ? patchHatchStrokes(window, recipePatchOptions(recipe), limits).strokes
    : organicHatchStrokes(window, recipeHatchOptions(recipe), limits).strokes
}

/** The generator options a recipe draws with. */
export const recipeHatchOptions = (recipe: OrganicHatchRecipe): OrganicHatchOptions => ({
  seed: recipe.seed,
  spacing: recipe.spacing,
  bandHeight: recipe.bandHeight,
  strokeWidth: recipe.strokeWidth,
  curvature: recipe.curvature,
})

/**
 * The recipe's strokes meeting `window`, in output units: the field placed at the recipe's
 * origin and scale. Density is fixed by the recipe; see `organicHatchStrokes` for the limit.
 */
export function recipeStrokes(
  recipe: OrganicHatchRecipe,
  window: HatchWindow,
  limits?: { maxStrokes?: number },
): OrganicHatchStroke[] {
  const [ox, oy] = recipe.origin
  const s = recipe.scale
  const strokes = recipeFieldStrokes(
    recipe,
    { x: (window.x - ox) / s, y: (window.y - oy) / s, width: window.width / s, height: window.height / s },
    limits,
  )
  const at = (p: { x: number; y: number }) => ({ x: ox + p.x * s, y: oy + p.y * s })
  return strokes.map((stroke) => ({
    start: at(stroke.start),
    c1: at(stroke.c1),
    c2: at(stroke.c2),
    end: at(stroke.end),
    width: stroke.width * s,
  }))
}

export type OrganicHatchPresetId =
  | 'northern-bc-reference'
  | 'page-8-reference'
  | 'fine-forest'
  | 'broad-waves'
  | 'calm-lines'

/**
 * Art-directed starting points. `northern-bc-reference` is the Rainforest to Rockies field at its
 * artboard size. `page-8-reference` is the patch field fitted to the northern hatch of the brand
 * guidelines' page 8 at its 1536 px width: strokes 3 apart, 8.6 long, bands of 11, a third of the
 * area inked, leaning a median 6° and a tenth of them past 26°. The others are general treatments
 * sized for points on a printed sheet.
 */
export const ORGANIC_HATCH_PRESETS: Readonly<
  Record<OrganicHatchPresetId, { label: string; recipe: OrganicHatchRecipe }>
> = Object.freeze({
  'northern-bc-reference': {
    label: 'Northern BC reference',
    recipe: organicHatchRecipe({ color: '#bcc454' }),
  },
  'page-8-reference': {
    label: 'Page 8 reference (patches)',
    recipe: organicHatchRecipe({ style: 'patch', color: '#bcc454' }),
  },
  'fine-forest': {
    label: 'Fine forest',
    recipe: organicHatchRecipe({
      spacing: 2.5,
      bandHeight: 11,
      strokeWidth: 1.2,
      curvature: 8,
      color: '#4d7c0f',
      scale: 0.75,
    }),
  },
  'broad-waves': {
    label: 'Broad waves',
    recipe: organicHatchRecipe({
      seed: 21,
      spacing: 3.5,
      bandHeight: 18,
      strokeWidth: 1.4,
      curvature: 16,
      color: '#3f6212',
      scale: 0.75,
    }),
  },
  'calm-lines': {
    label: 'Calm lines',
    recipe: organicHatchRecipe({
      seed: 5,
      spacing: 3,
      bandHeight: 12,
      strokeWidth: 1.1,
      curvature: 2,
      color: '#57534e',
      scale: 0.75,
    }),
  },
})
