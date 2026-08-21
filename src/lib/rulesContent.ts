import { FEES, formatEligibleSelectionDays, formatGBP } from './constants'
import { ROUND1_DEADLINE_PLAYER_LABEL } from './round1'

export type RulesSection = {
  title: string
  items: string[]
}

const eligibleDays = formatEligibleSelectionDays()

export function buildRulesSections(): RulesSection[] {
  return [
    {
      title: 'Entry and pot',
      items: [
        `Returning players from Games 25 and 26 pay ${formatGBP(FEES.returning_player)}.`,
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
        `One team per round from eligible ${eligibleDays} fixtures.`,
        'Win to survive. Draw, loss, or missed deadline eliminates.',
        'Each team once per player per game. You can change your pick before the deadline.',
      ],
    },
    {
      title: 'Deadlines',
      items: [
        'The organiser sets the deadline for each round.',
        `Current Round 1 deadline: ${ROUND1_DEADLINE_PLAYER_LABEL}.`,
        'Selections are read-only after the deadline.',
        'If no special round deadline is set, the default is one hour before the first eligible fixture.',
      ],
    },
    {
      title: 'Visibility',
      items: [
        'All current weekly selections are visible to everyone.',
        'You do not need to submit a pick first to view others.',
      ],
    },
    {
      title: 'Winning',
      items: [
        'Last survivor wins the pot.',
        'No survivors means a rollover. No points or tie-breaks.',
      ],
    },
  ]
}

export function rulesHeadlineDeadline(): string {
  return `Current Round 1 deadline: ${ROUND1_DEADLINE_PLAYER_LABEL}.`
}

export function rulesDefaultDeadlineNote(): string {
  return 'If no special round deadline is set, the default is one hour before the first eligible fixture.'
}
