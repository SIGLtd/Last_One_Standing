import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { AppLogo } from './AppLogo'
import { AppMenu } from './AppMenu'
import { EliminatedBanner } from './EliminatedBanner'
import { useAuth } from '../contexts/AuthContext'
import { useGame } from '../contexts/GameContext'
import { buildAppMenuItems } from '../lib/appNavigation'
import { APP_NAME, APP_TAGLINE, formatGBP } from '../lib/constants'
import { fetchMyGameEntry } from '../lib/gameEntries'
import {
  playerSurvivalStatusFromEntry,
  shouldShowEliminatedBanner,
  type PlayerSurvivalStatus,
} from '../lib/survivalStatus'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, player, loading: authLoading, signOut } = useAuth()
  const { game, currentPot } = useGame()
  const [signingOut, setSigningOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [survivalStatus, setSurvivalStatus] = useState<PlayerSurvivalStatus>('unknown')

  const isAdmin = Boolean(player?.is_admin)
  const menuItems = useMemo(
    () =>
      buildAppMenuItems({
        isAuthenticated: Boolean(user),
        isAdmin,
      }),
    [isAdmin, user],
  )

  useEffect(() => {
    if (authLoading) {
      setSurvivalStatus('unknown')
      return
    }
    if (!user || !player) {
      setSurvivalStatus('other')
      return
    }
    if (!game) return

    let cancelled = false
    setSurvivalStatus('unknown')
    void fetchMyGameEntry(player.id, game.id)
      .then((entry) => {
        if (!cancelled) setSurvivalStatus(playerSurvivalStatusFromEntry(entry, true))
      })
      .catch((error) => {
        console.error('Failed to load entry status', error)
        if (!cancelled) setSurvivalStatus('unknown')
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, game, player, user])

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
                <div className="los-tagline truncate">
                  {APP_TAGLINE}
                  {currentPot != null ? <span className="tabular-nums"> · {formatGBP(currentPot)}</span> : null}
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

      <main className="mx-auto w-full max-w-xl px-3 py-2 md:max-w-2xl md:py-4">
        {shouldShowEliminatedBanner(survivalStatus, game) ? <EliminatedBanner /> : null}
        {children}
      </main>
    </div>
  )
}
