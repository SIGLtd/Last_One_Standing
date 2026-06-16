import { ButtonLink } from '../components/ButtonLink'
import { Card } from '../components/Card'
import { APP_NAME, CURRENT_GAME, CURRENT_POT_GBP, STATUS, formatGBP } from '../lib/constants'

export function HomePage() {
  return (
    <div className="grid gap-4">
      <Card
        title={APP_NAME}
        description={`Game ${CURRENT_GAME} • Pot ${formatGBP(CURRENT_POT_GBP)}`}
        right={
          <span className="inline-flex items-center rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">
            {STATUS.offSeason ? 'Off-season' : 'In season'}
          </span>
        }
      >
        <div className="grid gap-4">
          <p className="text-sm text-muted">
            Pick one team each eligible weekend. Win and you survive. Draw, lose, or miss the deadline and you are
            eliminated. Use each team only once per game.
          </p>

          <div className="grid gap-2 sm:flex sm:items-center">
            <ButtonLink to="/signup">Create account</ButtonLink>
            <ButtonLink to="/login" variant="secondary">
              Log in
            </ButtonLink>
            <ButtonLink to="/rules" variant="secondary">
              Read rules
            </ButtonLink>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Current game">
          <div className="grid gap-2">
            <div className="text-2xl font-semibold tracking-tight">Game {CURRENT_GAME}</div>
            <div className="text-sm text-muted">Static milestone data. Fixtures and auto-resolution come later.</div>
          </div>
        </Card>

        <Card title="Current pot">
          <div className="grid gap-2">
            <div className="text-2xl font-semibold tracking-tight">{formatGBP(CURRENT_POT_GBP)}</div>
            <div className="text-sm text-muted">Private group pot. Winner takes all if one survives.</div>
          </div>
        </Card>

        <Card title="Visibility">
          <div className="grid gap-2">
            <div className="text-2xl font-semibold tracking-tight">Open picks</div>
            <div className="text-sm text-muted">
              Everyone can see weekly selections at any time, even before they make their own pick.
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

