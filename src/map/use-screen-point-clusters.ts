import type * as MapLibreGL from 'maplibre-gl'
import { useMemo } from 'react'
import { clusterScreenPoints, type ScreenPointClusterOptions } from './screen-point-clusters.js'
import { useMapViewport } from './use-map-viewport.js'

export type UseScreenPointClusterOptions<T> = Omit<ScreenPointClusterOptions<T>, 'project' | 'viewport'>

export function useScreenPointClusters<T>(
  map: MapLibreGL.Map | null,
  items: readonly T[],
  options: UseScreenPointClusterOptions<T>,
) {
  const viewport = useMapViewport(map, { events: ['moveend', 'zoomend', 'resize'], initial: 'always' })
  const { getId, getCoordinates, priority, radius, padding, idPrefix } = options
  return useMemo(
    () =>
      clusterScreenPoints(items, {
        getId,
        getCoordinates,
        priority,
        radius,
        padding,
        idPrefix,
        project: map ? (coordinates) => map.project([coordinates[0], coordinates[1]]) : undefined,
        viewport: map
          ? (viewport ?? { width: map.getCanvas().clientWidth, height: map.getCanvas().clientHeight })
          : undefined,
      }),
    [items, map, viewport, getId, getCoordinates, priority, radius, padding, idPrefix],
  )
}
