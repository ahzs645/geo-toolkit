import { useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../utils.js'
import { useWorkspace } from '../workspace/workspace-context.js'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './dialog.js'
import { useMotionPresence } from './motion.js'

const sizeClasses = {
  md: 'workspace-sm:max-w-2xl',
  lg: 'workspace-sm:max-w-4xl',
  xl: 'workspace-sm:max-w-5xl',
} as const

export interface DialogShellProps {
  theme?: 'light' | 'dark'
  onOpenEffect?: (open: boolean) => void
  portalContainer?: HTMLElement | null
  title: ReactNode
  /** Where the record is, or what the panel is for. */
  subtitle?: ReactNode
  /** Small uppercase label above the title, e.g. "Sampling report". */
  eyebrow?: ReactNode
  /** One line under the subtitle naming the slice being shown, e.g. the period. */
  context?: ReactNode
  /** Controls that change what the body shows: a period switch, a `TabBar`, a search field. */
  toolbar?: ReactNode
  /** Headline numbers, usually a `StatGroup variant="tiles"`. */
  summary?: ReactNode
  /** Anything else that belongs in the fixed header (notes, badges). */
  headerExtra?: ReactNode
  /** Footer row; omit for none. */
  footer?: ReactNode
  /** Accessible name for the header close button. */
  closeLabel?: string
  size?: keyof typeof sizeClasses
  /** Controlled open state. Defaults to open, for dialogs mounted only while shown. */
  open?: boolean
  /** Opening is reported immediately; closing is reported after the exit completes. */
  onOpenChange?: (open: boolean) => void
  /** Called once after an Escape, overlay or close-button exit completes. */
  onClose?: () => void
  /**
   * The button that opens the dialog. Passing it here lets focus return to it
   * on close (Radix only restores focus to its own trigger).
   */
  trigger?: ReactNode
  /** Extra classes for the dialog panel, e.g. a fixed height. */
  className?: string
  bodyClassName?: string
  /** Attributes for the dialog panel, e.g. `data-*` test hooks. */
  contentProps?: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string | boolean | undefined>
  children: ReactNode
}

/**
 * The frame every large dialog shares: a pinned title row with a
 * finger-sized close button, an optional header (controls, numbers, notes),
 * a scrolling body and an optional footer. A bottom sheet on phones, a
 * centred modal from `sm` up, raised above the map toolbar.
 *
 * On phones only the title row stays pinned and the rest of the header
 * scrolls with the body, so a tall header cannot squeeze the content.
 */
export function DialogShell({
  title,
  onOpenEffect,
  theme,
  portalContainer,
  subtitle,
  eyebrow,
  context,
  toolbar,
  summary,
  headerExtra,
  footer,
  closeLabel = 'Close',
  size = 'lg',
  open = true,
  onOpenChange,
  onClose,
  trigger,
  className,
  bodyClassName,
  contentProps,
  children,
}: DialogShellProps) {
  const embedded = useWorkspace()?.placement === 'container'
  const hasExtras = Boolean(toolbar || summary || headerExtra)
  const [closeRequest, setCloseRequest] = useState({ open, closing: false })
  // A controlled reopen cancels a pending user close before anything commits.
  if (closeRequest.open !== open) setCloseRequest({ open, closing: open ? false : closeRequest.closing })
  const effectiveOpen = open && !closeRequest.closing
  const { present } = useMotionPresence(effectiveOpen)
  const pendingClose = useRef(false)
  const previousOpen = useRef(open)
  const returnFocus = useRef<HTMLElement | null>(null)
  const callbacks = useRef({ onClose, onOpenChange })
  useLayoutEffect(() => {
    callbacks.current = { onClose, onOpenChange }
  }, [onClose, onOpenChange])

  useLayoutEffect(() => {
    if (open && !previousOpen.current) {
      pendingClose.current = false
    }
    previousOpen.current = open
  }, [open])

  useEffect(() => {
    if (present || !closeRequest.closing || !pendingClose.current) return
    pendingClose.current = false
    callbacks.current.onClose?.()
    callbacks.current.onOpenChange?.(false)
  }, [present, closeRequest.closing])

  const requestClose = () => {
    if (!effectiveOpen || pendingClose.current) return
    pendingClose.current = true
    setCloseRequest({ open, closing: true })
  }

  return (
    <Dialog
      open={effectiveOpen}
      onOpenChange={(next) => {
        if (!next) requestClose()
        else {
          pendingClose.current = false
          setCloseRequest({ open, closing: false })
          onOpenChange?.(true)
        }
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        variant="sheet"
        onOpenEffect={onOpenEffect}
        theme={theme}
        portalContainer={portalContainer}
        elevated
        showClose={false}
        className={cn(
          embedded ? 'max-h-[96%] workspace-sm:max-h-[92%]' : 'max-h-[96dvh] workspace-sm:max-h-[92dvh]',
          sizeClasses[size],
          className,
        )}
        {...contentProps}
        aria-hidden={!effectiveOpen || undefined}
        {...(!effectiveOpen ? { inert: '' } : {})}
        onOpenAutoFocus={() => {
          returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        }}
        onCloseAutoFocus={(event) => {
          if (trigger || !returnFocus.current?.isConnected) return
          event.preventDefault()
          returnFocus.current.focus()
        }}
      >
        {/* Title row: pinned at every width. */}
        <header
          className={cn(
            'flex shrink-0 items-start justify-between gap-3 bg-background/90 p-4 workspace-sm:p-6',
            hasExtras
              ? 'workspace-max-sm:border-b workspace-max-sm:border-border workspace-sm:pb-3'
              : 'border-b border-border',
          )}
        >
          <div className="min-w-0">
            {eyebrow && (
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{eyebrow}</div>
            )}
            <DialogTitle className="text-lg font-bold leading-tight text-foreground workspace-sm:text-xl">
              {title}
            </DialogTitle>
            {subtitle ? (
              <DialogDescription className="mt-1 text-sm leading-snug text-muted-foreground">
                {subtitle}
              </DialogDescription>
            ) : (
              // Radix warns without a description; an empty one keeps the title as the only label.
              <DialogDescription className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</DialogDescription>
            )}
            {context && <p className="mt-1 text-xs font-medium text-sky-700 dark:text-sky-400">{context}</p>}
          </div>
          <DialogClose asChild>
            <button
              type="button"
              aria-label={closeLabel}
              className="-m-1 shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground touch:p-2.5"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </DialogClose>
        </header>

        {/*
          Phones: controls, numbers and notes scroll away with the content so
          it is not squeezed under a half-screen header. From sm up they stay
          fixed and only the content scrolls.
        */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain workspace-sm:flex workspace-sm:flex-col workspace-sm:overflow-hidden">
          {hasExtras && (
            <div className="space-y-3 border-b border-border bg-background/90 p-4 workspace-sm:shrink-0 workspace-sm:px-6 workspace-sm:pb-6 workspace-sm:pt-0">
              {toolbar}
              {summary}
              {headerExtra}
            </div>
          )}
          <div
            className={cn(
              'bg-muted/20 p-3 workspace-sm:min-h-0 workspace-sm:flex-1 workspace-sm:overflow-y-auto workspace-sm:overscroll-contain workspace-sm:p-6',
              bodyClassName,
            )}
          >
            {children}
          </div>
        </div>

        {footer && (
          <footer className="shrink-0 border-t border-border bg-background/90 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] workspace-sm:p-4">
            {footer}
          </footer>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Settings, pickers and libraries: `DialogShell` with an optional footer and
 * a plain background body. Use `RecordDialog` for one record's history.
 */
export function PanelDialog({ bodyClassName, ...props }: DialogShellProps) {
  return <DialogShell {...props} bodyClassName={cn('bg-background', bodyClassName)} />
}
