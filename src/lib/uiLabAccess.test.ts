import { describe, expect, it } from 'vitest'
import { canAccessUiLab, UI_LAB_PATH, uiLabBlockedCopy } from './uiLabAccess'
import { buildAppMenuItems, menuIncludesPath } from './appNavigation'

describe('UI Lab access control', () => {
  it('blocks guests', () => {
    expect(canAccessUiLab({ authLoading: false, isAuthenticated: false, isAdmin: false })).toBe('guest')
    expect(uiLabBlockedCopy('guest')).toContain('Log in')
  })

  it('blocks logged-in non-admin users', () => {
    expect(canAccessUiLab({ authLoading: false, isAuthenticated: true, isAdmin: false })).toBe('forbidden')
    expect(uiLabBlockedCopy('forbidden')).toContain('Admin')
  })

  it('allows admin users', () => {
    expect(canAccessUiLab({ authLoading: false, isAuthenticated: true, isAdmin: true })).toBe('allowed')
    expect(uiLabBlockedCopy('allowed')).toBeNull()
  })

  it('waits while auth is loading', () => {
    expect(canAccessUiLab({ authLoading: true, isAuthenticated: false, isAdmin: false })).toBe('loading')
  })

  it('does not put UI Lab in the public burger menu', () => {
    const adminMenu = buildAppMenuItems({ isAuthenticated: true, isAdmin: true })
    const playerMenu = buildAppMenuItems({ isAuthenticated: true, isAdmin: false })
    expect(menuIncludesPath(adminMenu, UI_LAB_PATH)).toBe(false)
    expect(menuIncludesPath(playerMenu, UI_LAB_PATH)).toBe(false)
  })
})
