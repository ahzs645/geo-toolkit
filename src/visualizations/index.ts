/** Supported visualization API; map-property adapters remain module-local. */
export { renderDonutSvg } from './donut.js'
export type { DonutOptions } from './donut.js'
export { numericExtent, plotBounds, rangeIndices } from './charts/geometry.js'
export type { XYDomain, XYSelection, NumericRange, PlotInsets } from './charts/geometry.js'
export { assignRing, ringSlots, layoutDonutRing } from './donutRing.js'
export type { RingPoint, RingSide, RingSlot, DonutRingLayout, DonutRingLayoutOptions } from './donutRing.js'
