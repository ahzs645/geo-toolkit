import { FileUp, FolderOpen } from 'lucide-react'
import { useRef, useState, type HTMLAttributes, type InputHTMLAttributes } from 'react'

import { cn } from '../utils.js'
import { Button } from './button.js'
import { filesFromDrop, filesFromInput, type PickedFile } from './picked-files.js'
import { useElementSize } from './use-element-size.js'
import { useSizeFold } from './use-size-fold.js'

/**
 * The field's width does not follow its content, so folding cannot move it: the gap only keeps
 * a pane dragged across the line from flickering.
 */
const ICON_FOLD_GAP_PX = 16

type DataAttributes = { [key: `data-${string}`]: string | undefined }

export type FileDropFieldProps = {
  /** Names the hidden inputs for assistive technology: `<label> files`, `<label> folder`. */
  label: string
  /** Receives every chosen file with its relative path. Drops are not filtered by `accept`. */
  onFiles: (files: PickedFile[]) => void | Promise<unknown>
  /** A dropped folder can fail to read; without this the rejection is unhandled. */
  onError?: (error: unknown) => void
  accept?: string
  filesLabel?: string
  /** Adds a folder button, for sources such as a `.gdb` that are folders. */
  folderLabel?: string
  /** `false` for a field that takes one file, such as an import; a drop still hands over every file. */
  multiple?: boolean
  dropHint?: string
  /**
   * Below this width in pixels the buttons show only their icons, named by a hover tip, and the
   * hint sits beside them on the same row. Unset, the buttons keep their labels at every width.
   */
  iconsBelow?: number
  disabled?: boolean
  className?: string
  /** Pass-through for the drop area, such as a test hook. */
  dropProps?: HTMLAttributes<HTMLDivElement> & DataAttributes
  inputProps?: InputHTMLAttributes<HTMLInputElement> & DataAttributes
  folderInputProps?: InputHTMLAttributes<HTMLInputElement> & DataAttributes
}

/** Local files for a workspace: pick files, optionally a folder, or drop either onto the field. */
export function FileDropField({
  label,
  onFiles,
  onError,
  accept,
  filesLabel = 'Add files',
  folderLabel,
  multiple = true,
  dropHint = 'or drop here',
  iconsBelow,
  disabled = false,
  className,
  dropProps,
  inputProps,
  folderInputProps,
}: FileDropFieldProps) {
  const filesRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const fieldRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const { width } = useElementSize(iconsBelow === undefined ? null : fieldRef)
  const iconsOnly = useSizeFold(iconsBelow === undefined ? 0 : width, {
    foldBelow: iconsBelow ?? 0,
    unfoldFrom: (iconsBelow ?? 0) + ICON_FOLD_GAP_PX,
  })
  // An icon-only button keeps its label as its name and its hover tip.
  const iconProps = (name: string) =>
    iconsOnly ? { 'aria-label': name, title: name, className: 'touch:h-10 w-9 shrink-0 px-0 touch:w-10' } : {}
  const deliver = (pending: Promise<PickedFile[]>) => {
    void pending.then(onFiles).catch(onError)
  }
  const pick = (input: HTMLInputElement) => {
    const files = filesFromInput(input.files)
    // Reset so choosing the same file again still fires a change.
    input.value = ''
    deliver(Promise.resolve(files))
  }
  return (
    <div
      {...dropProps}
      ref={fieldRef}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        if (!disabled) deliver(filesFromDrop(event.dataTransfer))
      }}
      className={cn(
        'flex items-center gap-2 rounded-md border border-dashed border-border p-2 transition-colors',
        !iconsOnly && 'flex-wrap',
        dragging && 'border-primary bg-primary/5',
        className,
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="touch:h-10"
        disabled={disabled}
        onClick={() => filesRef.current?.click()}
        {...iconProps(filesLabel)}
      >
        <FileUp className={cn('h-4 w-4', !iconsOnly && 'mr-1.5')} aria-hidden="true" />
        {!iconsOnly && filesLabel}
      </Button>
      {folderLabel && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="touch:h-10"
          disabled={disabled}
          onClick={() => folderRef.current?.click()}
          {...iconProps(folderLabel)}
        >
          <FolderOpen className={cn('h-4 w-4', !iconsOnly && 'mr-1.5')} aria-hidden="true" />
          {!iconsOnly && folderLabel}
        </Button>
      )}
      <span className={cn('text-xs text-muted-foreground', iconsOnly && 'min-w-0 flex-1')}>{dropHint}</span>
      <input
        aria-label={`${label} files`}
        {...inputProps}
        ref={filesRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(event) => pick(event.currentTarget)}
      />
      {folderLabel && (
        <input
          aria-label={`${label} folder`}
          {...folderInputProps}
          {...{ webkitdirectory: '', directory: '' }}
          ref={folderRef}
          type="file"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(event) => pick(event.currentTarget)}
        />
      )}
    </div>
  )
}
