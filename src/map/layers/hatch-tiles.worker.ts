/**
 * Draws hatch map tiles off the page's thread. Jobs wait in a queue and are drawn one per task, so
 * a cancel for a tile that has left the view arrives before it is drawn and drops it.
 */
import { prepareHatchAreas, renderHatchTile, type PreparedHatchAreas } from '../../patterns/hatch-tiles.js'
import type { HatchTileJob, HatchWorkerMessage } from './hatch-tile-renderer.js'

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<HatchWorkerMessage>) => void) | null
  postMessage(message: unknown, transfer?: Transferable[]): void
}

const prepared = new Map<string, PreparedHatchAreas>()
const queue: HatchTileJob[] = []
let pumping = false

function pump() {
  const job = queue.shift()
  if (!job) {
    pumping = false
    return
  }
  try {
    const areas = prepared.get(job.areas)
    const image = areas
      ? renderHatchTile(areas, job.recipe, job.anchor, job.z, job.x, job.y, {
          tileSize: job.tileSize,
          pixelRatio: job.pixelRatio,
        })
      : null
    if (image) scope.postMessage({ id: job.id, image }, [image.data.buffer])
    else scope.postMessage({ id: job.id, image: null })
  } catch (error) {
    scope.postMessage({ id: job.id, error: error instanceof Error ? error.message : String(error) })
  }
  setTimeout(pump, 0)
}

scope.onmessage = (event) => {
  const message = event.data
  if (message.type === 'areas') prepared.set(message.key, prepareHatchAreas(message.areas))
  else if (message.type === 'drop') prepared.delete(message.key)
  else if (message.type === 'cancel') {
    const index = queue.findIndex((job) => job.id === message.id)
    if (index >= 0) queue.splice(index, 1)
  } else if (message.type === 'tile') {
    queue.push(message)
    if (!pumping) {
      pumping = true
      setTimeout(pump, 0)
    }
  }
}
