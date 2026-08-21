import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildAppMenuItems, menuIncludesAdmin, menuIncludesPath } from './appNavigation'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appShellSource = readFileSync(join(__dirname, '..', 'components', 'AppShell.tsx'), 'utf8')
const appMenuSource = readFileSync(join(__dirname, '..', 'components', 'AppMenu.tsx'), 'utf8')

describe('app navigation', () => {
  it('renders a hamburger menu instead of visible header link clutter', () => {
    expect(appShellSource).toContain('buildAppMenuItems')
    expect(appShellSource).toContain('<AppMenu')
    expect(appShellSource).not.toContain('MOBILE_PRIMARY_NAV')
    expect(appShellSource).not.toContain('buildDesktopNavItems')
    expect(appShellSource).not.toContain('grid-cols-5')
    expect(appShellSource).not.toContain('aria-label="Main"')
    expect(appShellSource).not.toContain('aria-label="Primary"')
    expect(appMenuSource).toContain('los-menu-icon')
    expect(appMenuSource).toContain('aria-label="Menu"')
    expect(appMenuSource).toContain('aria-expanded')
  })

  it('includes Admin in the menu for administrators only', () => {
    const adminMenu = buildAppMenuItems({ isAuthenticated: true, isAdmin: true })
    const playerMenu = buildAppMenuItems({ isAuthenticated: true, isAdmin: false })
    expect(menuIncludesAdmin(adminMenu)).toBe(true)
    expect(menuIncludesAdmin(playerMenu)).toBe(false)
  })

  it('puts ordinary destinations behind the menu', () => {
    const menu = buildAppMenuItems({ isAuthenticated: true, isAdmin: false })
    expect(menuIncludesPath(menu, '/')).toBe(true)
    expect(menuIncludesPath(menu, '/pick')).toBe(true)
    expect(menuIncludesPath(menu, '/current-picks')).toBe(true)
    expect(menuIncludesPath(menu, '/my-picks')).toBe(true)
    expect(menuIncludesPath(menu, '/rules')).toBe(true)
    expect(menuIncludesPath(menu, '/history')).toBe(true)
    expect(menuIncludesPath(menu, '/dashboard')).toBe(true)
    expect(menu.some((item) => item.kind === 'action' && item.action === 'logout')).toBe(true)
  })

  it('shows log in when the user is signed out', () => {
    const menu = buildAppMenuItems({ isAuthenticated: false, isAdmin: false })
    expect(menuIncludesPath(menu, '/login')).toBe(true)
    expect(menu.some((item) => item.kind === 'action')).toBe(false)
  })

  it('closes the menu on route change, backdrop tap, and Escape', () => {
    expect(appMenuSource).toContain('onClick={onClose}')
    expect(appMenuSource).toContain('location.pathname')
    expect(appMenuSource).toContain("event.key === 'Escape'")
    expect(appMenuSource).toContain('aria-label="Close menu"')
  })

  it('uses 44px tap targets', () => {
    expect(appMenuSource).toContain('min-h-11')
    expect(appMenuSource).toContain('los-tap-target')
  })
})
