/**
 * Delay before releasing a download's object URL. WebKit and embedded Chromium
 * shells read the URL after `click()` returns, so revoking synchronously can
 * cancel the download; large files can take several seconds to start. Holding
 * the Blob a little longer only costs memory.
 */
export const DOWNLOAD_URL_LIFETIME_MS = 40_000

/** Save a Blob as a file through a temporary link. Browser-only. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS)
  }
}

/** Save text (CSV, JSON, GeoJSON...) as a file. Browser-only. */
export function downloadText(content: string, filename: string, mimeType = 'text/plain'): void {
  downloadBlob(new Blob([content], { type: mimeType }), filename)
}
