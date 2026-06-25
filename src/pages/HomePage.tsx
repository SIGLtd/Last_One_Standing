import { ButtonLink } from '../components/ButtonLink'
import { Card } from '../components/Card'
import { Badge } from '../components/Badge'
import { AppLogo } from '../components/AppLogo'
import { MetricCell, MetricStrip } from '../components/MetricCell'
import { PreLaunchNotice, PublicAppIntro } from '../components/PreLaunchNotice'
import { APP_NAME, CURRENT_GAME, CURRENT_POT_GBP, formatEligibleSelectionDays, formatGBP } from '../lib/constants'

export function HomePage() {
  return (
    <div className="grid gap-3">
      <section className="los-card p-3 md:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <AppLogo losClassName="h-8 w-8" plClassName="h-6 w-auto max-w-[8.5rem]" />
          <Badge variant="warning">Pre-launch</Badge>
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-ink md:text-2xl">{APP_NAME}</h1>
        <PublicAppIntro />
        <p className="mt-2 text-xs text-muted-ink max-w-prose">
          Pick one team from eligible {formatEligibleSelectionDays()} fixtures each window. Last player standing wins.
        </p>

        <MetricStrip className="mt-3">
          <MetricCell label="Game" value={CURRENT_GAME} />
          <MetricCell label="Pot" value={formatGBP(CURRENT_POT_GBP)} />
          <MetricCell label="Picks" value="Not open yet" />
        </MetricStrip>

        <PreLaunchNotice className="mt-3" />

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
        <Card title="Register" compact accent={false}>
          <p className="text-sm font-semibold">Create your account</p>
          <p className="mt-1 text-xs text-muted-ink">Sign up with email and phone to join Game {CURRENT_GAME}.</p>
        </Card>
        <Card title="Pay" compact accent={false}>
          <p className="text-sm font-semibold">Join and verify</p>
          <p className="mt-1 text-xs text-muted-ink">Enter the game and pay by bank transfer through your dashboard.</p>
        </Card>
        <Card title="Play" compact accent={false}>
          <p className="text-sm font-semibold">Pick when the round opens</p>
          <p className="mt-1 text-xs text-muted-ink">Weekly selections and the open picks board return when live.</p>
        </Card>
      </div>
    </div>
  )
}
