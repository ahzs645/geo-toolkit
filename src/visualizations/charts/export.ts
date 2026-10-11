import type { ChartSeries } from './types.js'

const namespace = 'http://www.w3.org/2000/svg'

/** Capture rendered SVG axes/lines and canvas observations without controls or hover cards. */
export function captureChartSvg(
  element: HTMLElement,
  {
    title = '',
    subtitle = '',
    series = [],
  }: { title?: string; subtitle?: string; series?: readonly ChartSeries[] } = {},
) {
  const bounds = element.getBoundingClientRect()
  if (!bounds.width || !bounds.height) throw new Error('The chart is not visible.')
  const header = (title ? 24 : 0) + (subtitle ? 20 : 0) + series.length * 18 + 8
  const width = Math.ceil(bounds.width),
    height = Math.ceil(bounds.height + header)
  const svg = document.createElementNS(namespace, 'svg')
  svg.setAttribute('xmlns', namespace)
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  let background = 'white'
  for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
    const color = getComputedStyle(parent).backgroundColor
    if (color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') {
      background = color
      break
    }
  }
  const rect = document.createElementNS(namespace, 'rect')
  rect.setAttribute('width', '100%')
  rect.setAttribute('height', '100%')
  rect.setAttribute('fill', background)
  svg.append(rect)
  const text = (value: string, y: number, color: string, bold = false) => {
    const node = document.createElementNS(namespace, 'text')
    node.setAttribute('x', '12')
    node.setAttribute('y', String(y))
    node.setAttribute('fill', color)
    node.setAttribute('font-family', 'sans-serif')
    node.setAttribute('font-size', bold ? '14' : '11')
    if (bold) node.setAttribute('font-weight', '600')
    node.textContent = value
    svg.append(node)
  }
  const foreground = getComputedStyle(element).color
  let y = 18
  if (title) {
    text(title, y, foreground, true)
    y += 24
  }
  if (subtitle) {
    text(subtitle, y, foreground)
    y += 20
  }
  for (const item of series) {
    text(`● ${item.label}`, y, item.color)
    y += 18
  }

  for (const source of element.querySelectorAll<SVGSVGElement | HTMLCanvasElement>('svg, canvas')) {
    if (source.parentElement?.closest('svg') || source.closest('[role="tooltip"]')) continue
    const position = source.getBoundingClientRect()
    if (!position.width || !position.height) continue
    if (source instanceof HTMLCanvasElement) {
      const image = document.createElementNS(namespace, 'image')
      image.setAttribute('href', source.toDataURL('image/png'))
      image.setAttribute('x', String(position.left - bounds.left))
      image.setAttribute('y', String(position.top - bounds.top + header))
      image.setAttribute('width', String(position.width))
      image.setAttribute('height', String(position.height))
      svg.append(image)
    } else {
      const clone = source.cloneNode(true) as SVGSVGElement
      const originals = [source, ...source.querySelectorAll('*')]
      const copies = [clone, ...clone.querySelectorAll('*')]
      originals.forEach((original, index) => {
        const style = getComputedStyle(original)
        // Resolve theme variables/inherited CSS before leaving the page.
        for (const property of [
          'fill',
          'stroke',
          'color',
          'font-family',
          'font-size',
          'font-weight',
          'opacity',
          'fill-opacity',
          'stroke-opacity',
          'stroke-width',
          'stroke-dasharray',
        ])
          (copies[index] as SVGElement).style.setProperty(property, style.getPropertyValue(property))
      })
      clone.setAttribute('x', String(position.left - bounds.left))
      clone.setAttribute('y', String(position.top - bounds.top + header))
      clone.setAttribute('width', String(position.width))
      clone.setAttribute('height', String(position.height))
      svg.append(clone)
    }
  }
  return { blob: new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }), width, height }
}

/** Rasterize a captured chart. File naming, PDF packaging and download transport belong to the host. */
export async function rasterizeChart(
  snapshot: ReturnType<typeof captureChartSvg>,
  type: 'image/png' | 'image/jpeg',
  scale = 2,
) {
  const url = URL.createObjectURL(snapshot.blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(snapshot.width * scale)
    canvas.height = Math.ceil(snapshot.height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image export is unavailable in this browser.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not export the chart.'))), type, 0.95),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}
