import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import colors from 'tailwindcss/colors'
import { toolkitTheme } from './tailwind-theme.mjs'

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

function block(selectorStart) {
  const start = css.indexOf(selectorStart)
  expect(start, selectorStart).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', start)
  return css.slice(open + 1, css.indexOf('}', open))
}

const values = (body) => new Map([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
const lightValues = values(block('.geo-toolkit {'))
const darkValues = values(block(".geo-toolkit.dark,\n.geo-toolkit[data-theme='dark']"))

/** `h s% l%` channels to `#rrggbb`. */
function hex(channels) {
  const [h, s, l] = channels.split(/\s+/).map((part) => parseFloat(part))
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n) => {
    const k = (n + h / 30) % 12
    const v = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
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

  it('defaults the UI-state tokens to the sky and slate they replaced', () => {
    const expected = {
      '--selected': [colors.sky[50], colors.sky[950]],
      '--selected-border': [colors.sky[300], colors.sky[800]],
      '--selected-focus': [colors.sky[500], colors.sky[500]],
      '--link': [colors.sky[600], colors.sky[400]],
      '--link-hover': [colors.sky[700], colors.sky[300]],
      '--map-surround': [colors.slate[100], colors.slate[950]],
    }
    for (const [name, [lightHex, darkHex]] of Object.entries(expected)) {
      expect(hex(lightValues.get(name)), `${name} light`).toBe(lightHex)
      expect(hex(darkValues.get(name)), `${name} dark`).toBe(darkHex)
    }
    // ResultRow's dark selected fill was sky-950 at 30%.
    expect(lightValues.get('--selected-alpha')).toBe('1')
    expect(darkValues.get('--selected-alpha')).toBe('0.3')
  })
})
