import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { cn } from '../utils.js'
import { useWorkspace, useWorkspacePresentation } from '../workspace/workspace-context.js'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

function DialogOpenEffect({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  React.useEffect(() => {
    onOpenChange?.(true)
    return () => onOpenChange?.(false)
  }, [onOpenChange])
  return null
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('geo-motion-dialog-overlay fixed inset-0 z-50 bg-black/50 backdrop-blur-sm', className)}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

export type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /**
   * `center` (default): classic centered modal.
   * `sheet`: full-width bottom sheet on mobile, centered modal on desktop.
   */
  variant?: 'center' | 'sheet'
  theme?: 'light' | 'dark'
  portalContainer?: HTMLElement | null
  onOpenEffect?: (open: boolean) => void
  /**
   * Raise overlay and content to z-[1200] for dialogs above map controls.
   * Hosts can manage their chrome through onOpenEffect or the workspace callback.
   */
  elevated?: boolean
  /** Render the built-in top-right close button (default true). */
  showClose?: boolean
  /** Extra classes for the backdrop overlay. */
  overlayClassName?: string
}

const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  (
    {
      className,
      children,
      variant = 'center',
      elevated = false,
      showClose = true,
      overlayClassName,
      portalContainer,
      onOpenEffect,
      theme: themeInput,
      ...props
    },
    ref,
  ) => {
    const workspace = useWorkspace()
    const presentation = useWorkspacePresentation()
    const theme = themeInput ?? workspace?.theme ?? 'light'
    const effect = onOpenEffect ?? workspace?.onDialogOpenChange
    const embedded = workspace?.placement === 'container'
    const position = embedded ? 'absolute' : 'fixed'
    const layer = elevated ? 'z-[1200]' : 'z-50'
    return (
      <DialogPortal container={portalContainer ?? workspace?.root}>
        <div
          // Radix Portal watches this node's animation. Its no-op exit animation
          // keeps the theme wrapper around until the inner surfaces finish.
          className={cn('geo-toolkit geo-motion-dialog-root', theme === 'dark' && 'dark')}
          data-theme={theme}
          data-workspace-responsive={presentation.responsive}
          {...presentation.responsiveAttributes}
          style={{
            ...(embedded ? { position: 'absolute', inset: 0, pointerEvents: 'none' } : {}),
            ...(presentation.responsive === 'container'
              ? { containerType: 'inline-size', containerName: 'geo-reading' }
              : {}),
          }}
        >
          <DialogOverlay className={cn(layer, embedded && 'absolute pointer-events-auto', overlayClassName)} />
          <DialogPrimitive.Content
            ref={ref}
            data-dialog-variant={variant}
            className={cn(
              layer,
              position,
              'geo-motion-dialog-content pointer-events-auto',
              variant === 'sheet'
                ? // Bottom sheet on mobile, centered modal on desktop.
                  'inset-x-0 bottom-0 top-auto flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-background/95 shadow-2xl backdrop-blur workspace-sm:inset-x-auto workspace-sm:bottom-auto workspace-sm:left-[50%] workspace-sm:top-[50%] workspace-sm:max-h-[calc(100dvh-2rem)] workspace-sm:w-[calc(100%-2rem)] workspace-sm:max-w-lg workspace-sm:rounded-2xl'
                : 'left-[50%] top-[50%] grid w-[calc(100%-2rem)] max-w-lg gap-4 rounded-xl border border-border bg-background p-6 shadow-xl',
              embedded &&
                (variant === 'sheet' ? 'max-h-[96%] workspace-sm:max-h-[calc(100%-2rem)]' : 'max-h-[calc(100%-2rem)]'),
              className,
            )}
            {...props}
          >
            {effect && <DialogOpenEffect onOpenChange={effect} />}
            {children}
            {showClose && (
              <DialogPrimitive.Close
                className="absolute right-4 top-4 rounded-md text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            )}
          </DialogPrimitive.Content>
        </div>
      </DialogPortal>
    )
  },
)
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-left', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse gap-2 workspace-sm:flex-row workspace-sm:justify-end', className)}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
