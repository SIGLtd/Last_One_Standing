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
