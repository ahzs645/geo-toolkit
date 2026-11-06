import { FileUp, FolderOpen } from 'lucide-react'
import { useRef, useState, type HTMLAttributes, type InputHTMLAttributes } from 'react'

import { cn } from '../utils.js'
import { Button } from './button.js'
import { filesFromDrop, filesFromInput, type PickedFile } from './picked-files.js'

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
  dropHint?: string
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
  dropHint = 'or drop here',
  disabled = false,
  className,
  dropProps,
  inputProps,
  folderInputProps,
}: FileDropFieldProps) {
  const filesRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
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
        'flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border p-2 transition-colors',
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
      >
        <FileUp className="mr-1.5 h-4 w-4" aria-hidden="true" />
        {filesLabel}
      </Button>
      {folderLabel && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="touch:h-10"
          disabled={disabled}
          onClick={() => folderRef.current?.click()}
        >
          <FolderOpen className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {folderLabel}
        </Button>
      )}
      <span className="text-xs text-muted-foreground">{dropHint}</span>
      <input
        aria-label={`${label} files`}
        {...inputProps}
        ref={filesRef}
        type="file"
        multiple
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
