import { ButtonLink } from '../components/ButtonLink'
import { Card } from '../components/Card'
import { Badge } from '../components/Badge'
import { AppLogo } from '../components/AppLogo'
import { PitchGraphic } from '../components/PitchGraphic'
import { APP_NAME, CURRENT_GAME, CURRENT_POT_GBP, STATUS, formatEligibleSelectionDays, formatGBP } from '../lib/constants'

export function HomePage() {
  return (
    <div className="grid gap-5">
      <section className="los-card overflow-hidden">
        <div className="grid gap-5 p-5 md:grid-cols-[1.1fr_0.9fr] md:items-center md:p-7">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <AppLogo className="h-10 w-auto max-w-[12rem] md:h-12 md:max-w-[14rem]" />
              <Badge variant={STATUS.offSeason ? 'warning' : 'open'}>
                {STATUS.offSeason ? 'Off-season' : 'In season'}
              </Badge>
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-magenta">Survival pool</p>
              <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-ink md:text-5xl">{APP_NAME}</h1>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="los-panel px-4 py-3">
                <div className="text-xs font-bold uppercase tracking-wide text-muted-ink">Current game</div>
                <div className="mt-1 text-2xl font-extrabold text-purple">Game {CURRENT_GAME}</div>
              </div>
              <div className="los-panel px-4 py-3">
                <div className="text-xs font-bold uppercase tracking-wide text-muted-ink">Current pot</div>
                <div className="mt-1 text-2xl font-extrabold text-purple">{formatGBP(CURRENT_POT_GBP)}</div>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-ink">
              Pick one team from eligible {formatEligibleSelectionDays()} Premier League fixtures each selection
              window. Win and you survive. Draw, lose, or miss the deadline and you are eliminated. Use each team only
              once per game.
            </p>
            <div className="flex flex-wrap gap-2">
              <ButtonLink to="/signup">Create account</ButtonLink>
              <ButtonLink to="/login" variant="secondary">
                Log in
              </ButtonLink>
              <ButtonLink to="/rules" variant="secondary">
                Read rules
              </ButtonLink>
            </div>
          </div>
          <div className="rounded-2xl border border-purple/10 bg-gradient-to-br from-purple-dark to-purple p-4 shadow-inner">
            <AppLogo onDark className="mx-auto mb-4 h-9 w-auto max-w-[11rem]" />
            <PitchGraphic className="h-auto w-full" />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Current game" accent={false}>
          <div className="text-3xl font-extrabold text-purple">Game {CURRENT_GAME}</div>
          <p className="mt-2 text-sm text-muted-ink">Static milestone data. Fixtures and auto-resolution come later.</p>
        </Card>

        <Card title="Current pot" accent={false}>
          <div className="text-3xl font-extrabold text-purple">{formatGBP(CURRENT_POT_GBP)}</div>
          <p className="mt-2 text-sm text-muted-ink">Private group pot. Winner takes all if one survives.</p>
        </Card>

        <Card title="Visibility" accent={false}>
          <div className="text-3xl font-extrabold text-purple">Open picks</div>
          <p className="mt-2 text-sm text-muted-ink">
            Everyone can see weekly selections at any time, even before they make their own pick.
          </p>
        </Card>
      </div>
    </div>
  )
}
