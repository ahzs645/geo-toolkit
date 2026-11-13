import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { LoaderCircle, Maximize, Minimize, MoreHorizontal, Undo2 } from 'lucide-react'
import { Button } from './button.js'
import { DialogShell, type DialogShellProps } from './dialog-shell.js'
import { usePanelWindow } from './panel-window.js'
import { PanelWindowButton } from './panel-window-button.js'
import { PanelPortalProvider } from './panel-portal.js'
import { usePanelWindowRegistration } from './panel-window-workspace.js'
import type { PanelWindowLayout } from './panel-window-layout.js'
import { cn } from '../utils.js'

/** Expand the existing content to the full viewport without remounting it. */
export function useElementFullscreen<T extends HTMLElement>(ownerDocument?: Document) {
  const ref = useRef<T>(null)
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    if (!fullscreen) return
    const element = ref.current
    const document = element?.ownerDocument ?? globalThis.document
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
  }, [fullscreen, ownerDocument])
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
  detachable = false,
  heading,
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
  /** Offer live windows/tabs. Keep shared selection and edits above the panel. */
  detachable?: boolean
  /**
   * Shown in place of the visible title, such as a picker whose value already names the view.
   * `title` stays the panel's accessible name and a visually hidden heading.
   */
  heading?: ReactNode
}) {
  const panelWindow = usePanelWindow(title)
  const { ref, fullscreen, toggle } = useElementFullscreen<HTMLElement>(panelWindow.container?.ownerDocument)
  const openWindow = panelWindow.open
  const openSaved = useCallback(
    (placement: PanelWindowLayout) => {
      if (ref.current) openWindow(placement.mode, ref.current, placement)
    },
    [openWindow, ref],
  )
  const managed = usePanelWindowRegistration({
    title,
    detached: panelWindow.detached,
    focus: panelWindow.focus,
    restore: panelWindow.close,
    open: detachable ? openSaved : undefined,
    mode: panelWindow.mode,
    snapshot: panelWindow.snapshot,
    error: panelWindow.error,
    place: panelWindow.place,
  })
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const panel = (
    <section
      ref={ref}
      aria-label={title}
      aria-busy={loading || undefined}
      data-fullscreen={fullscreen || undefined}
      data-detached-panel={panelWindow.detached || undefined}
      style={panelWindow.detached ? { width: '100%', height: '100%', flex: '1 1 0%', borderRadius: 0 } : undefined}
      className={cn(
        'relative min-w-0 rounded-xl border bg-card p-3 [&[data-fullscreen]]:fixed [&[data-fullscreen]]:inset-0 [&[data-fullscreen]]:z-[1400] [&[data-fullscreen]]:h-dvh [&[data-fullscreen]]:overflow-auto [&[data-fullscreen]]:rounded-none [&[data-fullscreen]]:bg-background [&[data-fullscreen]]:p-5',
        className,
      )}
    >
      <div className={cn('mb-2 flex flex-wrap items-center justify-between gap-2', compact && 'flex-nowrap gap-1')}>
        {heading ? (
          <div className="flex min-w-0 items-center gap-1">
            <h2 className="sr-only">{title}</h2>
            {heading}
          </div>
        ) : (
          <h2
            className={compact ? 'min-w-0 truncate text-sm font-semibold' : 'text-base font-semibold'}
            title={compact ? title : undefined}
          >
            {title}
          </h2>
        )}
        <div className={cn('flex flex-wrap items-center gap-2', compact && 'shrink-0 flex-nowrap gap-1')}>
          {actions}
          {detachable &&
            (panelWindow.detached ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-8 px-0"
                aria-label={`Return ${title} to workspace`}
                title="Return to workspace"
                onClick={panelWindow.close}
              >
                <Undo2 className="size-4" aria-hidden="true" />
              </Button>
            ) : (
              <PanelWindowButton
                title={title}
                onOpen={(mode) => {
                  if (!ref.current) return
                  if (fullscreen) toggle()
                  panelWindow.open(mode, ref.current)
                }}
              />
            ))}
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
      {panelWindow.error && (
        <p role="alert" className="mb-2 text-xs text-destructive">
          {panelWindow.error}
        </p>
      )}
      {children(fullscreen || panelWindow.detached)}
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
  return (
    <>
      {panelWindow.container
        ? !managed && (
            <div
              aria-label={`${title} · detached`}
              role="group"
              className="flex flex-wrap items-center gap-2 self-start rounded-md border bg-card p-2"
            >
              <span className="text-xs font-medium">{title} · detached</span>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={panelWindow.focus}>
                  Show panel
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={panelWindow.close}>
                  Return to workspace
                </Button>
              </div>
            </div>
          )
        : panel}
      {panelWindow.container &&
        createPortal(
          <PanelPortalProvider value={panelWindow.container}>{panel}</PanelPortalProvider>,
          panelWindow.container,
        )}
    </>
  )
}
