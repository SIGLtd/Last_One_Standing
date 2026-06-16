import { Card } from '../components/Card'
import { APP_NAME, CURRENT_GAME, CURRENT_POT_GBP, FEES, formatGBP } from '../lib/constants'

export function RulesPage() {
  return (
    <div className="grid gap-4">
      <Card title="Rules" description={`${APP_NAME} • Game ${CURRENT_GAME} • Pot ${formatGBP(CURRENT_POT_GBP)}`}>
        <div className="grid gap-4 text-sm text-muted">
          <section className="grid gap-2">
            <h3 className="text-text font-semibold">Entry and pot</h3>
            <ul className="list-disc pl-5 grid gap-1">
              <li>Returning players from Game 26 pay {formatGBP(FEES.returning_player)}.</li>
              <li>New players pay {formatGBP(FEES.new_player)}.</li>
              <li>
                The newbie fee includes {formatGBP(FEES.returning_player)} standard entry plus{' '}
                {formatGBP(FEES.new_player_rollover_fairness_contribution)} rollover fairness contribution.
              </li>
            </ul>
          </section>

          <section className="grid gap-2">
            <h3 className="text-text font-semibold">Weekly picks</h3>
            <ul className="list-disc pl-5 grid gap-1">
              <li>Players pick one team each eligible weekend.</li>
              <li>If the team wins, the player survives.</li>
              <li>If the team draws, loses, or no pick is made before the deadline, the player is eliminated.</li>
              <li>Each team can only be used once per player per game.</li>
              <li>Players can change their pick before the deadline.</li>
            </ul>
          </section>

          <section className="grid gap-2">
            <h3 className="text-text font-semibold">Deadlines and locking</h3>
            <ul className="list-disc pl-5 grid gap-1">
              <li>Picks lock 1 hour before the first eligible weekend fixture.</li>
              <li>After lock, selections are read-only.</li>
            </ul>
          </section>

          <section className="grid gap-2">
            <h3 className="text-text font-semibold">Visibility</h3>
            <ul className="list-disc pl-5 grid gap-1">
              <li>Players can see everyone else’s current weekly selections at any time.</li>
              <li>Visibility is not gated by whether the viewer has made their own pick.</li>
            </ul>
          </section>

          <section className="grid gap-2">
            <h3 className="text-text font-semibold">Winning and rollover</h3>
            <ul className="list-disc pl-5 grid gap-1">
              <li>If one player remains, that player wins the pot.</li>
              <li>If nobody survives, the pot rolls over.</li>
              <li>No points. No bonus scoring. No tie-breaks.</li>
            </ul>
          </section>
        </div>
      </Card>
    </div>
  )
}

