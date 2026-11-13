import { useCallback, useEffect, useRef, useState } from 'react'

import type { PanelWindowLayout, PanelWindowMode } from './panel-window-layout.js'
export type { PanelWindowMode } from './panel-window-layout.js'

interface PanelWindowSession {
  mode: PanelWindowMode
  window: Window
  container: HTMLElement
  dispose: () => void
}

function updateWindowTitle(child: Window, title: string) {
  child.document.title = title
}

const presentationAttributes = (source: Element, target: Element) => {
  for (const attribute of [...target.attributes]) {
    if (attribute.name === 'class' || attribute.name === 'style' || attribute.name.startsWith('data-'))
      target.removeAttribute(attribute.name)
  }
  for (const attribute of [...source.attributes]) {
    if (attribute.name === 'class' || attribute.name === 'style' || attribute.name.startsWith('data-'))
      target.setAttribute(attribute.name, attribute.value)
  }
}

/** Copy presentation, never scripts or a second application, into a same-origin child document. */
function preparePanelWindow(source: HTMLElement, child: Window, title: string): () => void {
  const sourceDocument = source.ownerDocument
  const sourceWindow = sourceDocument.defaultView!
  const target = child.document
  target.title = title
  const base = target.createElement('base')
  base.href = sourceDocument.baseURI
  target.head.append(base)
  let styleNodes: Node[] = []

  // Keep ancestor selectors, scoped toolkit CSS and host branding working, without
  // copying the workspace's grid sizes, hidden panes or application DOM.
  const ancestors: HTMLElement[] = []
  for (let element = source.parentElement; element && element !== sourceDocument.body; element = element.parentElement)
    ancestors.unshift(element)
  let parent: HTMLElement = target.body
  const mirrors = ancestors.map(() => {
    const mirror = target.createElement('div')
    parent.append(mirror)
    parent = mirror
    return mirror
  })
  const container = target.createElement('div')
  container.dataset.panelWindowRoot = ''
  container.style.cssText = 'display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;width:100%;height:100%'
  parent.append(container)

  const syncStyles = () => {
    for (const node of styleNodes) node.parentNode?.removeChild(node)
    styleNodes = [...sourceDocument.querySelectorAll('style, link[rel="stylesheet"]')].map((node) =>
      node.cloneNode(true),
    )
    target.head.append(...styleNodes)
  }
  const syncPresentation = () => {
    presentationAttributes(sourceDocument.documentElement, target.documentElement)
    target.documentElement.lang = sourceDocument.documentElement.lang
    target.documentElement.dir = sourceDocument.documentElement.dir
    presentationAttributes(sourceDocument.body, target.body)
    for (const element of [target.documentElement, target.body]) {
      element.style.setProperty('height', '100%', 'important')
      element.style.setProperty('width', '100%', 'important')
      element.style.setProperty('margin', '0', 'important')
      element.style.setProperty('padding', '0', 'important')
      // Saved panels can be opened from a modal whose opener body is pointer-locked.
      element.style.setProperty('pointer-events', 'auto', 'important')
      element.style.setProperty('overflow', 'hidden', 'important')
    }
    ancestors.forEach((ancestor, index) => {
      const mirror = mirrors[index]
      presentationAttributes(ancestor, mirror)
      // Preserve custom properties but remove every host layout declaration.
      const variables = [...mirror.style].filter((name) => name.startsWith('--'))
      const values = variables.map((name) => [name, mirror.style.getPropertyValue(name)])
      mirror.removeAttribute('style')
      for (const [name, value] of values) mirror.style.setProperty(name, value)
      for (const [name, value] of Object.entries({
        display: 'flex',
        position: 'relative',
        flex: '1 1 0%',
        'flex-direction': 'column',
        width: '100%',
        height: '100%',
        'min-width': '0',
        'min-height': '0',
        'max-width': 'none',
        'max-height': 'none',
        margin: '0',
        padding: '0',
        border: '0',
        overflow: 'hidden',
        transform: 'none',
      }))
        mirror.style.setProperty(name, value, 'important')
    })
    // The original section unmounts when its portal opens; its parent remains
    // the live presentation anchor, including later theme/branding changes.
    const computed = sourceWindow.getComputedStyle(ancestors[ancestors.length - 1] ?? sourceDocument.body)
    for (const name of [...computed]) {
      if (name.startsWith('--')) container.style.setProperty(name, computed.getPropertyValue(name))
    }
    container.style.fontFamily = computed.fontFamily
    container.style.fontSize = computed.fontSize
  }
  syncStyles()
  syncPresentation()
  const styles = new MutationObserver(syncStyles)
  styles.observe(sourceDocument.head, { childList: true, subtree: true, characterData: true, attributes: true })
  const presentation = new MutationObserver(syncPresentation)
  for (const element of [sourceDocument.documentElement, sourceDocument.body, ...ancestors])
    presentation.observe(element, { attributes: true })
  return () => {
    styles.disconnect()
    presentation.disconnect()
  }
}

/**
 * A live portal destination for a panel. Call open directly from a user gesture.
 * The host keeps owning all shared state; no project is cloned or serialized.
 * Switching portal destinations remounts the panel's local view, so share any
 * state that must survive (selection, edits, etc.) above the panel.
 */
export function usePanelWindow(title: string) {
  const [session, setSession] = useState<PanelWindowSession | null>(null)
  const [error, setError] = useState('')
  const current = useRef<PanelWindowSession | null>(null)

  const close = useCallback(() => {
    const previous = current.current
    if (!previous) return
    current.current = null
    previous.dispose()
    setSession(null)
  }, [])

  const open = useCallback(
    (mode: PanelWindowMode, source: HTMLElement, placement?: PanelWindowLayout) => {
      if (current.current && !current.current.window.closed) {
        current.current.window.focus()
        return
      }
      const owner = source.ownerDocument.defaultView!
      const features =
        mode === 'window'
          ? [
              'popup',
              `width=${placement?.width ?? 1100}`,
              `height=${placement?.height ?? 760}`,
              ...(placement?.left !== undefined ? [`left=${placement.left}`] : []),
              ...(placement?.top !== undefined ? [`top=${placement.top}`] : []),
            ].join(',')
          : undefined
      const child = owner.open('', '_blank', features)
      if (!child) {
        setError('The browser blocked the panel. Allow pop-ups for this site, then try again.')
        return
      }
      let release: (() => void) | undefined
      try {
        release = preparePanelWindow(source, child, title)
        const container = child.document.querySelector<HTMLElement>('[data-panel-window-root]')!
        const restore = () => close()
        child.addEventListener('pagehide', restore)
        owner.addEventListener('pagehide', restore)
        // Some browsers omit pagehide when a script-opened window is closed.
        const timer = owner.setInterval(() => {
          if (child.closed) close()
        }, 500)
        const next: PanelWindowSession = {
          mode,
          window: child,
          container,
          dispose: () => {
            owner.clearInterval(timer)
            child.removeEventListener('pagehide', restore)
            owner.removeEventListener('pagehide', restore)
            release?.()
            if (!child.closed) child.close()
          },
        }
        current.current = next
        setSession(next)
        setError('')
        child.focus()
      } catch {
        release?.()
        child.close()
        setError('Could not open the panel. Please try again.')
      }
    },
    [close, title],
  )

  useEffect(() => {
    const child = current.current?.window
    if (child && !child.closed) updateWindowTitle(child, title)
  }, [session, title])

  useEffect(
    () => () => {
      current.current?.dispose()
      current.current = null
    },
    [],
  )

  const focus = useCallback(() => current.current?.window.focus(), [])
  const snapshot = useCallback((): Omit<PanelWindowLayout, 'slot'> => {
    const active = current.current
    if (!active || active.window.closed || active.mode === 'tab') return { mode: active?.mode ?? 'window' }
    const child = active.window
    return {
      mode: active.mode,
      width: Math.max(320, Math.min(10_000, Math.round(child.innerWidth))),
      height: Math.max(200, Math.min(10_000, Math.round(child.innerHeight))),
      left: Math.round(child.screenX),
      top: Math.round(child.screenY),
    }
  }, [])
  const place = useCallback((placement: PanelWindowLayout) => {
    const active = current.current
    if (!active || active.window.closed || active.mode !== 'window') return
    const child = active.window
    try {
      const dx = (placement.width ?? child.innerWidth) - child.innerWidth
      const dy = (placement.height ?? child.innerHeight) - child.innerHeight
      if (dx || dy) child.resizeBy(dx, dy)
      if (placement.left !== undefined || placement.top !== undefined)
        child.moveTo(placement.left ?? child.screenX, placement.top ?? child.screenY)
    } catch {
      /* Browser preferences decide which window movements are allowed. */
    }
  }, [])

  return {
    container: session?.container ?? null,
    detached: !!session,
    open,
    close,
    error,
    focus,
    mode: session?.mode ?? 'window',
    snapshot,
    place,
  }
}
