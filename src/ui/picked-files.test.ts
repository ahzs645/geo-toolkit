import { describe, expect, it } from 'vitest'
import { filesFromDrop, filesFromInput, takeInputFiles } from './picked-files.js'

const file = (name: string, webkitRelativePath = '') =>
  Object.defineProperty(new File(['x'], name), 'webkitRelativePath', { value: webkitRelativePath })

describe('picked files', () => {
  it('keeps the folder path from a folder input and falls back to the name', () => {
    const list = [file('a.gdbtable', 'PG.gdb/a.gdbtable'), file('b.zip')] as unknown as FileList
    expect(filesFromInput(list).map((entry) => entry.path)).toEqual(['PG.gdb/a.gdbtable', 'b.zip'])
    expect(filesFromInput(null)).toEqual([])
  })

  it('walks a dropped folder across the 100-entry reader batches', async () => {
    const entry = (name: string) => ({
      name,
      isFile: true,
      file: (resolve: (value: File) => void) => resolve(file(name)),
    })
    const batches = [
      Array.from({ length: 100 }, (_, index) => entry(`${index}.gdbtable`)),
      [entry('last.gdbtable')],
      [],
    ]
    const folder = {
      name: 'PG.gdb',
      isFile: false,
      createReader: () => ({ readEntries: (resolve: (value: unknown) => void) => resolve(batches.shift()) }),
    }
    const transfer = { items: [{ webkitGetAsEntry: () => folder }], files: [] } as unknown as DataTransfer
    const picked = await filesFromDrop(transfer)
    expect(picked).toHaveLength(101)
    expect(picked.at(-1)?.path).toBe('PG.gdb/last.gdbtable')
  })

  it('uses the plain file list when the browser gives no entries', async () => {
    const transfer = { items: [], files: [file('tile.laz')] } as unknown as DataTransfer
    expect((await filesFromDrop(transfer)).map((entry) => entry.path)).toEqual(['tile.laz'])
  })

  it('takes an input’s files before clearing it, so the same file can be chosen again', () => {
    const chosen = [file('boundary.geojson')]
    const input = {
      value: 'C:\\fakepath\\boundary.geojson',
      // A real FileList empties when the input is cleared.
      get files() {
        return this.value ? chosen : []
      },
    }
    expect(takeInputFiles(input).map((entry) => entry.name)).toEqual(['boundary.geojson'])
    expect(input.value).toBe('')
    expect(takeInputFiles({ files: null, value: '' })).toEqual([])
  })
})
