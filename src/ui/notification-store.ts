/**
 * Framework-free state for floating notifications: one ordered list per host,
 * with ids, in-place replacement, dismissal and auto-dismiss timers that pause
 * while the reader is pointing at or focused inside the stack.
 *
 * The store holds whatever the renderer needs per entry (`T`), so the React
 * layer can keep its own card props here without this module importing React.
 */

export type NotificationTone = 'info' | 'loading' | 'success' | 'warning' | 'error'

/** How long a notification stays before it removes itself, by tone. `null` waits for the host or the reader. */
export const NOTIFICATION_DURATION: Readonly<Record<NotificationTone, number | null>> = {
  info: 6000,
  success: 5000,
  loading: null,
  warning: null,
  error: null,
}

export interface NotificationEntryOptions {
  id?: string
  tone?: NotificationTone
  /**
   * Milliseconds before the notification dismisses itself. Defaults to
   * `NOTIFICATION_DURATION[tone]` for pushed notifications; `null` or `0`
   * keeps it until it is dismissed. Controlled notifications default to `null`.
   */
  duration?: number | null
  /** Called when the reader or the timer dismisses it. */
  onDismiss?: () => void
}

export interface NotificationEntry<T extends NotificationEntryOptions = NotificationEntryOptions> {
  id: string
  options: T
  /**
   * The host owns presence (a mounted `<Notification>`): dismissal only calls
   * `onDismiss`, and the host removes it by unmounting.
   */
  controlled: boolean
}

export interface NotificationStore<T extends NotificationEntryOptions = NotificationEntryOptions> {
  getSnapshot(): ReadonlyArray<NotificationEntry<T>>
  subscribe(listener: () => void): () => void
  /** Add a notification, or replace the one with the same id in place. Returns its id. */
  push(options: T, settings?: { controlled?: boolean }): string
  /** Merge changes into an existing notification. A changed `duration` or `tone` restarts its timer. */
  update(id: string, patch: Partial<T>): void
  /** Reader or timer dismissal: calls `onDismiss`, and removes it unless the host controls it. */
  dismiss(id: string): void
  /** Remove without calling `onDismiss`. */
  remove(id: string): void
  clear(): void
  /** Hold every auto-dismiss timer, e.g. while the pointer or focus is in the stack. */
  pause(): void
  resume(): void
}

type Timer = { handle: ReturnType<typeof setTimeout> | null; remaining: number; startedAt: number }

export function resolveNotificationDuration(options: NotificationEntryOptions, controlled: boolean): number | null {
  const duration =
    options.duration !== undefined
      ? options.duration
      : controlled
        ? null
        : NOTIFICATION_DURATION[options.tone ?? 'info']
  return duration && duration > 0 && Number.isFinite(duration) ? duration : null
}

export function createNotificationStore<
  T extends NotificationEntryOptions = NotificationEntryOptions,
>(): NotificationStore<T> {
  let entries: ReadonlyArray<NotificationEntry<T>> = []
  const listeners = new Set<() => void>()
  const timers = new Map<string, Timer>()
  let paused = false
  let sequence = 0

  const emit = () => listeners.forEach((listener) => listener())

  const stopTimer = (id: string) => {
    const timer = timers.get(id)
    if (timer?.handle) clearTimeout(timer.handle)
    timers.delete(id)
  }

  const runTimer = (id: string, timer: Timer) => {
    timer.startedAt = Date.now()
    timer.handle = setTimeout(() => {
      timers.delete(id)
      store.dismiss(id)
    }, timer.remaining)
  }

  const startTimer = (entry: NotificationEntry<T>) => {
    stopTimer(entry.id)
    const duration = resolveNotificationDuration(entry.options, entry.controlled)
    if (duration === null) return
    const timer: Timer = { handle: null, remaining: duration, startedAt: 0 }
    timers.set(entry.id, timer)
    if (!paused) runTimer(entry.id, timer)
  }

  const store: NotificationStore<T> = {
    getSnapshot: () => entries,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    push(options, settings) {
      const id = options.id ?? `notification-${++sequence}`
      const controlled = settings?.controlled ?? false
      const previous = entries.find((entry) => entry.id === id)
      const entry: NotificationEntry<T> = { id, options: { ...options, id }, controlled }
      entries = previous ? entries.map((item) => (item.id === id ? entry : item)) : [...entries, entry]
      // Re-pushing the same controlled notice on every render must not keep resetting its clock.
      const timing = (value: NotificationEntry<T>) =>
        `${value.controlled}:${resolveNotificationDuration(value.options, value.controlled)}:${value.options.tone}`
      if (!previous || timing(previous) !== timing(entry)) startTimer(entry)
      emit()
      return id
    },
    update(id, patch) {
      const previous = entries.find((entry) => entry.id === id)
      if (!previous) return
      const entry: NotificationEntry<T> = { ...previous, options: { ...previous.options, ...patch, id } }
      entries = entries.map((item) => (item.id === id ? entry : item))
      if ('duration' in patch || 'tone' in patch) startTimer(entry)
      emit()
    },
    dismiss(id) {
      const entry = entries.find((item) => item.id === id)
      if (!entry) return
      if (!entry.controlled) store.remove(id)
      else stopTimer(id)
      entry.options.onDismiss?.()
    },
    remove(id) {
      stopTimer(id)
      if (!entries.some((entry) => entry.id === id)) return
      entries = entries.filter((entry) => entry.id !== id)
      emit()
    },
    clear() {
      for (const id of [...timers.keys()]) stopTimer(id)
      if (!entries.length) return
      entries = []
      emit()
    },
    pause() {
      if (paused) return
      paused = true
      for (const timer of timers.values()) {
        if (!timer.handle) continue
        clearTimeout(timer.handle)
        timer.handle = null
        timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt))
      }
    },
    resume() {
      if (!paused) return
      paused = false
      for (const [id, timer] of timers) if (!timer.handle) runTimer(id, timer)
    },
  }
  return store
}
