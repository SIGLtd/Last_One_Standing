export type NavLinkItem = {
  to: string
  label: string
}

export type AppMenuItem =
  | { kind: 'link'; to: string; label: string }
  | { kind: 'action'; action: 'logout'; label: string }

export const CURRENT_PICKS_MENU_LABEL = "See everyone's picks"

export function buildAppMenuItems(input: {
  isAuthenticated: boolean
  isAdmin: boolean
}): AppMenuItem[] {
  const items: AppMenuItem[] = [
    { kind: 'link', to: '/', label: 'Home' },
    { kind: 'link', to: '/current-picks', label: CURRENT_PICKS_MENU_LABEL },
    { kind: 'link', to: '/pick', label: 'Make Pick' },
    { kind: 'link', to: '/my-picks', label: 'My Picks' },
    { kind: 'link', to: '/rules', label: 'Rules' },
    { kind: 'link', to: '/history', label: 'History' },
    { kind: 'link', to: '/dashboard', label: 'Dashboard' },
  ]

  if (input.isAdmin) {
    items.push({ kind: 'link', to: '/admin', label: 'Admin' })
  }

  if (input.isAuthenticated) {
    items.push({ kind: 'action', action: 'logout', label: 'Log out' })
  } else {
    items.push({ kind: 'link', to: '/login', label: 'Log in' })
    items.push({ kind: 'link', to: '/signup', label: 'Sign up' })
  }

  return items
}

export function menuIncludesAdmin(items: AppMenuItem[]): boolean {
  return items.some((item) => item.kind === 'link' && item.to === '/admin')
}

export function menuIncludesPath(items: AppMenuItem[], path: string): boolean {
  return items.some((item) => item.kind === 'link' && item.to === path)
}
