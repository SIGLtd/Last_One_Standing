import { useEffect, useMemo, useState } from 'react'
import { HistoryPreview } from '../components/ui-lab/HistoryPreview'
import { HISTORY_GAMES_1_TO_27 } from '../config/history'
import { fetchGames } from '../lib/gameEntries'
import { mergeHistoryWithLiveGames } from '../lib/gameLifecycle'
import { isSupabaseConfigured } from '../lib/supabase'
import type { Game } from '../types'

export function HistoryPage() {
  const [liveGames, setLiveGames] = useState<Game[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    void fetchGames()
      .then(setLiveGames)
      .catch((error) => {
        console.error('Failed to load live game history', error)
        setLiveGames([])
      })
  }, [])

  const history = useMemo(() => mergeHistoryWithLiveGames(HISTORY_GAMES_1_TO_27, liveGames), [liveGames])

  return <HistoryPreview history={history} />
}
