import { createContext, useContext } from 'react'

/**
 * Pixels of the map content area a `MapSectionLayout` covers with docked panes,
 * as their settled targets rather than per-frame animated values.
 *
 * The layout's main map extends its canvas under these panes instead of
 * resizing, and moves its camera padding so the visible part stays framed.
 */
export interface MapLayoutCovers {
  bottom: number
}

export const MapLayoutCoversContext = createContext<MapLayoutCovers | null>(null)

export function useMapLayoutCovers(): MapLayoutCovers | null {
  return useContext(MapLayoutCoversContext)
}
