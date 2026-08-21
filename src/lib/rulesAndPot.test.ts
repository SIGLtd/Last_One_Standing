import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { APP_TAGLINE, formatGBP } from './constants'
import {
  buildRulesSections,
  rulesDefaultDeadlineNote,
  rulesHeadlineDeadline,
} from './rulesContent'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = join(__dirname, '..')
const root = join(src, '..')

function read(relativePath: string): string {
  return readFileSync(join(src, relativePath), 'utf8')
}

const appShellSource = read('components/AppShell.tsx')
const rulesPageSource = read('pages/RulesPage.tsx')
const rulesContentSource = read('lib/rulesContent.ts')
const adminSource = read('pages/AdminPage.tsx')
const homeSource = read('pages/HomePage.tsx')
const dashboardSource = read('pages/DashboardPage.tsx')
const gameContextSource = read('contexts/GameContext.tsx')
const mainSource = read('main.tsx')
const appSource = read('App.tsx')
const constantsSource = read('lib/constants.ts')

describe('rules copy', () => {
  it('says returning players from Games 25 and 26 pay £10.00', () => {
    const entry = buildRulesSections().find((section) => section.title === 'Entry and pot')
    expect(entry?.items[0]).toBe('Returning players from Games 25 and 26 pay £10.00.')
    expect(entry?.items[1]).toBe('New players pay £30.00.')
    expect(entry?.items[2]).toBe('Newbie fee includes £10.00 entry plus £20.00 rollover fairness.')
    expect(rulesPageSource).toContain('buildRulesSections')
  })

  it('shows Friday 21 August 4:00pm as the live Round 1 deadline headline', () => {
    const deadlines = buildRulesSections().find((section) => section.title === 'Deadlines')
    expect(deadlines?.items[0]).toBe('The organiser sets the deadline for each round.')
    expect(deadlines?.items[1]).toBe('Current Round 1 deadline: 4:00pm Friday 21 August.')
    expect(deadlines?.items[2]).toBe('Selections are read-only after the deadline.')
    expect(rulesHeadlineDeadline()).toBe('Current Round 1 deadline: 4:00pm Friday 21 August.')
  })

  it('keeps the one-hour default as secondary, not the live deadline', () => {
    const deadlines = buildRulesSections().find((section) => section.title === 'Deadlines')
    const liveIndex = deadlines?.items.findIndex((item) => item.includes('Current Round 1 deadline')) ?? -1
    const defaultIndex = deadlines?.items.findIndex((item) => item === rulesDefaultDeadlineNote()) ?? -1

    expect(liveIndex).toBe(1)
    expect(defaultIndex).toBeGreaterThan(liveIndex)
    expect(deadlines?.items[0]).not.toMatch(/1 hour before first eligible/i)
    expect(rulesContentSource).not.toContain(
      'Deadline: 1 hour before first eligible Saturday and Sunday fixture, unless the organiser sets a round deadline.',
    )
  })

  it('has no em dashes in rules copy', () => {
    expect(rulesContentSource).not.toContain('—')
    expect(rulesPageSource).not.toContain('—')
  })
})

describe('brand tagline', () => {
  it('uses Pick, survive, repeat. as static header copy', () => {
    expect(APP_TAGLINE).toBe('Pick, survive, repeat.')
    expect(appShellSource).toContain('APP_TAGLINE')
    expect(appShellSource).toContain('{APP_TAGLINE}')
    expect(rulesPageSource).toContain('APP_TAGLINE')
    expect(appShellSource).not.toContain('animation')
    expect(appShellSource).not.toContain('video')
  })
})

describe('live pot display', () => {
  it('formats a saved pot of 2860 with the shared GBP helper', () => {
    expect(formatGBP(2860)).toBe('£2,860.00')
    expect(constantsSource).toContain("style: 'currency', currency: 'GBP'")
    expect(appShellSource).toContain('formatGBP(currentPot)')
    expect(rulesPageSource).toContain('formatGBP(currentPot)')
    expect(dashboardSource).toContain('formatGBP(game.current_pot)')
    expect(adminSource).toContain('currentPot={game?.current_pot ?? currentPot ?? 0}')
  })

  it('does not hard-code the header pot to £1,920', () => {
    expect(appShellSource).not.toContain('1920')
    expect(appShellSource).not.toContain('CURRENT_POT_GBP')
    expect(rulesPageSource).not.toContain('1920')
    expect(rulesPageSource).not.toContain('CURRENT_POT_GBP')
    expect(adminSource).not.toContain('?? 1920')
    expect(constantsSource).not.toContain('CURRENT_POT_GBP')
  })

  it('uses games.current_pot as the shared source for header, Home, Rules, and Admin', () => {
    expect(gameContextSource).toContain('fetchCurrentGame')
    expect(gameContextSource).toContain('updated.current_pot')
    expect(mainSource).toContain('GameProvider')
    expect(appShellSource).toContain('useGame')
    expect(appShellSource).toContain('currentPot')
    expect(rulesPageSource).toContain('useGame')
    expect(adminSource).toContain('applyGameUpdate(updated)')
    expect(adminSource).toContain('adminUpdateCurrentPot')
    expect(homeSource).toContain('applyGameUpdate(result.currentGame)')
    expect(dashboardSource).toContain('applyGameUpdate(currentGame)')
  })
})

describe('intro splash stays off the Home/auth path', () => {
  it('does not import splash into Home or main', () => {
    expect(homeSource).not.toContain('LandingSplash')
    expect(mainSource).not.toContain('LandingSplash')
    expect(appSource).toContain('<LandingSplash />')
    expect(existsSync(join(root, 'src', 'components', 'LandingSplash.tsx'))).toBe(true)
    expect(existsSync(join(root, 'public', 'media', 'LOS-Landing-video.mp4'))).toBe(true)
  })
})
