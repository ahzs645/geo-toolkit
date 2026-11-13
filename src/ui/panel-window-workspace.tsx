import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AppWindow, ExternalLink, Undo2 } from 'lucide-react'
import { Button } from './button.js'
import { DialogShell, type DialogShellProps } from './dialog-shell.js'
import { parsePanelWindowLayouts, type PanelWindowLayout, type PanelWindowMode } from './panel-window-layout.js'

export interface DetachedPanel {
  id: string
  slot: string | null
  title: string
  focus: () => void
  restore: () => void
  mode: PanelWindowMode
  snapshot: () => Omit<PanelWindowLayout, 'slot'>
}

interface PanelFrame extends DetachedPanel {
  detached: boolean
  open?: (placement: PanelWindowLayout) => void
  error?: string
  place?: (placement: PanelWindowLayout) => void
}

interface PanelWindowRegistry {
  panels: readonly DetachedPanel[]
  pending: readonly (PanelWindowLayout & { title: string; available: boolean; error?: string })[]
  register: (panel: PanelFrame) => () => void
  snapshot: () => PanelWindowLayout[]
  applyLayout: (layout: readonly PanelWindowLayout[], key?: string, force?: boolean) => void
  openSaved: (slot: string) => void
  skipSaved: (slot: string) => void
}

const WindowRegistry = createContext<PanelWindowRegistry | null>(null)
const WindowSlot = createContext<string | null>(null)

/** One independent set of detached panels. Layouts can reclaim their slots without unmounting them. */
export function PanelWindowProvider({ children }: { children: ReactNode }) {
  const [frames, setFrames] = useState<readonly PanelFrame[]>([])
  const [planned, setPlanned] = useState<readonly PanelWindowLayout[]>([])
  const appliedLayout = useRef<string>()
  const register = useCallback((panel: PanelFrame) => {
    setFrames((previous) => [...previous.filter((item) => item.id !== panel.id), panel])
    if (panel.detached) setPlanned((previous) => previous.filter((item) => item.slot !== panel.slot))
    return () => setFrames((previous) => previous.filter((item) => item.id !== panel.id))
  }, [])
  const snapshot = useCallback(() => {
    const open = frames.flatMap((panel) =>
      panel.detached && panel.slot ? [{ slot: panel.slot, ...panel.snapshot() }] : [],
    )
    return [...open, ...planned.filter((plan) => !open.some((panel) => panel.slot === plan.slot))]
  }, [frames, planned])
  const applyLayout = useCallback(
    (layout: readonly PanelWindowLayout[], key?: string, force = false) => {
      const identity = key && `${key}:${JSON.stringify(layout)}`
      if (identity && appliedLayout.current === identity && !force) return
      const plans = parsePanelWindowLayouts(layout)
      appliedLayout.current = identity
      for (const panel of frames) {
        if (!panel.detached) continue
        const placement = plans.find((plan) => plan.slot === panel.slot && plan.mode === panel.mode)
        if (placement) panel.place?.(placement)
        else panel.restore()
      }
      setPlanned(
        plans.filter(
          (plan) => !frames.some((panel) => panel.detached && panel.slot === plan.slot && panel.mode === plan.mode),
        ),
      )
    },
    [frames],
  )
  const openSaved = useCallback(
    (slot: string) => {
      const placement = planned.find((plan) => plan.slot === slot)
      if (placement) frames.find((panel) => panel.slot === slot && panel.open)?.open?.(placement)
    },
    [frames, planned],
  )
  const skipSaved = useCallback(
    (slot: string) => setPlanned((previous) => previous.filter((plan) => plan.slot !== slot)),
    [],
  )
  const value = useMemo(
    () => ({
      panels: frames.filter((panel) => panel.detached),
      pending: planned.map((plan) => {
        const frame = frames.find((panel) => panel.slot === plan.slot && panel.open)
        return { ...plan, title: frame?.title ?? plan.slot, available: !!frame?.open, error: frame?.error }
      }),
      register,
      snapshot,
      applyLayout,
      openSaved,
      skipSaved,
    }),
    [frames, planned, register, snapshot, applyLayout, openSaved, skipSaved],
  )
  return <WindowRegistry.Provider value={value}>{children}</WindowRegistry.Provider>
}

/** Associate a panel with the stable id its layout uses for sizing and visibility. */
export function PanelWindowSlot({ id, children }: { id: string; children: ReactNode }) {
  return <WindowSlot.Provider value={id}>{children}</WindowSlot.Provider>
}

export const usePanelWindows = () => useContext(WindowRegistry)

/** Restore a saved layout even when its picker is on an inactive ribbon tab. */
export function PanelWindowLayoutRestore({
  layout,
  layoutKey,
}: {
  layout?: readonly PanelWindowLayout[]
  layoutKey: string
}) {
  const registry = usePanelWindows()
  useEffect(() => {
    if (layout) registry?.applyLayout(layout, layoutKey)
  }, [registry, layout, layoutKey])
  return null
}

/** Shared registration for FullscreenPanel and custom frames using usePanelWindow. */
export function usePanelWindowRegistration({
  title,
  detached,
  focus,
  restore,
  open,
  mode = 'window',
  snapshot,
  error,
  place,
}: Omit<PanelFrame, 'id' | 'slot' | 'mode' | 'snapshot'> & {
  mode?: PanelWindowMode
  snapshot?: DetachedPanel['snapshot']
}) {
  const registry = usePanelWindows()
  const register = registry?.register
  const slot = useContext(WindowSlot)
  const id = useId()
  const getSnapshot = useCallback(() => snapshot?.() ?? { mode }, [snapshot, mode])
  useEffect(() => {
    return register?.({ id, slot, title, focus, restore, open, mode, snapshot: getSnapshot, error, detached, place })
  }, [detached, register, id, slot, title, focus, restore, open, mode, getSnapshot, error, place])
  return !!registry
}

/** Compact access to every detached panel, independent of its collapsed original slot. */
export function PanelWindowControls({
  className,
  dialogOptions,
}: {
  className?: string
  dialogOptions?: Pick<DialogShellProps, 'theme' | 'onOpenEffect'>
}) {
  const registry = usePanelWindows()
  const panels = registry?.panels ?? []
  const pending = registry?.pending ?? []
  const [open, setOpen] = useState(false)
  if (open && panels.length === 0 && pending.length === 0) setOpen(false)
  if (!panels.length && !pending.length) return null
  const label = !panels.length && pending.length ? 'Open saved panels' : 'Detached panels'
  const count = panels.length || pending.length
  return (
    <DialogShell
      {...dialogOptions}
      title="Detached panels"
      subtitle="These panels stay synced with this workspace."
      open={open}
      onOpenChange={setOpen}
      size="md"
      trigger={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={className}
          aria-label={`${label} (${count})`}
          title={`${label} (${count})`}
        >
          <AppWindow className="size-3.5" aria-hidden="true" />
          <span data-panel-windows-label>{label}</span>
          <span data-panel-windows-count>({count})</span>
        </Button>
      }
    >
      {pending.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs text-muted-foreground">Open each saved panel to restore this layout.</p>
          {pending.map((panel) => (
            <div key={panel.slot} className="space-y-1 rounded-md border p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{panel.title}</span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!panel.available}
                    aria-label={`Open ${panel.title} in saved ${panel.mode}`}
                    onClick={() => registry?.openSaved(panel.slot)}
                  >
                    Open in {panel.mode}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Skip ${panel.title}`}
                    onClick={() => registry?.skipSaved(panel.slot)}
                  >
                    Skip
                  </Button>
                </div>
              </div>
              {panel.error && (
                <p role="alert" className="text-xs text-destructive">
                  {panel.error}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      <ul className="space-y-2">
        {panels.map((panel) => (
          <li key={panel.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
            <span className="min-w-0 text-sm font-medium">
              {panel.title}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {panel.mode === 'window' ? 'Window' : 'Tab'}
              </span>
            </span>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Show ${panel.title}`}
                onClick={panel.focus}
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                Show
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Return ${panel.title} to workspace`}
                onClick={() => {
                  setOpen(false)
                  panel.restore()
                }}
              >
                <Undo2 className="size-3.5" aria-hidden="true" />
                Return to workspace
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </DialogShell>
  )
}
