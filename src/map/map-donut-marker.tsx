'use client'

import type { ReactNode } from 'react'

import { renderDonutSvg, type DonutOptions } from '../visualizations/donut.js'
import { MapMarker, MarkerContent } from './map-markers.js'

export type MapDonutMarkerProps = DonutOptions & {
  longitude: number
  latitude: number
  /** MarkerLabel, MarkerTooltip or MarkerPopup for this marker. */
  children?: ReactNode
  onClick?: (event: MouseEvent) => void
  onMouseEnter?: (event: MouseEvent) => void
  onMouseLeave?: (event: MouseEvent) => void
  className?: string
}

/**
 * A donut (renderDonutSvg) pinned to a coordinate: category shares at one
 * place, e.g. the composition of a site's mass. Pass `radius` for a fixed size
 * and `label` for centre text; without them it sizes by total like clusters.
 */
export function MapDonutMarker({
  longitude,
  latitude,
  children,
  onClick,
  onMouseEnter,
  onMouseLeave,
  className,
  ...donut
}: MapDonutMarkerProps) {
  const { svg, size } = renderDonutSvg(donut)
  return (
    <MapMarker
      longitude={longitude}
      latitude={latitude}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <MarkerContent className={className} style={{ width: size, height: size }}>
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      </MarkerContent>
      {children}
    </MapMarker>
  )
}
