import { FEES, formatEligibleSelectionDays, formatGBP } from './constants'

export type RulesSection = {
  title: string
  items: string[]
}

const eligibleDays = formatEligibleSelectionDays()

export function buildRulesSections(): RulesSection[] {
  return [
    {
      title: 'How to play',
      items: [
        'Pick one Premier League team each round.',
        'If your team wins, you survive.',
        'If your team draws or loses, you are eliminated.',
        'You cannot pick the same team twice in the same game.',
      ],
    },
    {
      title: 'Eligible fixtures',
      items: [
        `Only ${eligibleDays} Premier League fixtures count by default.`,
        'Friday, Monday and midweek fixtures are excluded unless Admin announces an exception.',
      ],
    },
    {
      title: 'Deadlines',
      items: [
        'The normal deadline is 16:00 on the Friday before the Saturday/Sunday fixtures start.',
        'You can change your pick before the deadline.',
        'After the deadline, normal picks are locked.',
        'Admin may record an organiser-approved correction. Corrections are marked and audited.',
      ],
    },
    {
      title: 'Entry and pot',
      items: [
        `Returning players from Games 25 and 26 pay ${formatGBP(FEES.returning_player)}.`,
        `New players pay ${formatGBP(FEES.new_player)}.`,
        `Newbie fee includes ${formatGBP(FEES.returning_player)} entry plus ${formatGBP(FEES.new_player_rollover_fairness_contribution)} rollover fairness.`,
        'If one player remains, they win the pot.',
        'If nobody wins, Admin may roll the pot into the next game.',
      ],
    },
    {
      title: 'Visibility',
      items: [
        'All current weekly selections are visible to everyone.',
        'You do not need to submit a pick first to view others.',
      ],
    },
  ]
}

export function rulesHeadlineDeadline(): string {
  return 'The normal deadline is 16:00 on the Friday before the Saturday/Sunday fixtures start.'
}

export function rulesDefaultDeadlineNote(): string {
  return 'The normal deadline is 16:00 on the Friday before the Saturday/Sunday fixtures start.'
}
