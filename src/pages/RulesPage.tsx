import { Card } from '../components/Card'
import {
  APP_NAME,
  CURRENT_GAME,
  CURRENT_POT_GBP,
  FEES,
  formatEligibleSelectionDays,
  formatGBP,
} from '../lib/constants'

const eligibleDays = formatEligibleSelectionDays()

export function RulesPage() {
  const sections = [
    {
      title: 'Entry and pot',
      items: [
        `Returning players from Game 26 pay ${formatGBP(FEES.returning_player)}.`,
        `New players pay ${formatGBP(FEES.new_player)}.`,
        `The newbie fee includes ${formatGBP(FEES.returning_player)} standard entry plus ${formatGBP(FEES.new_player_rollover_fairness_contribution)} rollover fairness contribution.`,
      ],
    },
    {
      title: 'Eligible fixtures',
      items: [
        `Eligible fixtures are ${eligibleDays} Premier League games only.`,
        'Friday and Monday fixtures are excluded.',
        'Tuesday, Wednesday, and Thursday fixtures are also excluded unless the organiser later creates a specific exceptional rule.',
      ],
    },
    {
      title: 'Weekly picks',
      items: [
        `Players pick one team from the eligible ${eligibleDays} fixture set each selection window.`,
        'If the team wins, the player survives.',
        'If the team draws, loses, or no pick is made before the deadline, the player is eliminated.',
        'Each team can only be used once per player per game.',
        'Players can change their pick before the deadline.',
      ],
    },
    {
      title: 'Deadlines and locking',
      items: [
        `Selection deadline is 1 hour before the first eligible ${eligibleDays} fixture in that selection window.`,
        'After lock, selections are read-only.',
      ],
    },
    {
      title: 'Visibility',
      items: [
        'Players can see everyone else’s current weekly selections at any time.',
        'Visibility is not gated by whether the viewer has made their own pick.',
      ],
    },
    {
      title: 'Winning and rollover',
      items: [
        'If one player remains, that player wins the pot.',
        'If nobody survives, the pot rolls over.',
        'No points. No bonus scoring. No tie-breaks.',
      ],
    },
  ]

  return (
    <div className="grid gap-4">
      <Card title="Rules" description={`${APP_NAME} • Game ${CURRENT_GAME} • Pot ${formatGBP(CURRENT_POT_GBP)}`}>
        <div className="grid gap-4">
          {sections.map((section) => (
            <section key={section.title} className="los-panel p-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-purple">{section.title}</h3>
              <ul className="mt-3 grid gap-2 pl-5 text-sm text-muted-ink list-disc">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Card>
    </div>
  )
}
