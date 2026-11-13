import { useEffect, useId, useRef, useState } from 'react'
import { AppWindow, ExternalLink, PanelsTopLeft } from 'lucide-react'
import { Button } from './button.js'
import type { PanelWindowMode } from './panel-window.js'

/** Shared panel-header chooser; opens synchronously so the browser retains user activation. */
export function PanelWindowButton({ title, onOpen }: { title: string; onOpen: (mode: PanelWindowMode) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const doc = root.current!.ownerDocument
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      trigger.current?.focus()
    }
    root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    doc.addEventListener('pointerdown', dismiss)
    doc.addEventListener('keydown', key, true)
    return () => {
      doc.removeEventListener('pointerdown', dismiss)
      doc.removeEventListener('keydown', key, true)
    }
  }, [open])
  return (
    <div ref={root} className="relative shrink-0">
      <Button
        ref={trigger}
        type="button"
        variant="ghost"
        size="sm"
        className="size-8 px-0"
        aria-label={`Open ${title} separately`}
        title="Open panel in a separate window or tab"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <ExternalLink className="size-4" aria-hidden="true" />
      </Button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={`Open ${title} separately`}
          className="absolute right-0 top-full z-[1500] grid w-52 gap-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-xl"
          onKeyDown={(event) => {
            const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
            const index = options.indexOf(event.currentTarget.ownerDocument.activeElement as HTMLButtonElement)
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              options[(index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length]?.focus()
            } else if (event.key === 'Home' || event.key === 'End') {
              event.preventDefault()
              options[event.key === 'Home' ? 0 : options.length - 1]?.focus()
            } else if (event.key === 'Tab') setOpen(false)
          }}
        >
          {(['window', 'tab'] as const).map((mode) => {
            const Icon = mode === 'window' ? AppWindow : PanelsTopLeft
            return (
              <Button
                key={mode}
                type="button"
                role="menuitem"
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => {
                  setOpen(false)
                  onOpen(mode)
                }}
              >
                <Icon className="size-4" aria-hidden="true" />
                {mode === 'window' ? 'Open in new window' : 'Open in new tab'}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
