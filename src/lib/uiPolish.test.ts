import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = join(__dirname, '..')

function read(relativePath: string): string {
  return readFileSync(join(src, relativePath), 'utf8')
}

const homeSource = read('pages/HomePage.tsx')
const pickSource = read('pages/PickPage.tsx')
const currentPicksSource = read('pages/CurrentPicksPage.tsx')
const fixtureRowSource = read('components/FixtureMatchRow.tsx')
const distributionRowSource = read('components/PickDistributionRowView.tsx')
const teamChipSource = read('components/TeamChip.tsx')
const pickDistributionSource = read('lib/pickDistribution.ts')

describe('fixture match rows', () => {
  it('renders home chip, home team, centred vs, away team, away chip', () => {
    const rowSource = fixtureRowSource.slice(fixtureRowSource.indexOf('los-match-row'))
    const homeSide = rowSource.indexOf('los-match-home')
    const homeChip = rowSource.indexOf('teamId={fixture.home_team_id}')
    const homeName = rowSource.lastIndexOf('{fixture.home_team_name}')
    const vs = rowSource.indexOf('los-match-vs')
    const awaySide = rowSource.indexOf('los-match-away')
    const awayName = rowSource.lastIndexOf('{fixture.away_team_name}')
    const awayChip = rowSource.indexOf('teamId={fixture.away_team_id}')

    expect(homeSide).toBeGreaterThan(-1)
    expect(homeChip).toBeGreaterThan(homeSide)
    expect(homeName).toBeGreaterThan(homeChip)
    expect(vs).toBeGreaterThan(homeName)
    expect(awaySide).toBeGreaterThan(vs)
    expect(awayName).toBeGreaterThan(awaySide)
    expect(awayChip).toBeGreaterThan(awayName)
    expect(fixtureRowSource).not.toContain('>v<')
  })

  it('does not keep ugly inline v rows on Home', () => {
    expect(homeSource).toContain('FixtureMatchRow')
    expect(homeSource).not.toContain("text-muted-ink\">v</span>")
    expect(homeSource).not.toContain(' Hull City v ')
  })
})

describe('pick distribution presentation', () => {
  it('uses structured count and percentage elements instead of em-dash text', () => {
    expect(distributionRowSource).toContain('los-dist-name')
    expect(distributionRowSource).toContain('los-dist-count')
    expect(distributionRowSource).toContain('los-dist-pct')
    expect(distributionRowSource).toContain('formatPickCount')
    expect(distributionRowSource).not.toContain('—')
    expect(pickDistributionSource).not.toContain('—')
    expect(homeSource).not.toContain('formatPickDistributionLine')
  })
})

describe('player-facing copy', () => {
  it('has no em dashes in the Home, Pick, and Current Picks journey', () => {
    for (const [label, source] of [
      ['HomePage', homeSource],
      ['PickPage', pickSource],
      ['CurrentPicksPage', currentPicksSource],
      ['FixtureMatchRow', fixtureRowSource],
      ['PickDistributionRowView', distributionRowSource],
      ['TeamChip', teamChipSource],
      ['pickDistribution', pickDistributionSource],
    ] as const) {
      expect(source, `${label} still contains an em dash`).not.toContain('—')
    }
  })
})

describe('team chips', () => {
  it('renders an accessible shirt label and a safe unknown fallback', () => {
    expect(teamChipSource).toContain('aria-label={`${fullName} colours`}')
    expect(teamChipSource).toContain('role="img"')
    expect(teamChipSource).toContain('<svg')
    expect(teamChipSource).not.toContain('{identity.initials}')
  })
})
