import { describe, expect, it, vi } from 'vitest'
import { moveSheet } from './sheet-motion.js'

function fixture() {
  class Sheet extends EventTarget {
    style = { transform: 'translateY(600px)', transition: 'transform 350ms ease', willChange: '' }
    getBoundingClientRect = vi.fn(() => ({ height: 800 }))
  }
  const sheet = new Sheet()
  const element = sheet as unknown as HTMLElement
  let renderedY = 400
  let timestamp = 0
  let id = 0
  const frames = new Map<number, FrameRequestCallback>()
  const onFrame = vi.fn()
  const requestFrame = vi.fn((callback: FrameRequestCallback) => {
    frames.set(++id, callback)
    return id
  })
  const options = {
    durationMs: 350,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    onFrame,
    read: () => renderedY,
    requestFrame,
    cancelFrame: (frame: number) => {
      frames.delete(frame)
    },
    now: () => timestamp,
  }
  function advance(time: number, position: number) {
    timestamp = time
    renderedY = position
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(time))
  }
  function transition(type = 'transitionend', propertyName = 'transform') {
    sheet.dispatchEvent(Object.assign(new Event(type), { propertyName }))
  }
  return { sheet, element, options, onFrame, requestFrame, frames, advance, transition }
}

describe('sheet motion geometry', () => {
  it('captures the rendered transform before cancelling an in-flight snap', () => {
    const { sheet, element, options, onFrame } = fixture()
    const read = vi.fn(() => {
      expect(sheet.style.transition).toBe('transform 350ms ease')
      expect(sheet.style.transform).toBe('translateY(600px)')
      return 400
    })
    const cancel = moveSheet(element, 100, { ...options, read })
    expect(read).toHaveBeenCalledOnce()
    expect(sheet.getBoundingClientRect).toHaveBeenCalledOnce()
    expect(sheet.style.transform).toBe('translateY(100px)')
    expect(onFrame).toHaveBeenCalledWith(400)
    cancel()
  })

  it('publishes the actual intermediate height instead of the inline destination', () => {
    const { element, options, onFrame, advance, transition, frames } = fixture()
    moveSheet(element, 100, options)
    advance(16, 340)
    advance(32, 250)
    expect(onFrame.mock.calls.map(([y]) => y)).toEqual([400, 340, 250])
    transition('transitionend', 'opacity')
    expect(frames.size).toBe(1)
    advance(350, 100)
    transition()
    expect(onFrame.mock.calls.map(([y]) => y)).toEqual([400, 340, 250, 100, 100])
    expect(frames.size).toBe(0)
  })

  it('cancels stale frames and completion listeners before a drag or replacement snap', () => {
    const { element, options, onFrame, advance, transition, frames } = fixture()
    const cancel = moveSheet(element, 100, options)
    advance(16, 340)
    cancel()
    expect(frames.size).toBe(0)
    moveSheet(element, 340, { ...options, durationMs: 0 })
    transition()
    advance(500, 340)
    expect(onFrame.mock.calls.map(([y]) => y)).toEqual([400, 340, 340])
    expect(element.style.transition).toBe('none')
    expect(element.style.transform).toBe('translateY(340px)')
  })

  it('uses an immediate final transform without frame work for reduced motion', () => {
    const { sheet, element, options, onFrame, requestFrame } = fixture()
    moveSheet(element, 100, { ...options, durationMs: 0 })
    expect(onFrame.mock.calls).toEqual([[100]])
    expect(requestFrame).not.toHaveBeenCalled()
    expect(sheet.getBoundingClientRect).not.toHaveBeenCalled()
    expect(sheet.style.transition).toBe('none')
    expect(sheet.style.willChange).toBe('')
  })

  it('settles at the destination if the transitionend event was missed', () => {
    const { element, options, onFrame, frames, advance } = fixture()
    moveSheet(element, 100, options)
    advance(1000, 100)
    expect(onFrame.mock.calls).toEqual([[400], [100]])
    expect(frames.size).toBe(0)
    expect(element.style.willChange).toBe('')
  })

  it('ignores queued completion and cancellation events from the preceding snap', () => {
    const { element, options, onFrame, frames, advance, transition } = fixture()
    moveSheet(element, 100, options)
    transition()
    transition('transitioncancel')
    expect(frames.size).toBe(1)
    advance(100, 230)
    expect(onFrame.mock.calls).toEqual([[400], [230]])
    advance(410, 100)
    expect(frames.size).toBe(0)
  })
})
