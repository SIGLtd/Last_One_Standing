import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { formatCompactDeadlineLondon } from '../lib/fixtureOps'
import {
  authAndHomeLoadingAreSeparate,
  distributionFailureBlocksPickUi,
  essentialFailureShowsRetry,
  guestHomeWaitsForPlayerProfile,
  PLAYER_LOAD_ERROR,
  shouldRenderPickShell,
  withTimeout,
} from '../lib/homeLoad'
import { ROUND1_LIVE_DEADLINE_UTC } from '../lib/round1'

const __dirname = dirname(fileURLToPath(import.meta.url))
const homeSource = readFileSync(join(__dirname, 'HomePage.tsx'), 'utf8')
const appSource = readFileSync(join(__dirname, '..', 'App.tsx'), 'utf8')
const authSource = readFileSync(join(__dirname, '..', 'contexts', 'AuthContext.tsx'), 'utf8')

describe('home landing page', () => {
  it('keeps round, deadline, dropdown and save in the primary view', () => {
    expect(homeSource).toContain('formatCompactDeadlineLondon')
    expect(homeSource).toContain('picks')
    expect(homeSource).toContain('Choose your team')
    expect(homeSource).toContain('Save pick')
    expect(homeSource).toContain('Update pick')
    expect(homeSource).toContain('<select')
    expect(homeSource).toContain('saveSelection')
    expect(homeSource).toContain('Most picked')
    expect(homeSource).toContain('View all picks')
    expect(homeSource).toContain('FixtureMatchRow')
    expect(formatCompactDeadlineLondon(ROUND1_LIVE_DEADLINE_UTC)).toContain('21')
    expect(formatCompactDeadlineLondon(ROUND1_LIVE_DEADLINE_UTC).toLowerCase()).toContain('4:00pm')
  })

  it('does not force the full fixture list open by default', () => {
    expect(homeSource).toContain('useState(false)')
    expect(homeSource).toContain('Show')
    expect(homeSource).toContain('fixture')
    expect(homeSource).not.toContain('This week’s fixtures')
  })

  it('filters used teams for the signed-in player only', () => {
    expect(homeSource).toContain('fetchFinallyUsedTeamIds(player.id, game.id)')
    expect(homeSource).toContain('filterSelectableTeamOptions')
  })

  it('loads current round without waiting for auth or distribution', () => {
    expect(homeSource).toContain('Loading your game...')
    expect(homeSource).toContain('loadRound')
    expect(homeSource).not.toContain('if (!authLoading) void loadCore()')
    expect(homeSource).toContain('Checking your sign-in...')
    expect(homeSource).toContain('Retry')
    expect(homeSource).not.toContain('adminFetch')
    expect(homeSource).not.toContain('payments')
    expect(authSource).not.toContain('adminFetch')
  })

  it('does not gate Home behind the intro overlay', () => {
    expect(homeSource).not.toContain('LandingSplash')
    expect(homeSource).not.toContain('splash')
    expect(appSource).toContain('<LandingSplash />')
  })

  it('does not invent win-chance percentages', () => {
    expect(homeSource).not.toContain('win chance')
    expect(homeSource).not.toContain('odds')
    expect(homeSource).not.toContain('% chance')
  })
})

describe('home cold load', () => {
  it('renders the pick shell after current round/fixtures resolve even if auth is still loading', () => {
    expect(
      shouldRenderPickShell({
        roundLoading: false,
        roundFailed: false,
        hasRoundData: true,
      }),
    ).toBe(true)
    expect(
      authAndHomeLoadingAreSeparate({
        authLoading: true,
        roundLoading: false,
        roundFailed: false,
        hasRoundData: true,
        playerLoading: false,
        distributionLoading: true,
        distributionFailed: false,
      }),
    ).toBe(true)
  })

  it('does not wait forever for a guest player profile', () => {
    expect(guestHomeWaitsForPlayerProfile()).toBe(false)
    expect(homeSource).toContain('if (!player)')
    expect(homeSource).toContain('Log in to make your pick.')
  })

  it('does not block the pick UI when optional distribution fails', () => {
    expect(
      distributionFailureBlocksPickUi({
        authLoading: false,
        roundLoading: false,
        roundFailed: false,
        hasRoundData: true,
        playerLoading: false,
        distributionLoading: false,
        distributionFailed: true,
      }),
    ).toBe(false)
    expect(homeSource).toContain('Failed to load pick distribution')
    expect(homeSource).toContain('Choose your team')
  })

  it('shows retry/error instead of endless loading when the essential round fetch fails', () => {
    expect(
      essentialFailureShowsRetry({
        authLoading: false,
        roundLoading: false,
        roundFailed: true,
        hasRoundData: false,
        playerLoading: false,
        distributionLoading: false,
        distributionFailed: false,
      }),
    ).toBe(true)
    expect(homeSource).toContain('Could not load the current round')
    expect(homeSource).toContain('Retry')
    expect(PLAYER_LOAD_ERROR).toContain('try again')
  })

  it('times out a hung essential fetch', async () => {
    const hung = new Promise<string>(() => undefined)
    await expect(withTimeout(hung, 20, PLAYER_LOAD_ERROR)).rejects.toThrow(PLAYER_LOAD_ERROR)
  })
})
