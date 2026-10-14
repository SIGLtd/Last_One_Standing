import { RulesPreview } from '../components/ui-lab/RulesPreview'
import { useGame } from '../contexts/GameContext'
import { APP_TAGLINE, CURRENT_GAME, formatGBP } from '../lib/constants'

export function RulesPage() {
  const { currentPot, game } = useGame()
  const potLabel = currentPot == null ? '' : ` · ${formatGBP(currentPot)}`
  const gameNumber = game?.game_number ?? CURRENT_GAME

  return (
    <div className="grid gap-3">
      <p className="px-1 text-xs text-muted-ink">
        {APP_TAGLINE} Game {gameNumber}
        {potLabel}
      </p>
      <RulesPreview />
    </div>
  )
}
