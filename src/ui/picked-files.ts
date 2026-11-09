/** A chosen file and its path within what was picked, so folder structure survives. */
export type PickedFile = { file: File; path: string }

export function filesFromInput(list: FileList | null): PickedFile[] {
  return [...(list ?? [])].map((file) => ({ file, path: file.webkitRelativePath || file.name }))
}

/**
 * Copies a file input's chosen files and clears it, so choosing the same file again still
 * fires a change. The copy comes first: clearing the input empties its `FileList`.
 */
export function takeInputFiles(input: { files: ArrayLike<File> | null; value: string }): File[] {
  const files = Array.from(input.files ?? [])
  input.value = ''
  return files
}

/** Files from a drop, walking dropped folders (a `.gdb` is a folder). */
export async function filesFromDrop(transfer: DataTransfer): Promise<PickedFile[]> {
  const entries = [...transfer.items]
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => !!entry)
  if (!entries.length) return filesFromInput(transfer.files)
  const out: PickedFile[] = []
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject))
      out.push({ file, path: `${prefix}${entry.name}` })
      return
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    const children: FileSystemEntry[] = []
    // readEntries returns at most 100 entries per call.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
      if (!batch.length) break
      children.push(...batch)
    }
    for (const child of children) await walk(child, `${prefix}${entry.name}/`)
  }
  for (const entry of entries) await walk(entry, '')
  return out
}
