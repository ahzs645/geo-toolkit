import { describe, expect, it } from 'vitest'
import { nearestLinePoint } from './lineHover.js'

const domain = [0, 10, 0, 10] as const
const insets = { left: 0, right: 0, top: 0, bottom: 0 }
const lines = [
  {
    id: 'low',
    label: 'Low',
    color: 'blue',
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
  },
  {
    id: 'high',
    label: 'High',
    color: 'red',
    points: [
      { x: 0, y: 10 },
      { x: 10, y: 10 },
    ],
  },
]

describe('line inspection', () => {
  it('selects the nearby line segment and retains its original observation', () => {
    const hit = nearestLinePoint(lines, domain, 100, 100, insets, 60, 99)
    expect(hit?.series.id).toBe('low')
    expect(hit?.point).toBe(lines[0].points[1])
    expect(nearestLinePoint(lines, domain, 100, 100, insets, 40, 1)?.series.id).toBe('high')
  })
  it('does not inspect empty space or bridge a missing sample', () => {
    expect(nearestLinePoint(lines, domain, 100, 100, insets, 50, 50)).toBeNull()
    expect(nearestLinePoint(lines, domain, 100, 100, insets, -1, 99)).toBeNull()
    const gap = [
      {
        ...lines[0],
        points: [
          { x: 0, y: 0 },
          { x: 5, y: null },
          { x: 10, y: 0 },
        ],
      },
    ]
    expect(nearestLinePoint(gap, domain, 100, 100, insets, 50, 99)).toBeNull()
  })
})
