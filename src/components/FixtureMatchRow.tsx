import { TeamChip } from './TeamChip'
import { formatCompactKickoffLondon } from '../lib/fixtureOps'
import type { SelectionWindowEligibleFixture } from '../types'

export function FixtureMatchRow({ fixture }: { fixture: SelectionWindowEligibleFixture }) {
  const kickoff = formatCompactKickoffLondon(fixture.kickoff_at)

  return (
    <li
      className="los-match"
      aria-label={`${fixture.home_team_name} versus ${fixture.away_team_name}, ${kickoff}`}
    >
      <p className="los-match-time">{kickoff}</p>
      <div className="los-match-row">
        <div className="los-match-home">
          <TeamChip teamId={fixture.home_team_id} size="sm" />
          <span className="los-match-name" title={fixture.home_team_name}>
            {fixture.home_team_name}
          </span>
        </div>
        <span className="los-match-vs" aria-hidden="true">
          vs
        </span>
        <div className="los-match-away">
          <span className="los-match-name" title={fixture.away_team_name}>
            {fixture.away_team_name}
          </span>
          <TeamChip teamId={fixture.away_team_id} size="sm" />
        </div>
      </div>
    </li>
  )
}
