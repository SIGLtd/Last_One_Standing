import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = join(__dirname, '..')

function read(relativePath: string): string {
  return readFileSync(join(src, relativePath), 'utf8')
}

const v2Dir = join(src, 'components', 'ui-lab', 'v2')
const v2Sources = readdirSync(v2Dir)
  .filter((name) => name.endsWith('.tsx') || name.endsWith('.ts') || name.endsWith('.css'))
  .map((name) => read(`components/ui-lab/v2/${name}`))
  .join('\n')

const homeSource = read('pages/HomePage.tsx')
const pickSource = read('pages/PickPage.tsx')
const picksSource = read('pages/CurrentPicksPage.tsx')
const historySource = read('pages/HistoryPage.tsx')
const rulesSource = read('pages/RulesPage.tsx')
const adminSource = read('pages/AdminPage.tsx')
const uiLabPage = read('pages/UiLabPage.tsx')
const homeV2 = read('components/ui-lab/v2/PlayerHomeLabV2.tsx')
const pickV2 = read('components/ui-lab/v2/PickLabV2.tsx')
const adminV2 = read('components/ui-lab/v2/AdminCockpitLabV2.tsx')

describe('UI Lab visual v2 stays off live routes', () => {
  it('does not import v2 mocks from live pages', () => {
    for (const [label, source] of [
      ['HomePage', homeSource],
      ['PickPage', pickSource],
      ['CurrentPicksPage', picksSource],
      ['HistoryPage', historySource],
      ['RulesPage', rulesSource],
      ['AdminPage', adminSource],
    ] as const) {
      expect(source, label).not.toContain('ui-lab/v2')
      expect(source, label).not.toContain('LabV2')
    }
    expect(homeSource).toContain('PlayerHomePreview')
    expect(pickSource).toContain('PickPreview')
    expect(adminSource).toContain('ADMIN_PREVIEW_SECTIONS')
  })

  it('renders the v2 mock only on /ui-lab', () => {
    expect(uiLabPage).toContain('LabV2Frame')
    expect(uiLabPage).toContain('PlayerHomeLabV2')
    expect(uiLabPage).toContain('PickLabV2')
    expect(uiLabPage).toContain('AdminCockpitLabV2')
    expect(uiLabPage).toContain('canAccessUiLab')
  })

  it('uses the new palette, shirts, Friday 16:00, and no betting copy', () => {
    expect(v2Sources).toContain('#14081F')
    expect(v2Sources).toContain('#d4ff00')
    expect(v2Sources).toContain('#00e5a3')
    expect(homeV2).toContain('TeamChip')
    expect(pickV2).toContain('TeamChip')
    expect(pickV2).toContain('useState<string | null>(null)')
    expect(pickV2).toContain('No team is preselected')
    expect(adminV2).toContain('UI_LAB_PREVIEW_ONLY')
    expect(adminV2).toContain('settlement-gate')
    expect(v2Sources).toContain('UI_LAB_DEADLINE_RULE')
    expect(v2Sources.toLowerCase()).not.toContain('odds')
    expect(v2Sources).not.toContain('11:30')
    expect(v2Sources).not.toContain('60 minutes')
    expect(v2Sources).not.toContain('saveSelection')
    expect(v2Sources).not.toContain('adminCompleteGame')
  })
})
