import { useEffect, useId, useMemo } from 'react'
import * as MapLibreGLRuntime from 'maplibre-gl'
import type { HatchTileAreas } from '../../patterns/hatch-tiles.js'
import type { OrganicHatchRecipe } from '../../patterns/recipe.js'
import { createHatchTileRenderer, type HatchTileRenderer } from './hatch-tile-renderer.js'
import { MapRasterLayer } from './raster.js'

export type MapHatchLayerProps = {
  /** The saved hatch. Its pattern units are CSS pixels at each tile's zoom, times `recipe.scale`. */
  recipe: OrganicHatchRecipe
  /**
   * Where paint goes, as longitude and latitude rings: `land` (even-odd) intersected with
   * `coverage` (a union of polygons). Keep the same object while the areas do not change: a new
   * one is sent to the worker and projected again.
   */
  areas: HatchTileAreas
  /**
   * The ground point the field starts from, `[longitude, latitude]`; every tile measures from it,
   * so tiles meet without a seam. Default: the north-west corner of the land.
   */
  anchor?: [number, number]
  /**
   * The last zoom drawn as its own field (default 13 for the patch style, 10 for contour). The
   * strokes keep their size on screen up to it; past it the map enlarges that level's tiles and
   * the strokes grow with the ground. The contour field walks from the anchor, so its cost grows
   * with distance at high zooms; the patch field's does not.
   */
  maxFieldZoom?: number
  /** Least zoom at which the hatch shows (default 0). */
  minZoom?: number
  /** CSS pixels a side of a tile (default 512). */
  tileSize?: number
  opacity?: number
  visible?: boolean
  layerOrder?: number
  beforeId?: string
  /** Stable id for the source and layer, for hosts that look them up. Generated when omitted. */
  id?: string
  /** Crossfade of arriving tiles, ms (default 150). */
  fadeDuration?: number
}

export const HATCH_TILE_PROTOCOL = 'pgmaps-hatch'

type LayerEntry = {
  renderer: HatchTileRenderer
  areas: string
  recipe: OrganicHatchRecipe
  anchor: [number, number]
  tileSize: number
  pixelRatio: number
}
const layers = new Map<string, LayerEntry>()
const TILE_PATH = new RegExp(`^${HATCH_TILE_PROTOCOL}://([^/]+)/[^/]+/(\\d+)/(\\d+)/(\\d+)$`)

let shared: { renderer: HatchTileRenderer; users: number } | null = null
function retainRenderer(): HatchTileRenderer {
  if (!shared) {
    let worker: Worker | null = null
    try {
      worker =
        typeof Worker === 'undefined'
          ? null
          : new Worker(new URL('./hatch-tiles.worker.js', import.meta.url), { type: 'module' })
    } catch {
      worker = null
    }
    shared = { renderer: createHatchTileRenderer(worker), users: 0 }
  }
  shared.users++
  return shared.renderer
}
function releaseRenderer() {
  if (!shared || --shared.users > 0) return
  shared.renderer.dispose()
  shared = null
}

async function loadTile(params: { url: string }, abort: AbortController): Promise<{ data: ImageBitmap | null }> {
  const match = TILE_PATH.exec(params.url)
  if (!match) throw new Error(`Not a hatch tile: ${params.url}`)
  const entry = layers.get(match[1])
  if (!entry) return { data: null }
  const [z, x, y] = match.slice(2).map(Number)
  const image = await entry.renderer.render(
    {
      areas: entry.areas,
      recipe: entry.recipe,
      anchor: entry.anchor,
      z,
      x,
      y,
      tileSize: entry.tileSize,
      pixelRatio: entry.pixelRatio,
    },
    abort.signal,
  )
  if (!image) return { data: null }
  const pixels = new ImageData(image.data as Uint8ClampedArray<ArrayBuffer>, image.width, image.height)
  return { data: await createImageBitmap(pixels) }
}

let registered = false
function registerProtocol() {
  if (registered) return
  registered = true
  MapLibreGLRuntime.addProtocol(
    HATCH_TILE_PROTOCOL,
    loadTile as unknown as Parameters<typeof MapLibreGLRuntime.addProtocol>[1],
  )
}

/** A short stable hash, so the tile URL changes exactly when the drawing does. */
function hash(value: unknown): string {
  const text = JSON.stringify(value)
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

let areaKeys = new WeakMap<HatchTileAreas, string>()
let nextAreaKey = 1
const areaKey = (areas: HatchTileAreas) => {
  let key = areaKeys.get(areas)
  if (!key) {
    key = `a${nextAreaKey++}`
    areaKeys.set(areas, key)
  }
  return key
}
/** For tests: forget which areas were sent. */
export function resetHatchAreaKeys() {
  areaKeys = new WeakMap()
}

/** The north-west corner of the land, rounded so a small edit to the land keeps the field still. */
export function hatchAnchor(areas: HatchTileAreas): [number, number] {
  let west = Infinity
  let north = -Infinity
  for (const ring of areas.land)
    for (const [lng, lat] of ring) {
      if (lng < west) west = lng
      if (lat > north) north = lat
    }
  return Number.isFinite(west) ? [Math.floor(west * 10) / 10, Math.ceil(north * 10) / 10] : [0, 0]
}

/** The land's longitude and latitude box, which limits tile requests. */
function hatchBounds(areas: HatchTileAreas): [number, number, number, number] | undefined {
  let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const ring of areas.land)
    for (const [lng, lat] of ring) {
      west = Math.min(west, lng)
      east = Math.max(east, lng)
      south = Math.min(south, lat)
      north = Math.max(north, lat)
    }
  return Number.isFinite(west) ? [west, south, east, north] : undefined
}

/**
 * A hatch as map tiles: each a window of the recipe's open field, drawn in a worker and inked only on
 * the areas, so tiles meet without seams and a pan shows more of the same field. MapLibre asks for
 * tiles on every frame of a move, keeps loaded ones drawn while others arrive, and aborts those that
 * leave the view, which drops their job before it is drawn.
 */
export function MapHatchLayer({
  recipe,
  areas,
  anchor,
  maxFieldZoom,
  minZoom = 0,
  tileSize = 512,
  opacity = 1,
  visible = true,
  layerOrder,
  beforeId,
  id,
  fadeDuration = 150,
}: MapHatchLayerProps) {
  const uid = useId().replace(/:/g, '')
  const layerKey = id ?? `hatch-${uid}`
  const pixelRatio = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1)
  const key = areaKey(areas)
  const fieldAnchor = useMemo(() => anchor ?? hatchAnchor(areas), [anchor, areas])
  const bounds = useMemo(() => hatchBounds(areas), [areas])
  const version = hash([key, recipe, fieldAnchor, tileSize, pixelRatio])

  useEffect(() => {
    registerProtocol()
    const renderer = retainRenderer()
    renderer.setAreas(key, areas)
    return () => {
      renderer.dropAreas(key)
      releaseRenderer()
    }
  }, [key, areas])

  useEffect(() => {
    if (!shared) return
    layers.set(layerKey, { renderer: shared.renderer, areas: key, recipe, anchor: fieldAnchor, tileSize, pixelRatio })
    return () => {
      layers.delete(layerKey)
    }
  }, [layerKey, key, recipe, fieldAnchor, tileSize, pixelRatio])

  return (
    <MapRasterLayer
      id={id}
      tiles={[`${HATCH_TILE_PROTOCOL}://${layerKey}/${version}/{z}/{x}/{y}`]}
      tileSize={tileSize}
      minZoom={minZoom}
      maxZoom={maxFieldZoom ?? (recipe.style === 'patch' ? 13 : 10)}
      opacity={opacity}
      visible={visible}
      layerOrder={layerOrder}
      beforeId={beforeId}
      fadeDuration={fadeDuration}
      {...(bounds ? { bounds } : {})}
    />
  )
}
