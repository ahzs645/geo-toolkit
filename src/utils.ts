import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Names `tailwind.config.js` adds. Without them `twMerge` reads `text-2xs` as a text
 * colour, so `text-2xs text-muted-foreground` silently loses its size.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['3xs', '2xs'] }],
      z: [{ z: ['menu', 'overlay', 'workspace-menu', 'workspace-popover', 'notification'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
