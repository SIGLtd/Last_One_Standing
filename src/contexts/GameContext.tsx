import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchCurrentGame } from '../lib/gameEntries'
import { isSupabaseConfigured } from '../lib/supabase'
import type { Game } from '../types'

type GameContextValue = {
  game: Game | null
  currentPot: number | null
  refreshGame: () => Promise<void>
  applyGameUpdate: (updated: Game) => void
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<Game | null>(null)
  const [currentPot, setCurrentPot] = useState<number | null>(null)

  const applyGameUpdate = useCallback((updated: Game) => {
    setGame(updated)
    setCurrentPot(updated.current_pot)
  }, [])

  const refreshGame = useCallback(async () => {
    if (!isSupabaseConfigured) return

    try {
      const current = await fetchCurrentGame()
      if (current) applyGameUpdate(current)
    } catch (error) {
      console.error('Failed to load current game pot', error)
    }
  }, [applyGameUpdate])

  useEffect(() => {
    void refreshGame()
  }, [refreshGame])

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') void refreshGame()
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshGame])

  const value = useMemo<GameContextValue>(
    () => ({ game, currentPot, refreshGame, applyGameUpdate }),
    [applyGameUpdate, currentPot, game, refreshGame],
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
}
