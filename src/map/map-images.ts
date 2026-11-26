import type * as MapLibreGL from 'maplibre-gl'

/** A style image a layer paints with, such as a `fill-pattern` tile. */
export interface MapStyleImage {
  /** Unique per drawing: change it whenever the pixels change. */
  id: string
  width: number
  height: number
  /** Straight-alpha RGBA, row-major from the top-left. */
  data: Uint8ClampedArray | Uint8Array
  /** Device pixels per CSS pixel the image was drawn at (default 1). */
  pixelRatio?: number
}

/** The parts of a MapLibre map an image lease uses. */
export type MapImageHost = Pick<MapLibreGL.Map, 'hasImage' | 'addImage' | 'removeImage' | 'on' | 'off'>

type Lease = { owners: number; image: MapStyleImage; missing: (event: { id: string }) => void }
const leases = new WeakMap<MapImageHost, Map<string, Lease>>()

function add(map: MapImageHost, image: MapStyleImage) {
  if (map.hasImage(image.id)) return
  map.addImage(
    image.id,
    { width: image.width, height: image.height, data: image.data as Uint8Array },
    { pixelRatio: image.pixelRatio ?? 1 },
  )
}

/**
 * Adds `image` to the map's style and keeps it there, adding it again when MapLibre reports it
 * missing (after `setStyle`, say). Layers sharing an id share one lease; the image is removed when
 * the last of them releases it. Returns the release function.
 */
export function retainMapImage(map: MapImageHost, image: MapStyleImage): () => void {
  let registry = leases.get(map)
  if (!registry) {
    registry = new Map()
    leases.set(map, registry)
  }
  let lease = registry.get(image.id)
  if (!lease) {
    const missing = (event: { id: string }) => {
      const current = registry!.get(image.id)
      if (event.id === image.id && current) add(map, current.image)
    }
    lease = { owners: 0, image, missing }
    registry.set(image.id, lease)
    map.on('styleimagemissing', missing as never)
  }
  lease.owners++
  add(map, lease.image)
  let released = false
  return () => {
    if (released) return
    released = true
    const entry = registry!.get(image.id)
    if (!entry || --entry.owners > 0) return
    registry!.delete(image.id)
    map.off('styleimagemissing', entry.missing as never)
    try {
      if (map.hasImage(image.id)) map.removeImage(image.id)
    } catch {
      // The map is already gone.
    }
  }
}
