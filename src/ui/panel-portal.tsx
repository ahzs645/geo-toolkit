import { createContext, useContext } from 'react'

/** Nested toolkit dialogs follow a detached panel into its own document. */
const PanelPortalContext = createContext<HTMLElement | null>(null)
export const PanelPortalProvider = PanelPortalContext.Provider
export const usePanelPortalContainer = () => useContext(PanelPortalContext)
