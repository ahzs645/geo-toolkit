import { describe, expect, it } from 'vitest'
import { cn } from './utils.js'

describe('cn', () => {
  it('keeps a named text size beside a text colour', () => {
    expect(cn('text-2xs text-muted-foreground')).toBe('text-2xs text-muted-foreground')
    expect(cn('text-3xs', 'text-red-500')).toBe('text-3xs text-red-500')
  })

  it('lets a later size win over a named one', () => {
    expect(cn('text-2xs', 'text-sm')).toBe('text-sm')
    expect(cn('text-sm', 'text-3xs')).toBe('text-3xs')
    expect(cn('text-[11px]', 'text-2xs')).toBe('text-2xs')
  })

  it('treats named layers as z-index', () => {
    expect(cn('z-10', 'z-menu')).toBe('z-menu')
    expect(cn('z-workspace-popover', 'z-20')).toBe('z-20')
  })
})
