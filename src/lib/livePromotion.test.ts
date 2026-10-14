import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { HISTORY_GAMES_1_TO_27 } from '../config/history'
import { buildPlayerHomePreview, pickPreviewCanSubmit, rulesPreviewSections } from './uiLabPreview'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = join(__dirname, '..')
function read(path: string) {
  return readFileSync(join(src, path), 'utf8')
}

const appSource = read('App.tsx')
const shellSource = read('components/AppShell.tsx')
const homeSource = read('pages/HomePage.tsx')
const pickSource = read('pages/PickPage.tsx')
const picksSource = read('pages/CurrentPicksPage.tsx')
const historySource = read('pages/HistoryPage.tsx')
const rulesSource = read('pages/RulesPage.tsx')
const adminSource = read('pages/AdminPage.tsx')
const uiLabSource = read('pages/UiLabPage.tsx')
const homePreview = read('components/ui-lab/PlayerHomePreview.tsx')
const pickPreview = read('components/ui-lab/PickPreview.tsx')
const picksPreview = read('components/ui-lab/CurrentPicksPreview.tsx')
const historyPreview = read('components/ui-lab/HistoryPreview.tsx')
const rulesPreview = read('components/ui-lab/RulesPreview.tsx')
const indexCss = read('index.css')
const resultsSource = read('components/admin/AdminRoundResultsSection.tsx')
const correctionsSource = read('components/admin/AdminCorrectionsSection.tsx')
const proxySource = read('components/admin/AdminProxyPicksSection.tsx')

describe('promoted live routes', () => {
  it('keeps existing routes and retains UI Lab', () => {
    expect(appSource).toContain('path="/" element={<HomePage />}')
    expect(appSource).toContain('path="/pick" element={<PickPage />}')
    expect(appSource).toContain('path="/current-picks" element={<CurrentPicksPage />}')
    expect(appSource).toContain('path="/history" element={<HistoryPage />}')
    expect(appSource).toContain('path="/rules" element={<RulesPage />}')
    expect(appSource).toContain('path="/admin" element={<AdminPage />}')
    expect(appSource).toContain('path="/ui-lab" element={<UiLabPage />}')
    expect(uiLabSource).toContain('canAccessUiLab')
  })

  it('promotes Home to the player context layout', () => {
    expect(homeSource).toContain('PlayerHomePreview')
    expect(homeSource).toContain('live')
    expect(homeSource).not.toContain('saveSelection')
    expect(homePreview).toContain('player-context-anchor')
    expect(homePreview).toContain('TeamChip')
    expect(homeSource).not.toContain('EliminatedBanner')
    expect(shellSource).toContain("pathname !== '/'")
    expect(buildPlayerHomePreview({
      persona: 'live',
      gameNumber: 28,
      currentPot: 860,
      roundLabel: 'Round 3',
      deadlineAt: '2026-10-16T15:00:00.000Z',
      liveEntryStatus: 'active',
      gameStatus: 'open',
      hasCurrentPick: false,
      currentPickName: null,
      usedTeamIds: [],
      survivorCount: 22,
    }).nextAction).toBe('Make pick')
    expect(buildPlayerHomePreview({
      persona: 'live',
      gameNumber: 28,
      currentPot: 860,
      roundLabel: 'Round 3',
      deadlineAt: '2026-10-16T15:00:00.000Z',
      liveEntryStatus: 'active',
      gameStatus: 'open',
      hasCurrentPick: true,
      currentPickName: 'Brighton',
      usedTeamIds: ['bha'],
      survivorCount: 22,
    }).headline).toBe('Pick saved')
    expect(buildPlayerHomePreview({
      persona: 'eliminated',
      gameNumber: 28,
      currentPot: 860,
      roundLabel: 'Round 3',
      deadlineAt: '2026-10-16T15:00:00.000Z',
      liveEntryStatus: 'eliminated',
      gameStatus: 'open',
      hasCurrentPick: false,
      currentPickName: null,
      usedTeamIds: [],
      survivorCount: 22,
    }).ticker).toBe("Let's hope for a rollover")
    expect(buildPlayerHomePreview({
      persona: 'live',
      gameNumber: 28,
      currentPot: 860,
      roundLabel: 'Round 3',
      deadlineAt: '2026-10-16T15:00:00.000Z',
      liveEntryStatus: 'pending_payment',
      gameStatus: 'open',
      hasCurrentPick: false,
      currentPickName: null,
      usedTeamIds: [],
      survivorCount: 22,
      paid: false,
    }).statusLabel).toBe('Entry pending')
    expect(buildPlayerHomePreview({
      persona: 'complete',
      gameNumber: 27,
      currentPot: 2930,
      roundLabel: 'Round 8',
      deadlineAt: null,
      liveEntryStatus: 'winner',
      gameStatus: 'complete',
      hasCurrentPick: false,
      currentPickName: null,
      usedTeamIds: [],
      survivorCount: 1,
      winnerName: 'Arky Jr',
      prizeAmount: 2930,
      completionKind: 'winner_paid',
    }).pickStatus).toContain('Arky Jr')
    expect(buildPlayerHomePreview({
      persona: 'complete',
      gameNumber: 26,
      currentPot: 1200,
      roundLabel: 'Round 8',
      deadlineAt: null,
      liveEntryStatus: 'eliminated',
      gameStatus: 'rolled_over',
      hasCurrentPick: false,
      currentPickName: null,
      usedTeamIds: [],
      survivorCount: 0,
      prizeAmount: 1200,
      completionKind: 'rollover',
    }).subtext).toContain('rolls into the next game')
  })

  it('promotes Pick to shirt confirmation with the live save path', () => {
    expect(pickSource).toContain('PickPreview')
    expect(pickSource).toContain('saveSelection')
    expect(pickSource).toContain('isWindowLocked')
    expect(pickPreview).toContain('useState<string | null>(null)')
    expect(pickPreview).toContain('Save pick')
    expect(pickPreview).toContain('You are picking')
    expect(pickPreview).not.toContain('odds')
    expect(pickPreviewCanSubmit({ spectator: false, selectedTeamId: 'bha', operational: true, canPick: true })).toBe(true)
    expect(pickPreviewCanSubmit({ spectator: true, selectedTeamId: 'bha', operational: true, canPick: true })).toBe(false)
    expect(pickPreviewCanSubmit({ spectator: false, selectedTeamId: 'bha', operational: true, canPick: false })).toBe(false)
  })

  it('adds By player and By team without private data', () => {
    expect(picksSource).toContain('CurrentPicksPreview')
    expect(picksPreview).toContain('By player')
    expect(picksPreview).toContain('By team')
    expect(picksPreview).toContain('adminEntryLabel')
    expect(picksPreview).not.toContain('email')
    expect(picksPreview).not.toContain('phone')
  })

  it('uses history cards and keeps Game 27', () => {
    expect(historySource).toContain('HistoryPreview')
    expect(historyPreview).toContain('data-history-kind')
    expect(HISTORY_GAMES_1_TO_27.some((row) => row.game_number === 27)).toBe(true)
  })

  it('uses scannable rules with Friday 16:00 and Sat/Sun only', () => {
    expect(rulesSource).toContain('RulesPreview')
    const items = rulesPreviewSections().flatMap((section) => section.items)
    expect(items.some((item) => item.includes('16:00 on the Friday'))).toBe(true)
    expect(items.some((item) => item.includes('Saturday') && item.includes('Sunday'))).toBe(true)
    expect(items.join(' ')).not.toContain('11:30')
    expect(items.join(' ')).not.toContain('RPC')
    expect(items.join(' ')).not.toContain('snapshot')
    expect(rulesPreview).not.toContain('August')
  })

  it('uses the v2 dark royal-purple look without changing live actions', () => {
    expect(indexCss).toContain('#14081f')
    expect(indexCss).toContain('#d4ff00')
    expect(indexCss).toContain('#00e5a3')
    expect(indexCss).toContain('#1c0c2d')
    expect(homePreview).toContain('los-home-round')
    expect(homePreview).toContain('los-tint-gold')
    expect(pickSource).toContain('saveSelection')
    expect(adminSource).toContain('handleResolveRound')
  })

  it('uses a segmented admin cockpit with protected settlement and live actions', () => {
    expect(adminSource).toContain('ADMIN_PREVIEW_SECTIONS')
    expect(adminSource).toContain('admin-next-action')
    expect(adminSource).toContain('round-progression-gate')
    expect(adminSource).toContain('settlement-gate')
    expect(adminSource).toContain('AdminCorrectionsSection')
    expect(adminSource).toContain('AdminGameStatusSection')
    expect(adminSource).toContain('handleSyncLatestResults')
    expect(adminSource).toContain('handleResolveRound')
    expect(adminSource).toContain('handleOpenNextRound')
    expect(adminSource).toContain('handleCompleteGame')
    expect(adminSource).toContain('handleStartNewGame')
    expect(resultsSource).toContain('Sync latest results')
    expect(resultsSource).toContain('Resolve round')
    expect(resultsSource).toContain('Open next round')
    expect(correctionsSource).toContain('Reinstate player')
    expect(correctionsSource).toContain('Edit current round')
    expect(proxySource).toContain('LATE_PICK')
    expect(adminSource).toContain('You do not have admin access')
  })
})
