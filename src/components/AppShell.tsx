import { useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { AppLogo } from './AppLogo'
import { MobileNavMenu } from './MobileNavMenu'
import { useAuth } from '../contexts/AuthContext'
import {
  MOBILE_PRIMARY_NAV,
  buildDesktopNavItems,
  buildMobileMenuItems,
} from '../lib/appNavigation'
import { APP_NAME, CURRENT_GAME, CURRENT_POT_GBP } from '../lib/constants'

function formatGBP(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)
}

function navClass(isActive: boolean, mobile = false) {
  if (mobile) {
    return [
      'flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[0.625rem] font-semibold uppercase tracking-wide transition-colors',
      isActive ? 'text-white border-t-2 border-cyan -mt-px' : 'text-white/65',
    ].join(' ')
  }

  return [
    'px-2 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px',
    isActive ? 'border-cyan text-white' : 'border-transparent text-white/70 hover:text-white',
  ].join(' ')
}

function isMenuRouteActive(pathname: string): boolean {
  return pathname === '/rules' || pathname === '/history' || pathname === '/admin' || pathname === '/login' || pathname === '/signup'
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, player, signOut } = useAuth()
  const location = useLocation()
  const [signingOut, setSigningOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const isAdmin = Boolean(player?.is_admin)
  const desktopNavItems = useMemo(() => buildDesktopNavItems(isAdmin), [isAdmin])
  const mobileMenuItems = useMemo(
    () =>
      buildMobileMenuItems({
        isAuthenticated: Boolean(user),
        isAdmin,
        displayName: player?.display_name ?? user?.email ?? null,
      }),
    [isAdmin, player?.display_name, user],
  )

  const menuRouteActive = isMenuRouteActive(location.pathname)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out failed', error)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="min-h-dvh pb-[4.5rem] md:pb-0">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-purple-dark">
        <div className="mx-auto max-w-6xl px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <NavLink to="/" className="flex min-w-0 items-center gap-2">
              <AppLogo onDark losClassName="h-7 w-7" plClassName="h-5 w-auto max-w-[7rem]" />
              <div className="min-w-0 hidden sm:block">
                <div className="truncate text-sm font-semibold text-white">{APP_NAME}</div>
                <div className="text-[0.6875rem] text-white/65 tabular-nums">
                  Game {CURRENT_GAME} · {formatGBP(CURRENT_POT_GBP)}
                </div>
              </div>
            </NavLink>

            <div className="hidden items-center gap-2 md:flex">
              <nav className="flex items-center gap-0.5" aria-label="Main">
                {desktopNavItems.map((item) => (
                  <NavLink key={item.to} to={item.to} className={({ isActive }) => navClass(isActive)}>
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              {user ? (
                <div className="flex items-center gap-2 border-l border-white/15 pl-2 ml-1">
                  <span className="max-w-[120px] truncate text-xs text-white/75">
                    {player?.display_name ?? user.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    disabled={signingOut}
                    className="min-h-11 px-2 text-xs font-medium text-white/80 hover:text-white"
                  >
                    {signingOut ? '…' : 'Log out'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-3 py-3 md:py-4">{children}</main>

      <footer className="hidden border-t border-white/10 bg-purple-dark py-3 md:block">
        <div className="mx-auto max-w-6xl px-3 text-xs text-white/55">
          Private survival pool app for a WhatsApp group.
        </div>
      </footer>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-purple-dark md:hidden"
        aria-label="Primary"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {MOBILE_PRIMARY_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => navClass(isActive, true)}>
              {item.label}
            </NavLink>
          ))}
          <MobileNavMenu
            open={menuOpen}
            items={mobileMenuItems}
            menuActive={menuRouteActive}
            signingOut={signingOut}
            onToggle={() => setMenuOpen((current) => !current)}
            onClose={() => setMenuOpen(false)}
            onSignOut={() => void handleSignOut()}
          />
        </div>
      </nav>
    </div>
  )
}
