import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const homeSource = readFileSync(join(__dirname, '..', 'pages', 'HomePage.tsx'), 'utf8')
const appSource = readFileSync(join(__dirname, '..', 'App.tsx'), 'utf8')
const authSource = readFileSync(join(__dirname, '..', 'contexts', 'AuthContext.tsx'), 'utf8')

describe('home landing page', () => {
  it('shows the current round summary, fixtures, and pick action', () => {
    expect(homeSource).toContain('Deadline:')
    expect(homeSource).toContain('Picks submitted:')
    expect(homeSource).toContain('Pick one team to win')
    expect(homeSource).toContain('Choose your team')
    expect(homeSource).toContain('Save pick')
    expect(homeSource).toContain('Update pick')
    expect(homeSource).toContain('This week’s fixtures')
    expect(homeSource).toContain('What everyone is picking')
    expect(homeSource).toContain('<select')
    expect(homeSource).toContain('saveSelection')
  })

  it('filters used teams for the signed-in player only', () => {
    expect(homeSource).toContain('fetchFinallyUsedTeamIds(player.id, currentGame.id)')
    expect(homeSource).toContain('filterSelectableTeamOptions(options, usedTeams)')
  })

  it('loads the round and pick first, then pick distribution', () => {
    expect(homeSource).toContain('Loading your game...')
    expect(homeSource).toContain('Loading picks...')
    expect(homeSource).toContain('loadDistribution')
    expect(homeSource).toContain('fetchLatestOperationalWindow')
    expect(homeSource).toContain('fetchSubmittedTeamIdsForWindow')
    expect(homeSource).not.toContain('adminFetch')
    expect(homeSource).not.toContain('fetchAll')
    expect(homeSource).not.toContain('payments')
    expect(authSource).not.toContain('adminFetch')
  })

  it('does not render an intro or splash component', () => {
    expect(appSource).not.toContain('LandingSplash')
    expect(homeSource).not.toContain('LandingSplash')
    expect(homeSource).not.toContain('splash')
    expect(existsSync(join(__dirname, '..', 'components', 'LandingSplash.tsx'))).toBe(false)
  })

  it('does not invent win-chance percentages', () => {
    expect(homeSource).not.toContain('win chance')
    expect(homeSource).not.toContain('odds')
    expect(homeSource).not.toContain('% chance')
  })
})
