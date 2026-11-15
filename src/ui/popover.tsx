import * as PopoverPrimitive from '@radix-ui/react-popover'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '../utils.js'
import { useWorkspace } from '../workspace/workspace-context.js'
import { usePanelPortalContainer } from './panel-portal.js'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor
export const PopoverClose = PopoverPrimitive.Close

/**
 * A floating panel anchored to its trigger: it flips and shifts to stay on screen, closes on
 * Escape or a press outside, and returns focus to the trigger. It works inside a modal `Dialog`
 * and inside another popover (it carries `data-floating-layer`, which an outer popover reads as
 * "not a press outside"), and follows a detached panel into its own window.
 */
export const PopoverContent = forwardRef<
  ElementRef<typeof PopoverPrimitive.Content>,
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & { container?: Element | null }
>(({ className, align = 'start', sideOffset = 6, collisionPadding = 8, container, onKeyDown, ...props }, ref) => {
  const panelContainer = usePanelPortalContainer()
  const workspace = useWorkspace()
  return (
    <PopoverPrimitive.Portal container={container ?? panelContainer ?? workspace?.root ?? undefined}>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        data-floating-layer=""
        data-theme={workspace?.theme}
        className={cn(
          'geo-toolkit geo-popover z-workspace-popover rounded-md border border-border bg-popover text-popover-foreground shadow-xl outline-none',
          workspace?.theme === 'dark' && 'dark',
          className,
        )}
        {...props}
        // React events cross a portal to the trigger's React ancestors. An Escape that closes this
        // popover must not also reach a panel or dock around the trigger that closes on Escape.
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.stopPropagation()
          onKeyDown?.(event)
        }}
      />
    </PopoverPrimitive.Portal>
  )
})
PopoverContent.displayName = 'PopoverContent'
