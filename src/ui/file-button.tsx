import { forwardRef, useRef, type InputHTMLAttributes } from 'react'

import { Button, type ButtonProps } from './button.js'
import { takeInputFiles } from './picked-files.js'

type DataAttributes = { [key: `data-${string}`]: string | undefined }

export type FileButtonProps = Omit<ButtonProps, 'type' | 'asChild' | 'onClick' | 'onChange'> & {
  /** Accessible name of the hidden file input, e.g. "Import boundary file". */
  label: string
  /** Receives the chosen files; it is not called when the picker is cancelled. */
  onFiles: (files: File[]) => void
  accept?: string
  multiple?: boolean
  /** Pass-through for the hidden input, such as a test hook. */
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & DataAttributes
}

/**
 * A button that opens the file picker: an import action in a toolbar or panel, styled like
 * any other `Button` (outline, small by default). The input is cleared after each pick, so
 * choosing the same file again still delivers it. Use `FileDropField` where a drop target
 * or a folder is wanted as well.
 */
export const FileButton = forwardRef<HTMLButtonElement, FileButtonProps>(function FileButton(
  { label, onFiles, accept, multiple = false, inputProps, variant = 'outline', size = 'sm', disabled, ...props },
  ref,
) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button
        {...props}
        ref={ref}
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        onClick={() => input.current?.click()}
      />
      <input
        aria-label={label}
        {...inputProps}
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        tabIndex={-1}
        onChange={(event) => {
          const files = takeInputFiles(event.target)
          if (files.length) onFiles(files)
        }}
      />
    </>
  )
})
