import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { AppLogo } from './AppLogo'
import { useAuth } from '../contexts/AuthContext'
import { APP_NAME, CURRENT_GAME, CURRENT_POT_GBP } from '../lib/constants'

const desktopNavItems: Array<{ to: string; label: string }> = [
  { to: '/', label: 'Home' },
  { to: '/rules', label: 'Rules' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/pick', label: 'Pick' },
  { to: '/current-picks', label: 'Picks' },
  { to: '/history', label: 'History' },
  { to: '/admin', label: 'Admin' },
]

const mobileNavItems: Array<{ to: string; label: string }> = [
  { to: '/', label: 'Home' },
  { to: '/dashboard', label: 'Hub' },
  { to: '/pick', label: 'Pick' },
  { to: '/current-picks', label: 'Board' },
  { to: '/history', label: 'History' },
]

function formatGBP(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)
}

function navClass(isActive: boolean, mobile = false) {
  if (mobile) {
    return [
      'flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[0.68rem] font-bold uppercase tracking-wide transition-colors',
      isActive
        ? 'bg-white/15 text-lime shadow-[inset_0_0_0_1px_rgba(208,255,0,0.45)]'
        : 'text-white/70 hover:text-white',
    ].join(' ')
  }

  return [
    'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
    isActive
      ? 'bg-white/15 text-white shadow-[inset_0_-2px_0_0_#00FFEA]'
      : 'text-white/75 hover:bg-white/10 hover:text-white',
  ].join(' ')
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, player, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

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
    <div className="min-h-dvh pb-24 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-gradient-to-r from-purple-dark via-purple to-[#4a0a52] shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <NavLink to="/" className="flex min-w-0 items-center gap-3">
              <AppLogo className="h-11 w-11 shrink-0" />
              <div className="min-w-0">
                <div className="truncate text-base font-extrabold tracking-tight text-white">{APP_NAME}</div>
                <div className="text-xs font-semibold text-cyan/90">
                  Game {CURRENT_GAME} • Pot {formatGBP(CURRENT_POT_GBP)}
                </div>
              </div>
            </NavLink>

            <div className="hidden items-center gap-3 md:flex">
              <nav className="flex items-center gap-1">
                {desktopNavItems.map((item) => (
                  <NavLink key={item.to} to={item.to} className={({ isActive }) => navClass(isActive)}>
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              {user ? (
                <div className="flex items-center gap-2 border-l border-white/15 pl-3">
                  <span className="max-w-[140px] truncate text-xs font-semibold text-white/80">
                    {player?.display_name ?? user.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    disabled={signingOut}
                    className="los-btn-secondary !border-white/35 !px-3 !py-2 !text-xs !text-white hover:!bg-white/10"
                  >
                    {signingOut ? 'Logging out...' : 'Log out'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-5 md:py-7">{children}</main>

      <footer className="hidden border-t border-white/10 bg-purple-dark/90 py-5 md:block">
        <div className="mx-auto max-w-6xl px-4 text-sm text-white/70">
          Private survival pool app for a WhatsApp group. No Premier League branding.
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-gradient-to-t from-purple-dark via-purple to-purple-dark/95 px-2 py-2 shadow-[0_-12px_30px_rgba(0,0,0,0.35)] md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {mobileNavItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => navClass(isActive, true)}>
              {item.label}
            </NavLink>
          ))}
        </div>
        {user ? (
          <div className="mx-auto mt-2 flex max-w-lg items-center justify-between gap-2 px-1">
            <span className="truncate text-xs font-semibold text-white/75">
              {player?.display_name ?? user.email}
            </span>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="text-xs font-bold uppercase tracking-wide text-cyan"
            >
              {signingOut ? '...' : 'Log out'}
            </button>
          </div>
        ) : null}
      </nav>
    </div>
  )
}
