import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@pgmaps/geo-toolkit/ui/dialog'
import { WorkspaceProvider } from '@pgmaps/geo-toolkit/workspace'
import { DialogShell } from '@pgmaps/geo-toolkit/ui/dialog-shell'
import { RecordDialog } from '@pgmaps/geo-toolkit/ui/record-dialog'
import '@pgmaps/geo-toolkit/styles.css'

/** A host that lays its children out with a gap and takes its dialogs inside itself. */
function GapHost() {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  return (
    <div ref={setHost} data-testid="gap-host" style={{ display: 'flex', flexDirection: 'column', gap: 8, height: 160 }}>
      <div data-testid="gap-host-pane" style={{ flex: 1, minHeight: 0 }} />
      <button data-testid="gap-host-bar" onClick={() => setOpen(true)}>
        Open hosted shell
      </button>
      {open && (
        <DialogShell
          title="Hosted shell"
          portalContainer={host}
          onClose={() => setOpen(false)}
          closeLabel="Dismiss hosted shell"
        >
          <p>Mounted inside its host.</p>
        </DialogShell>
      )}
    </div>
  )
}

function Fixture() {
  const [open, setOpen] = useState(false)
  const [chromeHidden, setChromeHidden] = useState(false)
  const [conditional, setConditional] = useState<'shell' | 'record' | null>(null)
  const [controlledOpen, setControlledOpen] = useState(false)
  const [closeCount, setCloseCount] = useState(0)
  const closeConditional = () => {
    setCloseCount((count) => count + 1)
    setConditional(null)
  }
  return (
    <WorkspaceProvider placement="viewport" responsive="viewport">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger>Open settings</DialogTrigger>
        <DialogContent variant="sheet" onOpenEffect={setChromeHidden}>
          <div style={{ padding: 24 }}>
            <DialogTitle>Map settings</DialogTitle>
            <DialogDescription>Adjust this workspace.</DialogDescription>
            <label>
              Workspace note
              <input aria-label="Workspace note" defaultValue="Keep this edit" />
            </label>
            <DialogClose data-testid="dialog-done">Done</DialogClose>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog>
        <DialogTrigger>Open drawer settings</DialogTrigger>
        <DialogContent variant="sheet" sheetWide="end">
          <div style={{ padding: 24 }}>
            <DialogTitle>Drawer settings</DialogTitle>
            <DialogDescription>A sheet on a phone, a drawer above it.</DialogDescription>
            <DialogClose>Done</DialogClose>
          </div>
        </DialogContent>
      </Dialog>
      <button onClick={() => setConditional('shell')}>Open conditional shell</button>
      <button onClick={() => setConditional('record')}>Open conditional record</button>
      {conditional === 'shell' && (
        <DialogShell title="Conditional shell" onClose={closeConditional} closeLabel="Dismiss shell">
          <input aria-label="Shell note" defaultValue="Keep this edit" />
        </DialogShell>
      )}
      {conditional === 'record' && (
        <RecordDialog
          title="Conditional record"
          onClose={closeConditional}
          closeLabel="Dismiss record"
          source="Fixture source"
        >
          <input aria-label="Record note" defaultValue="Keep this edit" />
        </RecordDialog>
      )}
      <output data-testid="close-count">{closeCount}</output>
      <DialogShell
        title="Controlled shell"
        open={controlledOpen}
        onOpenChange={setControlledOpen}
        onClose={() => setCloseCount((count) => count + 1)}
        trigger={<button>Open controlled shell</button>}
        closeLabel="Dismiss controlled shell"
      >
        <input aria-label="Controlled note" defaultValue="Keep this edit" />
      </DialogShell>
      <button data-testid="hide-controlled" onClick={() => setControlledOpen(false)}>
        Hide controlled shell
      </button>
      <button data-testid="show-controlled" onClick={() => setControlledOpen(true)}>
        Show controlled shell
      </button>
      <output data-testid="chrome-state">{chromeHidden ? 'hidden' : 'visible'}</output>
      <button>Background action</button>
      <GapHost />
    </WorkspaceProvider>
  )
}

document.documentElement.style.cssText = 'height:100%'
document.body.style.cssText = 'margin:0;height:100%;font:14px sans-serif'
document.getElementById('root')!.style.height = '100%'
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
)
