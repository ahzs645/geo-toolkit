/**
 * A ref the story components read but never assign. Structural, so it accepts
 * both React 18's `RefObject<T>` and React 19's `RefObject<T | null>` (the
 * types `useRef<T>(null)` returns in each) and still passes as a JSX `ref`.
 */
export type DomRef<T extends Element> = { readonly current: T | null }
