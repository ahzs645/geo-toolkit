import { useEffect, type RefObject } from 'react'
import { useWorkspaceInteractions } from './workspace-context.js'

export const VISIBLE_MAP_PANELS_CHANGE = 'geo-toolkit:visible-map-panels-change'
const panelsByTarget = new WeakMap<EventTarget, Set<HTMLElement>>()

export function workspaceMapPanels(target: EventTarget): readonly HTMLElement[] {
  return Array.from(panelsByTarget.get(target) ?? [])
}

/** Portalled/sibling panels still belong to their workspace's interaction bus. */
export function useVisibleMapPanel(ref: RefObject<HTMLElement>, active = true): void {
  const target = useWorkspaceInteractions()
  useEffect(() => {
    const panel = ref.current
    if (!active || !panel) return
    let panels = panelsByTarget.get(target)
    if (!panels) {
      panels = new Set()
      panelsByTarget.set(target, panels)
    }
    panels.add(panel)
    target.dispatchEvent(new Event(VISIBLE_MAP_PANELS_CHANGE))
    return () => {
      panels.delete(panel)
      target.dispatchEvent(new Event(VISIBLE_MAP_PANELS_CHANGE))
    }
  }, [active, ref, target])
}
