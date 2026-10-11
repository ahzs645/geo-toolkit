import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LoaderCircle, Maximize, Minimize, MoreHorizontal } from 'lucide-react'
import { Button } from './button.js'
import { DialogShell, type DialogShellProps } from './dialog-shell.js'
import { cn } from '../utils.js'

/** Expand the existing content to the full viewport without remounting it. */
export function useElementFullscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    if (!fullscreen) return
    const element = ref.current
    const previousFocus = document.activeElement as HTMLElement | null
    const keydown = (event: KeyboardEvent) => {
      // A modal inside an expanded panel owns Escape and its focus trap.
      if (element?.querySelector('[role="dialog"][data-state="open"]')) return
      const activePanel = document.activeElement?.closest('[data-fullscreen="true"]')
      if (element?.querySelector('[data-fullscreen="true"]')) return
      if (activePanel && activePanel !== element && element && !activePanel.contains(element)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setFullscreen(false)
      }
      if (event.key === 'Tab' && element) {
        const controls = [
          ...element.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          ),
        ].filter((control) => control.getClientRects().length > 0)
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', keydown, true)
    return () => {
      document.removeEventListener('keydown', keydown, true)
      previousFocus?.focus({ preventScroll: true })
    }
  }, [fullscreen])
  const toggle = () => setFullscreen((previous) => !previous)
  return { ref, fullscreen, toggle }
}

export function FullscreenButton({
  title,
  fullscreen,
  onClick,
  compact = false,
}: {
  title: string
  fullscreen: boolean
  onClick: () => void
  compact?: boolean
}) {
  const label = `${fullscreen ? 'Exit fullscreen' : 'Fullscreen'} ${title}`
  const Icon = fullscreen ? Minimize : Maximize
  return (
    <Button
      variant="ghost"
      size="sm"
      className={compact ? 'size-8 px-0' : undefined}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon className="size-4" aria-hidden="true" />
    </Button>
  )
}

export function FullscreenPanel({
  title,
  actions,
  children,
  className,
  compact = false,
  menuActions,
  help,
  loading = false,
  dialogOptions,
}: {
  title: string
  actions?: ReactNode
  children: (fullscreen: boolean) => ReactNode
  className?: string
  /** Keep controls in one row, with a smaller title/button and truncation for long titles. */
  compact?: boolean
  /** Compact chart options; host callbacks own capture, formats and download transport. */
  menuActions?: readonly {
    id: string
    label: string
    onSelect: (panel: HTMLElement) => void | Promise<void>
    disabled?: boolean
  }[]
  help?: ReactNode
  loading?: boolean
  /** Standalone hosts can supply their theme and dialog/chrome integration. */
  dialogOptions?: Pick<DialogShellProps, 'theme' | 'onOpenEffect'>
}) {
  const { ref, fullscreen, toggle } = useElementFullscreen<HTMLElement>()
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <section
      ref={ref}
      aria-label={title}
      aria-busy={loading || undefined}
      data-fullscreen={fullscreen || undefined}
      className={cn(
        'relative min-w-0 rounded-xl border bg-card p-3 [&[data-fullscreen]]:fixed [&[data-fullscreen]]:inset-0 [&[data-fullscreen]]:z-[1400] [&[data-fullscreen]]:h-dvh [&[data-fullscreen]]:overflow-auto [&[data-fullscreen]]:rounded-none [&[data-fullscreen]]:bg-background [&[data-fullscreen]]:p-5',
        className,
      )}
    >
      <div className={cn('mb-2 flex flex-wrap items-center justify-between gap-2', compact && 'flex-nowrap gap-1')}>
        <h2
          className={compact ? 'min-w-0 truncate text-sm font-semibold' : 'text-base font-semibold'}
          title={compact ? title : undefined}
        >
          {title}
        </h2>
        <div className={cn('flex flex-wrap items-center gap-2', compact && 'shrink-0 flex-nowrap gap-1')}>
          {actions}
          {(menuActions?.length || help) && (
            <DialogShell
              {...dialogOptions}
              title={`${title} options`}
              open={optionsOpen}
              onOpenChange={(open) => {
                setOptionsOpen(open)
                setError('')
              }}
              portalContainer={ref.current}
              size="md"
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-8 px-0"
                  aria-label={`Chart options ${title}`}
                  title={`Chart options ${title}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            >
              <div className="space-y-3">
                {help && <div className="text-sm text-muted-foreground">{help}</div>}
                <div className="flex flex-wrap gap-2">
                  {menuActions?.map((action) => (
                    <Button
                      key={action.id}
                      variant="outline"
                      size="sm"
                      disabled={busy || action.disabled}
                      onClick={async () => {
                        if (!ref.current) return
                        setBusy(true)
                        setError('')
                        try {
                          await action.onSelect(ref.current)
                        } catch (cause) {
                          setError(cause instanceof Error ? cause.message : 'Could not complete the chart action.')
                        } finally {
                          setBusy(false)
                        }
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
                {busy && (
                  <p role="status" className="text-xs">
                    Preparing chart…
                  </p>
                )}
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
              </div>
            </DialogShell>
          )}
          <FullscreenButton title={title} fullscreen={fullscreen} onClick={toggle} compact={compact} />
        </div>
      </div>
      {children(fullscreen)}
      {loading && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-card/60"
        >
          <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </section>
  )
}
