import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = join(__dirname, '..')

function read(relativePath: string): string {
  return readFileSync(join(src, relativePath), 'utf8')
}

function readUiLabSources(): string {
  const files = [
    'pages/UiLabPage.tsx',
    'lib/uiLabAccess.ts',
    'lib/uiLabPreview.ts',
    ...readdirSync(join(src, 'components', 'ui-lab')).map((name) => `components/ui-lab/${name}`),
  ]
  return files.map((file) => read(file)).join('\n')
}

const appSource = read('App.tsx')
const adminSource = read('pages/AdminPage.tsx')
const homeSource = read('pages/HomePage.tsx')
const pickSource = read('pages/PickPage.tsx')
const currentPicksSource = read('pages/CurrentPicksPage.tsx')
const rulesSource = read('pages/RulesPage.tsx')
const historySource = read('pages/HistoryPage.tsx')
const navSource = read('lib/appNavigation.ts')
const uiLabPreviewLib = read('lib/uiLabPreview.ts')
const uiLabPage = read('pages/UiLabPage.tsx')
const previewShell = read('components/ui-lab/PreviewShell.tsx')
const homePreview = read('components/ui-lab/PlayerHomePreview.tsx')
const pickPreview = read('components/ui-lab/PickPreview.tsx')
const picksPreview = read('components/ui-lab/CurrentPicksPreview.tsx')
const historyPreview = read('components/ui-lab/HistoryPreview.tsx')
const rulesPreview = read('components/ui-lab/RulesPreview.tsx')
const adminPreview = read('components/ui-lab/AdminCockpitPreview.tsx')
const uiLabSources = readUiLabSources()

const MUTATION_FNS = [
  'saveSelection',
  'adminReinstatePlayer',
  'adminUpdateRoundWindow',
  'adminCompleteGame',
  'adminStartNewGame',
  'adminSubmitSelection',
  'adminApplyRoundResolution',
]

describe('UI Lab route', () => {
  it('registers /ui-lab without replacing live routes', () => {
    expect(appSource).toContain('path="/ui-lab"')
    expect(appSource).toContain('<UiLabPage')
    expect(appSource).toContain('path="/" element={<HomePage />}')
    expect(appSource).toContain('path="/pick" element={<PickPage />}')
    expect(appSource).toContain('path="/current-picks" element={<CurrentPicksPage />}')
    expect(appSource).toContain('path="/rules" element={<RulesPage />}')
    expect(appSource).toContain('path="/history" element={<HistoryPage />}')
    expect(appSource).toContain('path="/admin" element={<AdminPage />}')
  })

  it('renders the lab landing and preview screens', () => {
    expect(uiLabPage).toContain('canAccessUiLab')
    expect(previewShell).toContain('Testing the next version of Last One Standing')
    expect(previewShell).toContain('UI_LAB_SCREEN_LABELS')
    expect(uiLabPreviewLib).toContain('Player Home Preview')
    expect(uiLabPreviewLib).toContain('Make Pick Preview')
    expect(uiLabPreviewLib).toContain("Everyone's Picks Preview")
    expect(uiLabPreviewLib).toContain('History Preview')
    expect(uiLabPreviewLib).toContain('Rules Preview')
    expect(uiLabPreviewLib).toContain('Admin Cockpit Preview')
    expect(uiLabPage).toContain('PlayerHomePreview')
    expect(uiLabPage).toContain('PickPreview')
    expect(uiLabPage).toContain('CurrentPicksPreview')
    expect(uiLabPage).toContain('HistoryPreview')
    expect(uiLabPage).toContain('RulesPreview')
    expect(uiLabPage).toContain('AdminCockpitPreview')
  })

  it('does not call production mutation functions', () => {
    for (const fn of MUTATION_FNS) {
      expect(uiLabSources, `${fn} must not be used by UI Lab`).not.toContain(fn)
    }
    expect(pickPreview).toContain('UI_LAB_PREVIEW_ONLY')
    expect(adminPreview).toContain('UI_LAB_PREVIEW_ONLY')
    expect(pickPreview).toContain("useState<string | null>(null)")
  })
})

describe('UI Lab access in Admin', () => {
  it('shows the UI Lab link only after the admin gate', () => {
    const deniedIndex = adminSource.indexOf('You do not have admin access')
    const labIndex = adminSource.indexOf('{UI_LAB_LINK_LABEL}')
    expect(deniedIndex).toBeGreaterThan(-1)
    expect(labIndex).toBeGreaterThan(deniedIndex)
    expect(adminSource).toContain('UI_LAB_PATH')
    expect(navSource).not.toContain('/ui-lab')
  })
})

describe('live routes stay unchanged', () => {
  it('keeps production pages on their existing components', () => {
    expect(homeSource).toContain('saveSelection')
    expect(pickSource).toContain('saveSelection')
    expect(homeSource).not.toContain('ui-lab')
    expect(pickSource).not.toContain('ui-lab')
    expect(currentPicksSource).not.toContain('ui-lab')
    expect(rulesSource).not.toContain('ui-lab')
    expect(historySource).not.toContain('ui-lab')
  })
})

describe('player home preview markup', () => {
  it('uses a single context anchor and live LOS identity', () => {
    expect(homePreview).toContain('player-context-anchor')
    expect(homePreview).toContain('TeamChip')
    expect(homePreview).toContain('PickDistributionRowView')
    expect(homePreview).toContain('FixtureMatchRow')
    expect(homePreview).toContain('UI_LAB_DEADLINE_RULE')
    expect(homePreview).not.toContain('11:30')
    expect(homePreview).not.toContain('60 minutes')
  })
})

describe('pick preview markup', () => {
  it('keeps shirt icons, locked used teams, and local confirmation', () => {
    expect(pickPreview).toContain('TeamChip')
    expect(pickPreview).toContain('data-locked')
    expect(pickPreview).toContain('pick-confirm-bar')
    expect(pickPreview).toContain('pick-spectator')
    expect(pickPreview).toContain('No team is preselected')
    expect(pickPreview).not.toContain('odds')
    expect(pickPreview).not.toContain('11:30')
  })
})

describe("everyone's picks preview markup", () => {
  it('has by-player and by-team views without private fields', () => {
    expect(picksPreview).toContain('By player')
    expect(picksPreview).toContain('By team')
    expect(picksPreview).toContain('picks-by-player')
    expect(picksPreview).toContain('picks-by-team')
    expect(picksPreview).toContain('TeamChip')
    expect(picksPreview).not.toContain('email')
    expect(picksPreview).not.toContain('phone')
  })
})

describe('rules preview markup', () => {
  it('uses scannable cards and the Friday 16:00 rule', () => {
    expect(rulesPreview).toContain('rulesPreviewSections')
    expect(rulesPreview).toContain('UI_LAB_DEADLINE_RULE')
    expect(rulesPreview).not.toContain('11:30')
    expect(rulesPreview).not.toContain('August')
  })
})

describe('admin cockpit preview markup', () => {
  it('segments overview, lifecycle and corrections with a protected settlement gate', () => {
    expect(adminPreview).toContain('ADMIN_PREVIEW_SECTION_LABELS')
    expect(uiLabPreviewLib).toContain('Game lifecycle')
    expect(uiLabPreviewLib).toContain('Corrections')
    expect(adminPreview).toContain('Reinstate player')
    expect(adminPreview).toContain('Edit current round')
    expect(adminPreview).toContain('settlement-gate')
    expect(adminPreview).toContain('Winner paid')
    expect(adminPreview).toContain('disabled')
    expect(adminPreview).not.toContain('adminCompleteGame')
    expect(adminPreview).not.toContain('adminReinstatePlayer')
    expect(adminPreview).not.toContain('11:30')
  })
})

describe('history preview markup', () => {
  it('uses game cards and credibility stats', () => {
    expect(historyPreview).toContain('data-history-kind')
    expect(historyPreview).toContain('historyCardLabel')
    expect(uiLabPreviewLib).toContain('Winner paid')
    expect(historyPreview).toContain('Paid to winners')
    expect(historyPreview).toContain('Biggest win')
  })
})
