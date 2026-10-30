export interface ScreenPointCluster<T> {
  id: string
  longitude: number
  latitude: number
  items: T[]
}

export interface ScreenPointClusterOptions<T> {
  getId: (item: T) => string
  getCoordinates: (item: T) => readonly [number, number]
  /** Stable ascending order; the first matching cluster receives each point. */
  priority?: (item: T) => number
  /** Without projection, each item remains a singleton in input order. */
  project?: (coordinates: readonly [number, number]) => { x: number; y: number }
  viewport?: { width: number; height: number }
  radius: number
  padding?: number
  idPrefix?: string
}

/** Greedy screen-space clustering for HTML markers, retaining the original records. */
export function clusterScreenPoints<T>(
  items: readonly T[],
  {
    getId,
    getCoordinates,
    priority,
    project,
    viewport,
    radius,
    padding = 0,
    idPrefix = 'cluster',
  }: ScreenPointClusterOptions<T>,
): ScreenPointCluster<T>[] {
  if (!project) {
    return items.map((item) => {
      const [longitude, latitude] = getCoordinates(item)
      return { id: getId(item), longitude, latitude, items: [item] }
    })
  }

  const clusters: Array<ScreenPointCluster<T> & { x: number; y: number }> = []
  const ordered = priority ? [...items].sort((a, b) => priority(a) - priority(b)) : items
  for (const item of ordered) {
    const [longitude, latitude] = getCoordinates(item)
    const point = project([longitude, latitude])
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
    if (
      viewport &&
      (point.x < -padding ||
        point.y < -padding ||
        point.x > viewport.width + padding ||
        point.y > viewport.height + padding)
    )
      continue
    let cluster = clusters.find((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= radius)
    if (!cluster) {
      cluster = {
        id: `${idPrefix}-${Math.round(point.x)}-${Math.round(point.y)}-${getId(item)}`,
        x: point.x,
        y: point.y,
        longitude,
        latitude,
        items: [],
      }
      clusters.push(cluster)
    }
    cluster.items.push(item)
    const count = cluster.items.length
    cluster.x += (point.x - cluster.x) / count
    cluster.y += (point.y - cluster.y) / count
    cluster.longitude += (longitude - cluster.longitude) / count
    cluster.latitude += (latitude - cluster.latitude) / count
  }
  return clusters.map(({ x: _x, y: _y, ...cluster }) => cluster)
}
