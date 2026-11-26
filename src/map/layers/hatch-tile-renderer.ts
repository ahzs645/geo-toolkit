/**
 * Draws hatch map tiles for `MapHatchLayer`: in a worker where the page can start one, otherwise on
 * the page's thread one tile a task. Areas are sent once by key and projected there; each tile is a
 * job that an abort cancels while it still waits. One renderer serves every hatch layer of a page.
 */
import {
  prepareHatchAreas,
  renderHatchTile,
  type HatchTileAreas,
  type PreparedHatchAreas,
} from '../../patterns/hatch-tiles.js'
import type { HatchRgbaImage } from '../../patterns/raster.js'
import type { OrganicHatchRecipe } from '../../patterns/recipe.js'

export interface HatchTileJob {
  type: 'tile'
  id: number
  areas: string
  recipe: OrganicHatchRecipe
  anchor: [number, number]
  z: number
  x: number
  y: number
  tileSize: number
  pixelRatio: number
}

export type HatchWorkerMessage =
  | { type: 'areas'; key: string; areas: HatchTileAreas }
  | { type: 'drop'; key: string }
  | { type: 'cancel'; id: number }
  | HatchTileJob

type Reply = { id: number; image?: HatchRgbaImage | null; error?: string }

export interface HatchTileRenderer {
  setAreas(key: string, areas: HatchTileAreas): void
  dropAreas(key: string): void
  render(job: Omit<HatchTileJob, 'type' | 'id'>, signal?: AbortSignal): Promise<HatchRgbaImage | null>
  dispose(): void
}

const abortError = () => Object.assign(new Error('The hatch tile left the view.'), { name: 'AbortError' })

/** A renderer posting to `worker`, or drawing on this thread when there is none. */
export function createHatchTileRenderer(worker: Worker | null): HatchTileRenderer {
  let nextId = 1
  const pending = new Map<number, { resolve: (image: HatchRgbaImage | null) => void; reject: (error: Error) => void }>()
  const local = new Map<string, PreparedHatchAreas>()

  if (worker)
    worker.onmessage = (event: MessageEvent<Reply>) => {
      const reply = pending.get(event.data.id)
      if (!reply) return
      pending.delete(event.data.id)
      if (event.data.error) reply.reject(new Error(event.data.error))
      else reply.resolve(event.data.image ?? null)
    }

  return {
    setAreas(key, areas) {
      if (worker) worker.postMessage({ type: 'areas', key, areas } satisfies HatchWorkerMessage)
      else local.set(key, prepareHatchAreas(areas))
    },
    dropAreas(key) {
      if (worker) worker.postMessage({ type: 'drop', key } satisfies HatchWorkerMessage)
      else local.delete(key)
    },
    render(job, signal) {
      if (signal?.aborted) return Promise.reject(abortError())
      const id = nextId++
      return new Promise((resolve, reject) => {
        const onAbort = () => {
          if (!pending.delete(id)) return
          if (worker) worker.postMessage({ type: 'cancel', id } satisfies HatchWorkerMessage)
          reject(abortError())
        }
        signal?.addEventListener('abort', onAbort, { once: true })
        const settle = {
          resolve: (image: HatchRgbaImage | null) => {
            signal?.removeEventListener('abort', onAbort)
            resolve(image)
          },
          reject: (error: Error) => {
            signal?.removeEventListener('abort', onAbort)
            reject(error)
          },
        }
        pending.set(id, settle)
        if (worker) {
          worker.postMessage({ type: 'tile', id, ...job } satisfies HatchWorkerMessage)
          return
        }
        // No worker: one tile a task, so the page keeps drawing frames between tiles.
        setTimeout(() => {
          if (!pending.delete(id)) return
          try {
            const areas = local.get(job.areas)
            settle.resolve(
              areas
                ? renderHatchTile(areas, job.recipe, job.anchor, job.z, job.x, job.y, {
                    tileSize: job.tileSize,
                    pixelRatio: job.pixelRatio,
                  })
                : null,
            )
          } catch (error) {
            settle.reject(error instanceof Error ? error : new Error(String(error)))
          }
        }, 0)
      })
    },
    dispose() {
      worker?.terminate()
      for (const reply of pending.values()) reply.reject(abortError())
      pending.clear()
      local.clear()
    },
  }
}
