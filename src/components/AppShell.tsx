import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { AppLogo } from './AppLogo'
import { AppMenu } from './AppMenu'
import { useAuth } from '../contexts/AuthContext'
import { buildAppMenuItems } from '../lib/appNavigation'
import { APP_NAME, CURRENT_GAME, CURRENT_POT_GBP, formatGBP } from '../lib/constants'
import { fetchCurrentGame } from '../lib/gameEntries'
import { isSupabaseConfigured } from '../lib/supabase'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, player, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [displayedPot, setDisplayedPot] = useState(CURRENT_POT_GBP)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    void fetchCurrentGame()
      .then((game) => {
        if (!cancelled && game) setDisplayedPot(game.current_pot)
      })
      .catch(() => {
        /* keep fallback pot */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const isAdmin = Boolean(player?.is_admin)
  const menuItems = useMemo(
    () =>
      buildAppMenuItems({
        isAuthenticated: Boolean(user),
        isAdmin,
      }),
    [isAdmin, user],
  )

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
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-purple-dark">
        <div className="relative mx-auto max-w-6xl px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <NavLink to="/" className="flex min-w-0 items-center gap-2">
              <AppLogo onDark losClassName="h-8 w-8" plClassName="h-6 w-auto max-w-[8rem]" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white sm:text-base">{APP_NAME}</div>
                <div className="text-[0.75rem] text-white/70 tabular-nums">
                  Game {CURRENT_GAME} · {formatGBP(displayedPot)}
                </div>
              </div>
            </NavLink>

            <div className="flex min-w-0 items-center gap-2">
              {user ? (
                <span className="max-w-[7rem] truncate text-sm text-white/80 sm:max-w-[12rem]">
                  {player?.display_name ?? user.email}
                </span>
              ) : null}
              <AppMenu
                open={menuOpen}
                items={menuItems}
                signingOut={signingOut}
                onToggle={() => setMenuOpen((current) => !current)}
                onClose={() => setMenuOpen(false)}
                onSignOut={() => void handleSignOut()}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl px-3 py-3 md:max-w-2xl md:py-4">{children}</main>
    </div>
  )
}
