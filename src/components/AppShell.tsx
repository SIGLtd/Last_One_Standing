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
      'flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[0.625rem] font-semibold uppercase tracking-wide transition-colors',
      isActive ? 'text-white border-t-2 border-cyan -mt-px' : 'text-white/65',
    ].join(' ')
  }

  return [
    'px-2 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px',
    isActive ? 'border-cyan text-white' : 'border-transparent text-white/70 hover:text-white',
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
    <div className="min-h-dvh pb-16 md:pb-0">
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
              <nav className="flex items-center gap-0.5">
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
                    className="text-xs font-medium text-white/80 hover:text-white"
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

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-purple-dark md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {mobileNavItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => navClass(isActive, true)}>
              {item.label}
            </NavLink>
          ))}
        </div>
        {user ? (
          <div className="mx-auto flex max-w-lg items-center justify-between gap-2 border-t border-white/10 px-2 py-1">
            <span className="truncate text-[0.6875rem] text-white/65">
              {player?.display_name ?? user.email}
            </span>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="text-[0.6875rem] font-medium text-white/75"
            >
              {signingOut ? '…' : 'Log out'}
            </button>
          </div>
        ) : null}
      </nav>
    </div>
  )
}
