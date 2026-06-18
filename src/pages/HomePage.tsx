import { ButtonLink } from '../components/ButtonLink'
import { Card } from '../components/Card'
import { Badge } from '../components/Badge'
import { AppLogo } from '../components/AppLogo'
import { MetricCell, MetricStrip } from '../components/MetricCell'
import { APP_NAME, CURRENT_GAME, CURRENT_POT_GBP, STATUS, formatEligibleSelectionDays, formatGBP } from '../lib/constants'

export function HomePage() {
  return (
    <div className="grid gap-3">
      <section className="los-card p-3 md:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <AppLogo losClassName="h-8 w-8" plClassName="h-6 w-auto max-w-[8.5rem]" />
          <Badge variant={STATUS.offSeason ? 'warning' : 'open'}>
            {STATUS.offSeason ? 'Off-season' : 'In season'}
          </Badge>
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-ink md:text-2xl">{APP_NAME}</h1>
        <p className="mt-1 text-xs text-muted-ink max-w-prose">
          Premier League survival pool. Pick one team from eligible {formatEligibleSelectionDays()} fixtures each
          window. Last player standing wins.
        </p>

        <MetricStrip className="mt-3">
          <MetricCell label="Game" value={CURRENT_GAME} />
          <MetricCell label="Pot" value={formatGBP(CURRENT_POT_GBP)} />
          <MetricCell label="Picks" value="Open board" />
        </MetricStrip>

        <div className="mt-3 flex flex-wrap gap-2">
          <ButtonLink to="/signup">Create account</ButtonLink>
          <ButtonLink to="/login" variant="secondary">
            Log in
          </ButtonLink>
          <ButtonLink to="/rules" variant="secondary">
            Rules
          </ButtonLink>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card title="Game" compact accent={false}>
          <p className="text-sm font-semibold tabular-nums">Game {CURRENT_GAME}</p>
          <p className="mt-1 text-xs text-muted-ink">Current competition.</p>
        </Card>
        <Card title="Pot" compact accent={false}>
          <p className="text-sm font-semibold tabular-nums">{formatGBP(CURRENT_POT_GBP)}</p>
          <p className="mt-1 text-xs text-muted-ink">Winner takes all.</p>
        </Card>
        <Card title="Visibility" compact accent={false}>
          <p className="text-sm font-semibold">Open picks</p>
          <p className="mt-1 text-xs text-muted-ink">All selections visible anytime.</p>
        </Card>
      </div>
    </div>
  )
}
