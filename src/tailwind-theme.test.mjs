import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { toolkitTheme } from './tailwind-theme.mjs'

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

function block(selectorStart) {
  const start = css.indexOf(selectorStart)
  expect(start, selectorStart).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', start)
  return css.slice(open + 1, css.indexOf('}', open))
}

const declared = (body) => new Set([...body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))
const light = declared(block('.geo-toolkit {'))
const dark = declared(block(".geo-toolkit.dark,\n.geo-toolkit[data-theme='dark']"))

function variables(value) {
  if (typeof value === 'string') return [...value.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1])
  return Object.values(value).flatMap(variables)
}

describe('toolkit Tailwind theme', () => {
  it('derives every corner from --radius', () => {
    for (const [step, value] of Object.entries(toolkitTheme.borderRadius)) {
      expect(value, step).toContain('var(--radius)')
    }
  })

  it('declares every colour variable in the light and the dark theme', () => {
    const names = variables(toolkitTheme.colors)
    expect(names).toContain('--warning-surface')
    for (const name of names) {
      expect(light.has(name), `${name} in .geo-toolkit`).toBe(true)
      expect(dark.has(name), `${name} in the dark block`).toBe(true)
    }
    expect(light.has('--radius')).toBe(true)
  })
})
