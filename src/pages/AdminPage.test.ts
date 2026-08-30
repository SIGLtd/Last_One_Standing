import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const adminPageSource = readFileSync(join(__dirname, '..', 'pages', 'AdminPage.tsx'), 'utf8')
const advancedSectionSource = readFileSync(
  join(__dirname, '..', 'components', 'admin', 'AdminAdvancedOperationsSection.tsx'),
  'utf8',
)
const resultsSectionSource = readFileSync(
  join(__dirname, '..', 'components', 'admin', 'AdminRoundResultsSection.tsx'),
  'utf8',
)
const thisRoundSource = readFileSync(join(__dirname, '..', 'components', 'admin', 'AdminThisRoundSection.tsx'), 'utf8')
const currentPicksSource = readFileSync(join(__dirname, '..', 'pages', 'CurrentPicksPage.tsx'), 'utf8')
const myPicksSource = readFileSync(join(__dirname, '..', 'pages', 'MyPicksPage.tsx'), 'utf8')
const homeSource = readFileSync(join(__dirname, '..', 'pages', 'HomePage.tsx'), 'utf8')
const pickSource = readFileSync(join(__dirname, '..', 'pages', 'PickPage.tsx'), 'utf8')

describe('admin page mobile cockpit layout', () => {
  it('renders round control before advanced operations', () => {
    const roundControlIndex = adminPageSource.indexOf('<AdminRoundControlCard')
    const advancedIndex = adminPageSource.indexOf('<AdminAdvancedOperationsSection')
    expect(roundControlIndex).toBeGreaterThan(-1)
    expect(advancedIndex).toBeGreaterThan(-1)
    expect(roundControlIndex).toBeLessThan(advancedIndex)
  })

  it('keeps advanced operations in a collapsed details element', () => {
    expect(advancedSectionSource).toContain('<details')
    expect(advancedSectionSource).toContain('Advanced operations')
  })
})

describe('admin round results controls', () => {
  it('shows sync, preview, resolve, and open-next-round actions for admin only', () => {
    expect(resultsSectionSource).toContain('Sync latest results')
    expect(resultsSectionSource).toContain('Resolution preview')
    expect(resultsSectionSource).toContain('Resolve round')
    expect(resultsSectionSource).toContain('Open next round')
    expect(resultsSectionSource).toContain('<details')
    expect(resultsSectionSource).toContain('<summary')
    expect(resultsSectionSource).toContain('{title} ({rows.length})')
    expect(resultsSectionSource).toContain('Eliminated 💀')
    expect(resultsSectionSource).toContain('No pick 💀')
    expect(resultsSectionSource).toContain('TeamChip')
    expect(resultsSectionSource).toContain('window.id')
    expect(resultsSectionSource).toContain('fixtureCount')
    expect(resultsSectionSource).toContain('deadline')
    expect(adminPageSource).toContain('getAdminResolutionWindow')
    expect(adminPageSource).toContain('getAdminLiveOpenWindow')
    expect(adminPageSource).not.toContain('FOOTBALL_DATA_API_KEY')
  })

  it('does not expose private player or payment fields in the audit list', () => {
    expect(resultsSectionSource).not.toContain('row.email')
    expect(resultsSectionSource).not.toContain('entry.email')
    expect(resultsSectionSource).not.toContain('entry.phone')
    expect(resultsSectionSource).not.toContain('payment_claimed')
    expect(resultsSectionSource).not.toContain('>{row.playerId}<')
    expect(currentPicksSource).not.toContain('row.email')
    expect(currentPicksSource).not.toContain('row.phone')
    expect(myPicksSource).toContain('row.statusLabel')
    expect(myPicksSource).toContain('TeamChip')
  })

  it('shows Round fixture count, weekend dates, weekday, and a non-Sat/Sun warning', () => {
    expect(thisRoundSource).toContain('inspectWeekendSnapshot')
    expect(thisRoundSource).toContain('eligible_sat_date')
    expect(thisRoundSource).toContain('londonWeekdayLabel')
    expect(thisRoundSource).toContain('Snapshot valid')
    expect(thisRoundSource).toContain('validity.issues')
    expect(currentPicksSource).toContain('fetchCurrentSelectionWindow')
    expect(homeSource).toContain('fetchWindowEligibleFixtures')
    expect(homeSource).toContain('buildSelectableTeamOptions(result.windowFixtures)')
    expect(adminPageSource).toContain('<AdminThisRoundSection')
    expect(adminPageSource).toContain('NON_WEEKEND_FIXTURES')
    expect(adminPageSource).toContain('if (!check.canOpen)')
    expect(pickSource).toContain('fetchWindowEligibleFixtures')
  })

  it('exposes the admin late pick override without private player fields', () => {
    expect(adminPageSource).toContain('adminSubmitLateSelection')
    expect(adminPageSource).toContain('handleSaveLatePick')
    expect(adminPageSource).not.toContain('entry.email')
    expect(currentPicksSource).toContain('adminEntryLabel')
    expect(myPicksSource).toContain('row.adminEntryLabel')
  })
})
