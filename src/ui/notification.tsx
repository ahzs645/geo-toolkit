import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react'
import { cn } from '../utils.js'
import { Button } from './button.js'
import {
  createNotificationStore,
  type NotificationEntryOptions,
  type NotificationStore,
  type NotificationTone,
} from './notification-store.js'

export { createNotificationStore, NOTIFICATION_DURATION, resolveNotificationDuration } from './notification-store.js'
export type {
  NotificationEntry,
  NotificationEntryOptions,
  NotificationStore,
  NotificationTone,
} from './notification-store.js'

export interface NotificationProgress {
  value: number
  max: number
  /** Accessible name of the progress bar. Defaults to the title, else the message, when they are text. */
  label?: string
  /** Shown beside the message. Defaults to "`value` of `max`"; `null` hides it. */
  valueText?: ReactNode | null
}

export interface NotificationCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'role'> {
  /** `error` is announced assertively as an alert; every other tone politely as a status. */
  tone?: NotificationTone
  title?: ReactNode
  message?: ReactNode
  /** Replaces the tone's icon; `null` drops the icon. */
  icon?: ReactNode | null
  /** A determinate bar under the message, for a job with known steps. */
  progress?: NotificationProgress
  /** One control beside the message, such as Cancel for a running job. */
  action?: ReactNode
  /** A row of buttons under the message, such as Later / Reload. */
  actions?: ReactNode
  /** Shows a close button. */
  onDismiss?: () => void
  dismissLabel?: string
}

const TONE_ICON: Record<NotificationTone, ReactNode> = {
  info: <Info />,
  loading: <LoaderCircle className="motion-safe:animate-spin" />,
  success: <CircleCheck />,
  warning: <TriangleAlert />,
  error: <CircleAlert />,
}

// Same tone palette as InlineAlert, so a floating notice reads like its inline counterpart.
const TONE_CARD: Record<NotificationTone, string> = {
  info: 'border-border',
  loading: 'border-border',
  success: 'border-green-300 dark:border-green-900/60',
  warning: 'border-amber-300 dark:border-amber-900/60',
  error: 'border-destructive/30',
}

const TONE_BADGE: Record<NotificationTone, string> = {
  info: 'bg-primary/10 text-primary',
  loading: 'bg-primary/10 text-primary',
  success: 'bg-green-500/15 text-green-700 dark:text-green-300',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  error: 'bg-destructive/10 text-destructive',
}

/** `error` interrupts as an alert; everything else waits its turn as a status. */
export function notificationRole(tone: NotificationTone = 'info') {
  return tone === 'error'
    ? ({ role: 'alert', 'aria-live': 'assertive' } as const)
    : ({ role: 'status', 'aria-live': 'polite' } as const)
}

/**
 * One floating notification. Place it in a `NotificationViewport`, or render
 * `<Notification>` / `useNotifications()` under a `NotificationProvider`,
 * which stacks every notice in one place.
 */
export function NotificationCard({
  tone = 'info',
  title,
  message,
  icon,
  progress,
  action,
  actions,
  onDismiss,
  dismissLabel = 'Dismiss notification',
  className,
  children,
  ...props
}: NotificationCardProps) {
  const glyph = icon === undefined ? TONE_ICON[tone] : icon
  const progressLabel =
    progress?.label ?? (typeof title === 'string' ? title : typeof message === 'string' ? message : undefined)
  const progressText =
    progress?.valueText === undefined ? progress && `${progress.value} of ${progress.max}` : progress.valueText
  return (
    <div
      {...notificationRole(tone)}
      data-notification-tone={tone}
      className={cn(
        'geo-motion-notification pointer-events-auto rounded-xl border bg-background/95 p-3 text-sm text-foreground shadow-xl backdrop-blur',
        TONE_CARD[tone],
        className,
      )}
      {...props}
    >
      <div className={cn('flex gap-3', title ? 'items-start' : 'items-center')}>
        {glyph && (
          <span
            aria-hidden="true"
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4 [&_svg]:shrink-0',
              TONE_BADGE[tone],
            )}
          >
            {glyph}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {title && <p className="text-sm font-semibold leading-5">{title}</p>}
          {message && (
            <p
              data-notification-message=""
              className={cn('break-words text-xs leading-5', title && 'mt-0.5 text-muted-foreground')}
            >
              {message}
            </p>
          )}
          {children}
        </div>
        {progressText != null && progressText !== false && (
          <span aria-hidden="true" className="shrink-0 text-2xs tabular-nums text-muted-foreground">
            {progressText}
          </span>
        )}
        {action}
        {onDismiss && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-my-1 size-7 shrink-0 touch:size-10"
            aria-label={dismissLabel}
            onClick={onDismiss}
          >
            <X />
          </Button>
        )}
      </div>
      {progress && (
        <div
          role="progressbar"
          aria-label={progressLabel}
          aria-valuemin={0}
          aria-valuemax={progress.max}
          aria-valuenow={progress.value}
          className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{
              width: `${progress.max > 0 ? Math.min(100, Math.max(0, (progress.value / progress.max) * 100)) : 0}%`,
            }}
          />
        </div>
      )}
      {actions && <div className="mt-3 flex flex-wrap justify-end gap-2">{actions}</div>}
    </div>
  )
}

export interface NotificationViewportProps extends HTMLAttributes<HTMLElement> {
  /** Names the landmark that holds the stack. */
  label?: string
}

/**
 * Where notifications float: bottom-right on wider screens, full width along
 * the bottom on phones, above the safe area and above dialogs and sheets
 * (`z-notification`). Cards stack upward in the order they arrive; the stack
 * itself passes clicks through to the page.
 */
export function NotificationViewport({
  label = 'Notifications',
  className,
  children,
  ...props
}: NotificationViewportProps) {
  return (
    <section
      aria-label={label}
      data-notification-viewport=""
      className={cn(
        'pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-notification flex max-h-[calc(100dvh-1.5rem)] flex-col gap-2 overflow-y-auto overscroll-contain sm:inset-x-auto sm:bottom-[calc(env(safe-area-inset-bottom)+1rem)] sm:right-4 sm:w-[24rem]',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  )
}

export interface NotificationOptions extends Omit<NotificationCardProps, 'onDismiss' | 'id'>, NotificationEntryOptions {
  /**
   * Show a close button. Defaults to every tone but `loading` for pushed
   * notifications, and to whether `onDismiss` is set for a `<Notification>`.
   */
  dismissible?: boolean
}

export type NotificationProps = NotificationOptions

const NotificationContext = createContext<NotificationStore<NotificationOptions> | null>(null)

function cardProps(options: NotificationOptions, controlled: boolean, dismiss: (() => void) | undefined) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- store-only fields stay off the DOM
  const { id, duration, dismissible, onDismiss, ...card } = options
  const canDismiss = dismissible ?? (controlled ? !!onDismiss : card.tone !== 'loading')
  return { ...card, onDismiss: canDismiss ? dismiss : undefined }
}

function NotificationStack({
  store,
  ...props
}: NotificationViewportProps & { store: NotificationStore<NotificationOptions> }) {
  const entries = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const resumeUnlessInside = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) store.resume()
  }
  return (
    <NotificationViewport
      {...props}
      onPointerEnter={store.pause}
      onPointerLeave={store.resume}
      onFocus={store.pause}
      onBlur={resumeUnlessInside}
    >
      {entries.map((entry) => (
        <NotificationCard
          key={entry.id}
          {...cardProps(entry.options, entry.controlled, () => store.dismiss(entry.id))}
        />
      ))}
    </NotificationViewport>
  )
}

export interface NotificationProviderProps extends NotificationViewportProps {
  children?: ReactNode
  /** Share a store created with `createNotificationStore`, e.g. to push from outside React. */
  store?: NotificationStore<NotificationOptions>
}

/**
 * Gives the subtree one notification stack. Mount it once near the root so
 * notices from different features stack instead of overlapping. Viewport
 * props (`label`, `className`) pass through to the stack.
 */
export function NotificationProvider({ children, store: sharedStore, ...viewport }: NotificationProviderProps) {
  const [store] = useState(() => sharedStore ?? createNotificationStore<NotificationOptions>())
  return (
    <NotificationContext.Provider value={store}>
      {children}
      <NotificationStack store={store} {...viewport} />
    </NotificationContext.Provider>
  )
}

/** Push, update and dismiss notifications on the nearest `NotificationProvider`. */
export function useNotifications(): NotificationStore<NotificationOptions> {
  const store = useContext(NotificationContext)
  if (!store) throw new Error('useNotifications needs a NotificationProvider above it.')
  return store
}

/**
 * A notification that shows while it is mounted, for state the host already
 * owns (a running job, an error string). Under a `NotificationProvider` it
 * joins the shared stack; without one it renders its own viewport.
 */
export function Notification({ id, ...options }: NotificationProps) {
  const store = useContext(NotificationContext)
  const autoId = useId()
  const key = id ?? autoId
  // Re-sent each render so the card follows its props; the store keeps its place and timer.
  useEffect(() => {
    store?.push({ ...options, id: key }, { controlled: true })
  })
  useEffect(() => () => store?.remove(key), [store, key])
  if (store) return null
  return (
    <NotificationViewport>
      <NotificationCard {...cardProps(options, true, options.onDismiss)} />
    </NotificationViewport>
  )
}
