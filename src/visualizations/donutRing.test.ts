import { describe, expect, it } from 'vitest'
import { assignRing, layoutDonutRing, ringSlots, type RingPoint } from './donutRing.js'

const crosses = (a: RingPoint, b: RingPoint, c: RingPoint, d: RingPoint) => {
  const o = (p: RingPoint, q: RingPoint, r: RingPoint) =>
    Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b)
}

describe('donut ring layout', () => {
  it('runs slots along the top and bottom and down both sides', () => {
    const slots = ringSlots(1000, 500, { w: 100, h: 100 })
    expect(slots.filter((s) => s.side === 'top')).toHaveLength(10)
    expect(slots.filter((s) => s.side === 'left')).toHaveLength(3)
    expect(slots).toHaveLength(26)
    for (const s of slots) expect(s.x > 0 && s.x < 1000 && s.y > 0 && s.y < 500).toBe(true)
  })

  it('gives each point its own slot, nearest where order allows, without crossing leaders', () => {
    const slots = ringSlots(1200, 600, { w: 100, h: 100 })
    const points = [
      { x: 200, y: 200 },
      { x: 900, y: 180 },
      { x: 610, y: 420 },
      { x: 300, y: 380 },
      { x: 1000, y: 400 },
      { x: 640, y: 150 },
    ]
    const pick = assignRing(points, slots, { x: 600, y: 300 })
    expect(new Set(pick).size).toBe(points.length)
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++)
        expect(crosses(points[i], slots[pick[i]], points[j], slots[pick[j]])).toBe(false)
    expect(slots[pick[5]].side).toBe('top')
    expect(Math.abs(slots[pick[5]].x - 640)).toBeLessThanOrEqual(60)
  })

  it('fits the largest radius whose ring holds every place, inside the map box', () => {
    const land: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-170, -55],
                [170, -55],
                [170, 75],
                [-170, 75],
                [-170, -55],
              ],
            ],
          },
        },
      ],
    }
    const places = Array.from({ length: 30 }, (_, i) => [-160 + i * 11, -40 + (i % 7) * 15] as const)
    const few = layoutDonutRing({ width: 1000, land, places: places.slice(0, 4) })!
    const many = layoutDonutRing({ width: 1000, land, places })!
    expect(many.radius).toBeLessThanOrEqual(few.radius)
    expect(many.slots).toHaveLength(30)
    expect(new Set(many.slots).size).toBe(30)
    for (const p of many.points) expect(p.x > many.cell.w - 1 && p.x < 1000 - many.cell.w + 1).toBe(true)
    expect(layoutDonutRing({ width: 1000, land, places: [] })).toBeNull()
    expect(layoutDonutRing({ width: 400, land, places, maxRadius: 12, minRadius: 12 })).toBeNull()
  })
})
