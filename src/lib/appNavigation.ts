export type NavLinkItem = {
  to: string
  label: string
}

export type MobileMenuItem =
  | { kind: 'link'; to: string; label: string }
  | { kind: 'account'; to: string; label: string; displayName: string }
  | { kind: 'action'; action: 'logout'; label: string }

export const MOBILE_PRIMARY_NAV: NavLinkItem[] = [
  { to: '/', label: 'Home' },
  { to: '/dashboard', label: 'Hub' },
  { to: '/pick', label: 'Pick' },
  { to: '/current-picks', label: 'Picks' },
]

const DESKTOP_NAV_BASE: NavLinkItem[] = [
  { to: '/', label: 'Home' },
  { to: '/rules', label: 'Rules' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/pick', label: 'Pick' },
  { to: '/current-picks', label: 'Picks' },
  { to: '/history', label: 'History' },
]

const ADMIN_NAV_ITEM: NavLinkItem = { to: '/admin', label: 'Admin' }

export function buildDesktopNavItems(isAdmin: boolean): NavLinkItem[] {
  if (!isAdmin) return DESKTOP_NAV_BASE
  return [...DESKTOP_NAV_BASE, ADMIN_NAV_ITEM]
}

export function buildMobileMenuItems(input: {
  isAuthenticated: boolean
  isAdmin: boolean
  displayName?: string | null
}): MobileMenuItem[] {
  const items: MobileMenuItem[] = [
    { kind: 'link', to: '/rules', label: 'Rules' },
    { kind: 'link', to: '/history', label: 'History' },
  ]

  if (input.isAdmin) {
    items.push({ kind: 'link', to: '/admin', label: 'Admin' })
  }

  if (input.isAuthenticated) {
    items.push({
      kind: 'account',
      to: '/dashboard',
      label: 'Account',
      displayName: input.displayName?.trim() || 'Your account',
    })
    items.push({ kind: 'action', action: 'logout', label: 'Log out' })
  } else {
    items.push({ kind: 'link', to: '/login', label: 'Log in' })
    items.push({ kind: 'link', to: '/signup', label: 'Sign up' })
  }

  return items
}

export function mobileMenuIncludesAdmin(items: MobileMenuItem[]): boolean {
  return items.some((item) => item.kind === 'link' && item.to === '/admin')
}
