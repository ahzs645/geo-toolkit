export const EARTH_RADIUS_KM = 6371

/** Great-circle distance in km between two points given as (lat, lng) pairs. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Great-circle distance in km between two [lng, lat] positions (GeoJSON coordinate order). */
export function distanceKm(a: [number, number], b: [number, number]): number {
  return haversineKm(a[1], a[0], b[1], b[0])
}

/** `[minLng, minLat, maxLng, maxLat]` — the order @turf/bbox and MapLibre both use. */
export type BBox = [number, number, number, number]

/**
 * Bounding box of any GeoJSON geometry, or null when it carries no usable
 * coordinates. A Point yields a zero-area box; callers that need a clickable
 * area around it should pad the result themselves.
 *
 * Prefer this to @turf/bbox for plain bounds: it walks the coordinates
 * directly, handles every geometry type including GeometryCollection, and
 * needs no dependency.
 */
export function geometryBounds(geometry: GeoJSON.Geometry | null | undefined): BBox | null {
  if (!geometry) return null

  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  const expand = ([lng, lat]: GeoJSON.Position) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }

  const walk = (node: GeoJSON.Geometry) => {
    switch (node.type) {
      case 'Point':
        expand(node.coordinates)
        break
      case 'MultiPoint':
      case 'LineString':
        node.coordinates.forEach(expand)
        break
      case 'MultiLineString':
      case 'Polygon':
        node.coordinates.forEach((line) => line.forEach(expand))
        break
      case 'MultiPolygon':
        node.coordinates.forEach((polygon) => polygon.forEach((ring) => ring.forEach(expand)))
        break
      case 'GeometryCollection':
        node.geometries.forEach(walk)
        break
    }
  }

  walk(geometry)

  if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) return null
  return [minLng, minLat, maxLng, maxLat]
}

/**
 * Bounding box of every feature in a collection, or null when none carries
 * usable coordinates. Features without geometry are skipped.
 */
export function featureCollectionBounds(collection: GeoJSON.FeatureCollection | null | undefined): BBox | null {
  let box: BBox | null = null
  for (const feature of collection?.features ?? []) {
    const next = geometryBounds(feature.geometry)
    if (!next) continue
    box = box
      ? [Math.min(box[0], next[0]), Math.min(box[1], next[1]), Math.max(box[2], next[2]), Math.max(box[3], next[3])]
      : next
  }
  return box
}

/** Centre of a geometry's bounding box, or null when it has no coordinates. */
export function boundsCenter(geometry: GeoJSON.Geometry | null | undefined): [number, number] | null {
  const bounds = geometryBounds(geometry)
  if (!bounds) return null
  return [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2]
}

/**
 * Points along the shortest great-circle route from `from` to `to` ([lng, lat]),
 * for flow lines on a map. Longitudes are unwrapped to stay continuous, so a
 * route across the antimeridian runs past ±180 instead of jumping back across
 * the map; renderers that clamp longitudes should split it there.
 */
export function greatCircleArc(
  from: [number, number],
  to: [number, number],
  { steps = 64 }: { steps?: number } = {},
): [number, number][] {
  const rad = Math.PI / 180
  const [l1, p1] = [from[0] * rad, from[1] * rad]
  const [l2, p2] = [to[0] * rad, to[1] * rad]
  const d =
    2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2))
  if (!(d > 1e-9)) return [from, to]
  const n = Math.max(1, Math.round(steps))
  const out: [number, number][] = []
  let previous: number | null = null
  for (let i = 0; i <= n; i++) {
    const f = i / n
    const a = Math.sin((1 - f) * d) / Math.sin(d)
    const b = Math.sin(f * d) / Math.sin(d)
    const x = a * Math.cos(p1) * Math.cos(l1) + b * Math.cos(p2) * Math.cos(l2)
    const y = a * Math.cos(p1) * Math.sin(l1) + b * Math.cos(p2) * Math.sin(l2)
    const z = a * Math.sin(p1) + b * Math.sin(p2)
    let lng = Math.atan2(y, x) / rad
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) / rad
    if (previous !== null) lng += 360 * Math.round((previous - lng) / 360)
    previous = lng
    out.push([lng, lat])
  }
  return out
}
