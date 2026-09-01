import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  buildHomeSurvivorRows,
  ELIMINATED_BANNER_BODY,
  ELIMINATED_BANNER_TITLE,
  ELIMINATED_TICKER_TEXT,
  homeSurvivorPreview,
  playerSurvivalStatusFromEntry,
  shouldCollapseHomeSurvivorList,
  shouldShowEliminatedBanner,
  survivalAuditGroupOpenByDefault,
  tickerShouldAnimate,
} from './survivalStatus'
import type { WindowPickRow } from '../types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = join(__dirname, '..')

function read(relativePath: string): string {
  return readFileSync(join(src, relativePath), 'utf8')
}

const resultsSource = read('components/admin/AdminRoundResultsSection.tsx')
const homeSource = read('pages/HomePage.tsx')
const whoSurvivedSource = read('components/WhoSurvivedSection.tsx')
const bannerSource = read('components/EliminatedBanner.tsx')
const shellSource = read('components/AppShell.tsx')
const cssSource = read('index.css')
const currentPicksSource = read('pages/CurrentPicksPage.tsx')
const selectionsSource = read('lib/selections.ts')
const splashSource = read('components/LandingSplash.tsx')
const appSource = read('App.tsx')
const navSource = read('lib/appNavigation.ts')

function pick(playerId: string, name: string, teamId: string, outcome: WindowPickRow['outcome']): WindowPickRow {
  return {
    player_id: playerId,
    display_name: name,
    team_id: teamId,
    locked_at: null,
    entry_status: outcome === 'survived' ? 'active' : 'eliminated',
    outcome,
  }
}

describe('survival audit dropdowns', () => {
  it('renders Survived and Eliminated groups as disclosures with counts', () => {
    expect(resultsSource).toContain('<details')
    expect(resultsSource).toContain('<summary')
    expect(resultsSource).toContain('los-tap-target')
    expect(resultsSource).toContain('{title} ({rows.length})')
    expect(resultsSource).toContain('Survived')
    expect(resultsSource).toContain('Eliminated 💀')
    expect(resultsSource).toContain('survivalAuditGroupOpenByDefault')
    expect(survivalAuditGroupOpenByDefault('survived', 23)).toBe(true)
    expect(survivalAuditGroupOpenByDefault('eliminated', 69)).toBe(false)
    expect(survivalAuditGroupOpenByDefault('eliminated', 4)).toBe(true)
  })

  it('keeps player name, kit icon, selected team, and outcome on audit rows', () => {
    expect(resultsSource).toContain('row.displayName')
    expect(resultsSource).toContain('TeamChip')
    expect(resultsSource).toContain('row.teamName')
    expect(resultsSource).toContain('outcomeText(row)')
    expect(resultsSource).not.toContain('row.email')
    expect(resultsSource).not.toContain('entry.phone')
    expect(resultsSource).not.toContain('payment_claimed')
    expect(resultsSource).not.toContain('>{row.playerId}<')
  })
})

describe('home survivor list', () => {
  it('shows Who survived after a resolved previous round', () => {
    expect(homeSource).toContain('fetchLatestResolvedOperationalWindow')
    expect(homeSource).toContain('WhoSurvivedSection')
    expect(homeSource).toContain('buildHomeSurvivorRows')
    expect(whoSurvivedSource).toContain('Who survived')
    expect(whoSurvivedSource).toContain('player')
    expect(whoSurvivedSource).toContain('through from')
  })

  it('builds survivor rows with name, kit team, and survived-with team only', () => {
    const rows = buildHomeSurvivorRows([
      pick('p1', 'Alex', 'eve', 'survived'),
      pick('p2', 'Sam', 'mci', 'eliminated'),
      pick('p3', 'Jo', 'liv', 'survived'),
    ])
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.displayName)).toEqual(['Alex', 'Jo'])
    expect(rows[0]?.teamId).toBe('eve')
    expect(rows[0]?.teamName).toBe('Everton')
    expect(whoSurvivedSource).toContain('TeamChip')
    expect(whoSurvivedSource).toContain('row.displayName')
    expect(whoSurvivedSource).not.toContain('email')
    expect(whoSurvivedSource).not.toContain('phone')
  })

  it('collapses a long survivor list and keeps the Round 2 pick action first', () => {
    const many = Array.from({ length: 23 }, (_, index) =>
      pick(`p${index}`, `Player ${String(index).padStart(2, '0')}`, 'liv', 'survived'),
    )
    const built = buildHomeSurvivorRows(many)
    expect(shouldCollapseHomeSurvivorList(built.length)).toBe(true)
    expect(homeSurvivorPreview(built, false)).toHaveLength(4)
    expect(homeSurvivorPreview(built, true)).toHaveLength(23)
    expect(whoSurvivedSource).toContain('View all survivors')
    expect(homeSource.indexOf('Choose your team')).toBeGreaterThan(-1)
    expect(homeSource.indexOf('Save pick')).toBeLessThan(homeSource.indexOf('<WhoSurvivedSection'))
    expect(homeSource.indexOf('Most picked')).toBeLessThan(homeSource.indexOf('<WhoSurvivedSection'))
  })
})

describe('eliminated banner', () => {
  it('shows only for a confirmed eliminated logged-in player', () => {
    expect(shouldShowEliminatedBanner('eliminated')).toBe(true)
    expect(shouldShowEliminatedBanner('active')).toBe(false)
    expect(shouldShowEliminatedBanner('unknown')).toBe(false)
    expect(shouldShowEliminatedBanner('other')).toBe(false)
    expect(playerSurvivalStatusFromEntry({ status: 'eliminated' }, false)).toBe('unknown')
    expect(playerSurvivalStatusFromEntry({ status: 'eliminated' }, true)).toBe('eliminated')
    expect(playerSurvivalStatusFromEntry({ status: 'active' }, true)).toBe('active')
    expect(playerSurvivalStatusFromEntry(null, true)).toBe('other')
    expect(shellSource).toContain('fetchMyGameEntry')
    expect(shellSource).toContain("setSurvivalStatus('unknown')")
    expect(shellSource).toContain('shouldShowEliminatedBanner')
    expect(shellSource).toContain('<EliminatedBanner')
  })

  it('uses the required copy, ticker, and reduced-motion static path', () => {
    expect(bannerSource).toContain('ELIMINATED_BANNER_TITLE')
    expect(bannerSource).toContain('ELIMINATED_BANNER_BODY')
    expect(bannerSource).toContain('ELIMINATED_TICKER_TEXT')
    expect(ELIMINATED_TICKER_TEXT).toBe("Let's hope for a rollover")
    expect(tickerShouldAnimate(false)).toBe(true)
    expect(tickerShouldAnimate(true)).toBe(false)
    expect(cssSource).toContain('@media (prefers-reduced-motion: reduce)')
    expect(cssSource).toContain('los-elim-ticker-static')
    expect(cssSource).toContain('animation: none')
    expect(bannerSource).not.toContain('<marquee')
  })

  it('does not change splash, pick save, admin visibility, or Current Picks', () => {
    expect(appSource).toContain('<LandingSplash />')
    expect(splashSource).toContain('INTRO_SEEN_KEY')
    expect(homeSource).toContain('saveSelection')
    expect(selectionsSource).toContain("client.rpc('submit_selection'")
    expect(navSource).toContain("items.push({ kind: 'link', to: '/admin', label: 'Admin' })")
    expect(currentPicksSource).toContain('fetchCurrentSelectionWindow')
    expect(shellSource).not.toContain('.insert')
    expect(shellSource).not.toContain('.update')
    expect(whoSurvivedSource).not.toContain('.insert')
    expect(resultsSource).not.toContain('admin_apply_round_resolution')
  })
})

describe('post-result correction display', () => {
  it('puts a corrected survivor back on Who survived and hides the eliminated banner', () => {
    const rows = buildHomeSurvivorRows([
      pick('p-mills', 'David Mills', 'eve', 'survived'),
      pick('p-out', 'Out Player', 'liv', 'eliminated'),
    ])
    expect(rows.some((row) => row.displayName === 'David Mills')).toBe(true)
    expect(rows.some((row) => row.displayName === 'Out Player')).toBe(false)
    expect(shouldShowEliminatedBanner(playerSurvivalStatusFromEntry({ status: 'active' }, true))).toBe(false)
    expect(currentPicksSource).toContain('adminEntryLabel')
    expect(read('pages/MyPicksPage.tsx')).toContain('row.adminEntryLabel')
  })
})
