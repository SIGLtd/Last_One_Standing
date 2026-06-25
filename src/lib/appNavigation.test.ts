import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  MOBILE_PRIMARY_NAV,
  buildDesktopNavItems,
  buildMobileMenuItems,
  mobileMenuIncludesAdmin,
} from './appNavigation'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appShellSource = readFileSync(join(__dirname, '..', 'components', 'AppShell.tsx'), 'utf8')
const mobileMenuSource = readFileSync(join(__dirname, '..', 'components', 'MobileNavMenu.tsx'), 'utf8')

describe('app navigation', () => {
  it('renders five primary mobile actions including Menu at narrow viewport', () => {
    expect(MOBILE_PRIMARY_NAV).toHaveLength(4)
    expect(MOBILE_PRIMARY_NAV.map((item) => item.label)).toEqual(['Home', 'Hub', 'Pick', 'Picks'])
    expect(appShellSource).toContain('grid-cols-5')
    expect(mobileMenuSource).toContain('Menu')
    expect(mobileMenuSource).toContain('aria-expanded')
  })

  it('includes Admin in the menu for authenticated administrators only', () => {
    const adminMenu = buildMobileMenuItems({
      isAuthenticated: true,
      isAdmin: true,
      displayName: 'Ben Stephens',
    })
    expect(mobileMenuIncludesAdmin(adminMenu)).toBe(true)
    expect(buildDesktopNavItems(true).some((item) => item.to === '/admin')).toBe(true)
  })

  it('omits Admin for non-admin users in menu and desktop navigation', () => {
    const playerMenu = buildMobileMenuItems({
      isAuthenticated: true,
      isAdmin: false,
      displayName: 'Player',
    })
    expect(mobileMenuIncludesAdmin(playerMenu)).toBe(false)
    expect(buildDesktopNavItems(false).some((item) => item.to === '/admin')).toBe(false)
    expect(appShellSource).toContain('buildDesktopNavItems(isAdmin)')
    expect(appShellSource).toContain('buildMobileMenuItems')
  })

  it('exposes Rules, History, account, and logout routes in the mobile menu', () => {
    const menu = buildMobileMenuItems({
      isAuthenticated: true,
      isAdmin: false,
      displayName: 'Player',
    })

    expect(menu.some((item) => item.kind === 'link' && item.to === '/rules')).toBe(true)
    expect(menu.some((item) => item.kind === 'link' && item.to === '/history')).toBe(true)
    expect(menu.some((item) => item.kind === 'account' && item.to === '/dashboard')).toBe(true)
    expect(menu.some((item) => item.kind === 'action' && item.action === 'logout')).toBe(true)
  })

  it('closes the menu when a destination is selected', () => {
    expect(mobileMenuSource).toContain('onClick={onClose}')
    expect(mobileMenuSource).toContain('closeRef.current()')
    expect(mobileMenuSource).toContain('location.pathname')
  })

  it('keeps desktop navigation intact behind md breakpoint', () => {
    expect(appShellSource).toContain('hidden items-center gap-2 md:flex')
    expect(appShellSource).toContain('aria-label="Main"')
    expect(buildDesktopNavItems(false).length).toBeGreaterThanOrEqual(6)
  })

  it('uses 44px tap targets and keeps mobile menu inside the viewport', () => {
    expect(appShellSource).toContain('min-h-11')
    expect(mobileMenuSource).toContain('min-h-11')
    expect(mobileMenuSource).toContain('bottom-[4.5rem]')
    expect(appShellSource).not.toContain('grid-cols-6')
  })
})
