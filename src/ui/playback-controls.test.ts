import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PlaybackControls, clampPlaybackValue } from './playback-controls.js'

const km = (metres: number) => `${(metres / 1000).toFixed(2)} km`

describe('playback controls', () => {
  it('keeps frame mode the default', () => {
    const props = { frame: 2, frameCount: 5, onFrameChange: () => {}, playing: false, onPlayingChange: () => {} }
    const html = renderToStaticMarkup(createElement(PlaybackControls, props))
    expect(html).toBe(renderToStaticMarkup(createElement(PlaybackControls, { ...props, mode: 'frames' })))
    expect(html).toContain('aria-label="Previous frame"')
    expect(html).toContain('aria-label="Frame"')
    expect(html).toContain('3 / 5')
  })

  it('clamps a position into its range', () => {
    expect(clampPlaybackValue(-5, 0, 100)).toBe(0)
    expect(clampPlaybackValue(120, 0, 100)).toBe(100)
    expect(clampPlaybackValue(42.5, 0, 100)).toBe(42.5)
    expect(clampPlaybackValue(Number.NaN, 10, 100)).toBe(10)
    expect(clampPlaybackValue(50, 10, 5)).toBe(10)
  })

  it('seeks a continuous position with steps, a formatted label and actions', () => {
    const html = renderToStaticMarkup(
      createElement(PlaybackControls, {
        mode: 'continuous',
        value: 1250,
        max: 4000,
        step: 5,
        onValueChange: () => {},
        playing: false,
        onPlayingChange: () => {},
        skip: 10,
        skipLabel: '10 m',
        formatValue: km,
        seekLabel: 'Route position',
        playButton: 'labelled',
        actions: createElement('select', { 'aria-label': 'Driving speed' }),
      }),
    )
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>.*Play<\/button>/)
    expect(html).toContain('aria-label="Back 10 m"')
    expect(html).toContain('aria-label="Forward 10 m"')
    const range = /<input type="range"[^>]*>/.exec(html)?.[0] ?? ''
    for (const attribute of [
      'min="0"',
      'max="4000"',
      'step="5"',
      'value="1250"',
      'aria-label="Route position"',
      'aria-valuetext="1.25 km of 4.00 km"',
    ]) {
      expect(range).toContain(attribute)
    }
    expect(html.replace(/<[^>]*>/g, '')).toContain('1.25 km / 4.00 km')
    expect(html).toContain('aria-label="Driving speed"')
    expect(html).not.toContain('Previous frame')
  })

  it('disables back at the start, forward at the end, and play when it cannot start', () => {
    const base = {
      mode: 'continuous' as const,
      max: 100,
      onValueChange: () => {},
      onPlayingChange: () => {},
      skip: 10,
    }
    const atStart = renderToStaticMarkup(
      createElement(PlaybackControls, { ...base, value: 0, playing: false, canPlay: false }),
    )
    expect(atStart).toMatch(
      /<button[^>]*disabled=""[^>]*aria-label="Play"|<button[^>]*aria-label="Play"[^>]*disabled=""/,
    )
    expect(atStart).toMatch(/aria-label="Back 10"[^>]*disabled=""/)
    expect(atStart).not.toMatch(/aria-label="Forward 10"[^>]*disabled=""/)

    // Pause stays available while playing, even if play could not start now.
    const playingAtEnd = renderToStaticMarkup(
      createElement(PlaybackControls, { ...base, value: 100, playing: true, canPlay: false }),
    )
    expect(playingAtEnd).not.toMatch(/aria-label="Pause"[^>]*disabled=""/)
    expect(playingAtEnd).toMatch(/aria-label="Forward 10"[^>]*disabled=""/)
  })

  it('hides the step buttons without a skip, and takes a custom label and spoken value', () => {
    const html = renderToStaticMarkup(
      createElement(PlaybackControls, {
        mode: 'continuous',
        value: 30,
        max: 60,
        onValueChange: () => {},
        playing: true,
        onPlayingChange: () => {},
        valueLabel: '0:30',
        valueText: '30 seconds of 60',
      }),
    )
    expect(html).not.toContain('Back ')
    expect(html).toContain('aria-label="Pause"')
    expect(html).toContain('aria-label="Position"')
    expect(html).toContain('aria-valuetext="30 seconds of 60"')
    expect(html.replace(/<[^>]*>/g, '')).toContain('0:30')
  })
})
