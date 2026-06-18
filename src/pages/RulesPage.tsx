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
        `Newbie fee includes ${formatGBP(FEES.returning_player)} entry plus ${formatGBP(FEES.new_player_rollover_fairness_contribution)} rollover fairness.`,
      ],
    },
    {
      title: 'Eligible fixtures',
      items: [
        `${eligibleDays} Premier League games only.`,
        'Friday and Monday fixtures excluded.',
        'Midweek fixtures excluded unless organiser creates an exception.',
      ],
    },
    {
      title: 'Weekly picks',
      items: [
        `One team per window from eligible ${eligibleDays} fixtures.`,
        'Win to survive. Draw, loss, or missed deadline eliminates.',
        'Each team once per player per game. Change allowed before deadline.',
      ],
    },
    {
      title: 'Deadlines',
      items: [
        `Deadline: 1 hour before first eligible ${eligibleDays} fixture in the window.`,
        'Selections read-only after lock.',
      ],
    },
    {
      title: 'Visibility',
      items: [
        'All current weekly selections visible to everyone at all times.',
        'Not gated by whether the viewer has picked.',
      ],
    },
    {
      title: 'Winning',
      items: [
        'Last survivor wins the pot.',
        'No survivors = rollover. No points or tie-breaks.',
      ],
    },
  ]

  return (
    <Card
      title="Rules"
      description={`${APP_NAME} · Game ${CURRENT_GAME} · ${formatGBP(CURRENT_POT_GBP)}`}
      compact
    >
      <div>
        {sections.map((section) => (
          <section key={section.title} className="los-rules-section">
            <h3 className="los-section-title text-purple">{section.title}</h3>
            <ul className="mt-1.5 grid gap-1 pl-4 text-xs text-muted-ink list-disc leading-relaxed">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  )
}
