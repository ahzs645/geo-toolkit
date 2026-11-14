import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../utils.js'
import { Button } from './button.js'

/** One button in a popup card's footer. */
export type MapPopupFooterAction = {
  label: string
  onClick: () => void
  /**
   * The action that changes something (load, add, apply). It is drawn filled on a row of its own.
   * Leave it off a button that only opens another view: those share a row as equals.
   */
  primary?: boolean
  disabled?: boolean
}

type MapPopupCardProps = {
  title: ReactNode
  /** Small label above the title, e.g. the layer name. */
  eyebrow?: ReactNode
  subtitle?: ReactNode
  /** Buttons or links under the content. */
  actions?: ReactNode
  /**
   * The card's buttons, in a footer under a rule that runs to the card's edges. A `primary` action
   * is filled and full width; the others are equal outline buttons side by side, each on its own
   * row when the labels do not fit. The rule reaches the edges of a container with the popup's
   * default padding (`p-3`), which is what `MapPopup` gives.
   */
  footerActions?: MapPopupFooterAction[]
  /** Small controls beside the close button, e.g. a feature actions menu. */
  headerActions?: ReactNode
  onClose?: () => void
  closeLabel?: string
  children?: ReactNode
  className?: string
}

/**
 * The inside of a map popup or floating detail card: label, title, optional
 * close button, content (usually `KeyValueRows`), actions. The close button
 * always has a label and a finger-sized hit area on touch screens.
 */
export function MapPopupCard({
  title,
  eyebrow,
  subtitle,
  actions,
  footerActions,
  headerActions,
  onClose,
  closeLabel = 'Close details',
  children,
  className,
}: MapPopupCardProps) {
  const primaryActions = footerActions?.filter((action) => action.primary) ?? []
  const openActions = footerActions?.filter((action) => !action.primary) ?? []
  return (
    <div className={cn('min-w-0 space-y-2 text-xs', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</div>
          )}
          <div className="text-sm font-semibold leading-snug text-foreground">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        {(headerActions || onClose) && (
          <div className="-m-1 flex shrink-0 items-center gap-0.5">
            {headerActions}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground touch:p-3"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
      {children}
      {actions && <div className="flex flex-wrap gap-2 pt-1">{actions}</div>}
      {footerActions && footerActions.length > 0 && (
        <div className="-mx-3 -mb-3 !mt-3 space-y-1.5 border-t px-3 py-2" data-map-popup-footer="">
          {primaryActions.map((action) => (
            <Button key={action.label} size="xs" className="w-full" disabled={action.disabled} onClick={action.onClick}>
              {action.label}
            </Button>
          ))}
          {openActions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {openActions.map((action) => (
                <Button
                  key={action.label}
                  size="xs"
                  variant="outline"
                  className="flex-1"
                  disabled={action.disabled}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
