import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNotificationStore, resolveNotificationDuration } from './notification-store.js'

describe('notification store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps arrival order and replaces a notice with the same id in place', () => {
    const store = createNotificationStore()
    const first = store.push({ tone: 'loading' })
    store.push({ id: 'update', tone: 'info' })
    store.push({ id: 'job', tone: 'loading' })
    store.push({ id: 'update', tone: 'warning' })
    expect(store.getSnapshot().map((entry) => [entry.id, entry.options.tone])).toEqual([
      [first, 'loading'],
      ['update', 'warning'],
      ['job', 'loading'],
    ])
  })

  it('notifies subscribers with a new snapshot on every change', () => {
    const store = createNotificationStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    const before = store.getSnapshot()
    store.push({ id: 'a' })
    expect(store.getSnapshot()).not.toBe(before)
    store.update('a', { tone: 'error' })
    store.remove('a')
    store.remove('a')
    expect(listener).toHaveBeenCalledTimes(3)
    unsubscribe()
    store.push({ id: 'b' })
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('auto-dismisses transient tones and keeps loading, warning and error', () => {
    const store = createNotificationStore()
    const onDismiss = vi.fn()
    store.push({ id: 'saved', tone: 'success', onDismiss })
    store.push({ id: 'note', tone: 'info' })
    store.push({ id: 'job', tone: 'loading' })
    store.push({ id: 'warn', tone: 'warning' })
    store.push({ id: 'fail', tone: 'error' })
    vi.advanceTimersByTime(60_000)
    expect(store.getSnapshot().map((entry) => entry.id)).toEqual(['job', 'warn', 'fail'])
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('honours an explicit duration, and 0 or null keeps the notice', () => {
    const store = createNotificationStore()
    store.push({ id: 'quick', tone: 'error', duration: 100 })
    store.push({ id: 'sticky', tone: 'success', duration: 0 })
    store.push({ id: 'held', tone: 'success', duration: null })
    vi.advanceTimersByTime(100)
    expect(store.getSnapshot().map((entry) => entry.id)).toEqual(['sticky', 'held'])
  })

  it('pauses every timer while the reader is in the stack and resumes with the time left', () => {
    const store = createNotificationStore()
    store.push({ id: 'saved', tone: 'success', duration: 1000 })
    vi.advanceTimersByTime(600)
    store.pause()
    vi.advanceTimersByTime(5000)
    expect(store.getSnapshot()).toHaveLength(1)
    store.resume()
    vi.advanceTimersByTime(399)
    expect(store.getSnapshot()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(store.getSnapshot()).toHaveLength(0)
  })

  it('leaves a controlled notice for its host to remove, and re-pushing it does not restart its clock', () => {
    const store = createNotificationStore()
    const onDismiss = vi.fn()
    store.push({ id: 'host', tone: 'error', onDismiss }, { controlled: true })
    store.dismiss('host')
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot()).toHaveLength(1)

    store.push({ id: 'timed', tone: 'info', duration: 1000, onDismiss }, { controlled: true })
    vi.advanceTimersByTime(700)
    store.push({ id: 'timed', tone: 'info', duration: 1000, onDismiss }, { controlled: true })
    vi.advanceTimersByTime(300)
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })

  it('restarts the timer when a notice changes tone', () => {
    const store = createNotificationStore()
    store.push({ id: 'job', tone: 'loading' })
    vi.advanceTimersByTime(60_000)
    store.update('job', { tone: 'success' })
    expect(store.getSnapshot()).toHaveLength(1)
    vi.advanceTimersByTime(5000)
    expect(store.getSnapshot()).toHaveLength(0)
  })

  it('defaults controlled notices to no timer', () => {
    expect(resolveNotificationDuration({ tone: 'success' }, true)).toBeNull()
    expect(resolveNotificationDuration({ tone: 'success' }, false)).toBe(5000)
    expect(resolveNotificationDuration({ tone: 'error', duration: Number.POSITIVE_INFINITY }, false)).toBeNull()
  })
})
