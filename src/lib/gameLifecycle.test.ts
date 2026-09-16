import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { SeasonFixture } from '../types'
import { HISTORY_GAMES_1_TO_27 } from '../config/history'
import { londonDayOfWeek } from '../../scripts/lib/fixtureValidation'
import {
  buildCarryForwardEntries,
  canOpenFirstRound,
  completeGameWarning,
  defaultOpeningPotForNewGame,
  defaultPrizePaid,
  defaultRolloverAmount,
  gameHasDetectedWinner,
  historyOutcomeNote,
  homeCompletionView,
  homeRolloverOpeningLabel,
  liveGameToHistoryRow,
  mergeHistoryWithLiveGames,
  nextGameNumber,
  rolloverSourceFields,
  sampleGame,
  selectCurrentGame,
  survivingEntries,
  validateCompleteGame,
} from './gameLifecycle'
import { shouldShowEliminatedBanner } from './survivalStatus'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..')
const migration14 = readFileSync(join(root, 'supabase', 'migrations', '14_game_completion_and_new_game.sql'), 'utf8')
const artefactPath = join(root, 'data', 'fixtures', '2026-27', 'fixtures.json')
const adminPageSource = readFileSync(join(__dirname, '..', 'pages', 'AdminPage.tsx'), 'utf8')
const statusSectionSource = readFileSync(join(__dirname, '..', 'components', 'admin', 'AdminGameStatusSection.tsx'), 'utf8')
const resultsSectionSource = readFileSync(join(__dirname, '..', 'components', 'admin', 'AdminRoundResultsSection.tsx'), 'utf8')
const homeSource = readFileSync(join(__dirname, '..', 'pages', 'HomePage.tsx'), 'utf8')
const historySource = readFileSync(join(__dirname, '..', 'pages', 'HistoryPage.tsx'), 'utf8')
const gameEntriesSource = readFileSync(join(__dirname, 'gameEntries.ts'), 'utf8')
const shellSource = readFileSync(join(__dirname, '..', 'components', 'AppShell.tsx'), 'utf8')

function loadSeasonFixtures(): SeasonFixture[] {
  const artefact = JSON.parse(readFileSync(artefactPath, 'utf8')) as {
    fixtures: Array<{
      canonical_key: string
      season: string
      home_team_id: string
      away_team_id: string
      kickoff_at: string
      original_kickoff_at: string
      source_fixture_id: string | null
    }>
  }
  return artefact.fixtures.map((row) => ({
    id: row.canonical_key,
    season: row.season,
    source_fixture_id: row.source_fixture_id,
    canonical_key: row.canonical_key,
    home_team_id: row.home_team_id,
    away_team_id: row.away_team_id,
    kickoff_at: row.kickoff_at,
    original_kickoff_at: row.original_kickoff_at,
    status: 'scheduled' as const,
    home_score: null,
    away_score: null,
    result_status: 'pending',
    source_name: 'premier_league_official',
    source_url: null,
    source_retrieved_at: null,
    eligibility_override: 'none' as const,
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
  }))
}

describe('game completion types', () => {
  it('completes a game as winner_paid with winner, final pot, and prize paid defaulting to the pot', () => {
    const result = validateCompleteGame({
      completionType: 'winner_paid',
      winnerPlayerId: 'arky',
      winnerIsSurvivor: true,
      nonSurvivorReason: '',
      finalPot: 2930,
      prizePaidAmount: defaultPrizePaid(2930),
      rolloverAmount: 0,
      notes: 'Winner took the money.',
      currentPot: 2930,
      gameStatus: 'in_progress',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.winnerPlayerId).toBe('arky')
    expect(result.value.finalPot).toBe(2930)
    expect(result.value.prizePaidAmount).toBe(2930)
    expect(result.value.rolloverAmount).toBe(0)
  })

  it('requires a winner for winner_paid', () => {
    const result = validateCompleteGame({
      completionType: 'winner_paid',
      winnerPlayerId: null,
      winnerIsSurvivor: false,
      nonSurvivorReason: '',
      finalPot: 2930,
      prizePaidAmount: 2930,
      rolloverAmount: 0,
      notes: '',
      currentPot: 2930,
      gameStatus: 'open',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('requires a winner')
  })

  it('completes a game as rollover without a winner and defaults the amount to the current pot', () => {
    expect(defaultRolloverAmount(2930)).toBe(2930)
    const result = validateCompleteGame({
      completionType: 'rollover',
      winnerPlayerId: null,
      winnerIsSurvivor: false,
      nonSurvivorReason: '',
      finalPot: 2930,
      prizePaidAmount: 0,
      rolloverAmount: defaultRolloverAmount(2930),
      notes: 'Nobody won the money.',
      currentPot: 2930,
      gameStatus: 'in_progress',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.winnerPlayerId).toBeNull()
    expect(result.value.rolloverAmount).toBe(2930)
    expect(result.value.prizePaidAmount).toBe(0)
  })

  it('does not imply a winner for rollover', () => {
    const row = liveGameToHistoryRow(
      sampleGame({
        status: 'rolled_over',
        result_type: 'rollover',
        rollover_amount: 2930,
        winner_display_name: 'Should not show',
      }),
      [],
    )
    expect(row.result_type).toBe('rollover')
    expect(row.winner_name).toBeNull()
    expect(historyOutcomeNote(row)).toContain('Rollover:')
    expect(historyOutcomeNote(row)).not.toContain('Winner:')
  })

  it('blocks a second completion', () => {
    const result = validateCompleteGame({
      completionType: 'winner_paid',
      winnerPlayerId: 'arky',
      winnerIsSurvivor: true,
      nonSurvivorReason: '',
      finalPot: 2930,
      prizePaidAmount: 2930,
      rolloverAmount: 0,
      notes: '',
      currentPot: 2930,
      gameStatus: 'complete',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('already complete')
  })

  it('rejects winner-paid with a rollover amount', () => {
    const result = validateCompleteGame({
      completionType: 'winner_paid',
      winnerPlayerId: 'arky',
      winnerIsSurvivor: true,
      nonSurvivorReason: '',
      finalPot: 2930,
      prizePaidAmount: 2930,
      rolloverAmount: 100,
      notes: '',
      currentPot: 2930,
      gameStatus: 'open',
    })
    expect(result.ok).toBe(false)
  })
})

describe('start new game defaults', () => {
  it('starts the next game number after completion', () => {
    expect(nextGameNumber(27)).toBe(28)
  })

  it('uses a clean £0 opening pot after winner paid', () => {
    const previous = sampleGame({ status: 'complete', result_type: 'winner_paid', prize_paid_amount: 2930 })
    expect(defaultOpeningPotForNewGame(previous)).toBe(0)
    expect(rolloverSourceFields(previous).rolled_from_game_id).toBeNull()
  })

  it('carries the rollover pot into the next game', () => {
    const previous = sampleGame({ status: 'rolled_over', result_type: 'rollover', rollover_amount: 1800 })
    expect(defaultOpeningPotForNewGame(previous)).toBe(1800)
    expect(rolloverSourceFields(previous)).toEqual({ rolled_from_game_id: 'g27', rolled_from_game_number: 27 })
  })

  it('creates clean pending entries and does not copy eliminated status', () => {
    const entries = buildCarryForwardEntries(
      [
        { player_id: 'p1', status: 'eliminated' },
        { player_id: 'p2', status: 'winner' },
        { player_id: 'p1', status: 'eliminated' },
      ],
      10,
    )
    expect(entries).toHaveLength(2)
    expect(entries.every((entry) => entry.status === 'pending_payment')).toBe(true)
    expect(entries.every((entry) => entry.paid === false)).toBe(true)
    expect(entries.every((entry) => entry.eliminated_reason === null)).toBe(true)
  })

  it('selects the live open game over a completed previous game', () => {
    const g27 = sampleGame({ id: 'g27', game_number: 27, status: 'complete', result_type: 'winner_paid' })
    const g28 = sampleGame({ id: 'g28', game_number: 28, status: 'open', current_pot: 0, opening_pot: 0 })
    expect(selectCurrentGame([g27, g28])?.id).toBe('g28')
    expect(selectCurrentGame([g27])?.id).toBe('g27')
  })
})

describe('fixture and first-round creation', () => {
  it('opens new-game Round 1 on a Saturday/Sunday weekend and excludes Friday/Monday', () => {
    const check = canOpenFirstRound({
      gameStatus: 'open',
      windows: [],
      fixtures: loadSeasonFixtures(),
      afterLondonDate: '2026-08-23',
    })
    expect(check.canOpen).toBe(true)
    expect(check.weekend?.sat).toBe('2026-08-29')
    expect(check.weekend?.eligible.every((fixture) => [6, 7].includes(londonDayOfWeek(fixture.kickoff_at)))).toBe(true)
    expect(check.weekend?.eligible.some((fixture) => fixture.home_team_id === 'cry')).toBe(false)
    expect(check.weekend?.fridayExcluded).toBeGreaterThanOrEqual(1)
    expect(check.weekend?.mondayExcluded).toBeGreaterThanOrEqual(1)
  })

  it('blocks a zero-fixture first-round snapshot', () => {
    const check = canOpenFirstRound({
      gameStatus: 'open',
      windows: [],
      fixtures: [],
      afterLondonDate: '2026-08-23',
    })
    expect(check.canOpen).toBe(false)
    expect(check.weekend).toBeNull()
  })

  it('keeps new-game Round 1 distinct from old-game windows', () => {
    const check = canOpenFirstRound({
      gameStatus: 'open',
      windows: [],
      fixtures: loadSeasonFixtures(),
      afterLondonDate: '2026-08-23',
    })
    expect(check.canOpen).toBe(true)
    expect(migration14).toContain('p_game_id uuid')
    expect(migration14).toContain('window_number')
    expect(migration14).toMatch(/values \(\s*v_game\.id,\s*2,/s)
    const oldGameWindows = canOpenFirstRound({
      gameStatus: 'open',
      windows: [{ window_number: 4, status: 'resolved', eligible_sat_date: '2026-09-05', eligible_sun_date: '2026-09-06' }],
      fixtures: loadSeasonFixtures(),
      afterLondonDate: '2026-09-06',
    })
    expect(oldGameWindows.canOpen).toBe(false)
    expect(oldGameWindows.alreadyOpen).toBe(true)
  })
})

describe('public and admin UI copy', () => {
  it('shows Winner paid vs Rollover and Complete game when a winner exists', () => {
    expect(statusSectionSource).toContain('Winner paid')
    expect(statusSectionSource).toContain('Rollover')
    expect(statusSectionSource).toContain('Complete Game')
    expect(statusSectionSource).toContain('Start new game')
    expect(statusSectionSource).toContain('Open next round')
    expect(statusSectionSource).toContain('Start new game')
    expect(gameHasDetectedWinner(1)).toBe(true)
    expect(completeGameWarning(27)).toContain('preserve all picks')
    expect(adminPageSource).toContain('AdminGameStatusSection')
    expect(resultsSectionSource).toContain('This game has a winner. Complete the game before starting a new one.')
  })

  it('displays winner-paid and rollover completion on Home and History', () => {
    const winnerPaid = homeCompletionView(
      sampleGame({
        status: 'complete',
        result_type: 'winner_paid',
        winner_display_name: 'Arky Jr',
        prize_paid_amount: 2930,
      }),
    )
    expect(winnerPaid?.title).toBe('Game 27 complete')
    expect(winnerPaid?.winnerLine).toBe('Winner: Arky Jr')
    expect(winnerPaid?.amountLine).toContain('Prize paid:')
    const rollover = homeCompletionView(sampleGame({ status: 'rolled_over', result_type: 'rollover', rollover_amount: 1800 }))
    expect(rollover?.winnerLine).toBe('No winner — pot rolls over')
    expect(rollover?.amountLine).toContain('Rollover pot:')
    const historyWinner = liveGameToHistoryRow(
      sampleGame({ status: 'complete', result_type: 'winner_paid', winner_display_name: 'Arky Jr', prize_paid_amount: 2930 }),
      [],
    )
    expect(historyOutcomeNote(historyWinner)).toContain('Prize paid:')
    const next = sampleGame({
      id: 'g28',
      game_number: 28,
      status: 'open',
      previous_game_id: 'g27',
      rolled_from_game_id: 'g27',
      rolled_from_game_number: 27,
      opening_pot: 1800,
    })
    const historyRollover = liveGameToHistoryRow(
      sampleGame({ status: 'rolled_over', result_type: 'rollover', rollover_amount: 1800 }),
      [next],
    )
    expect(historyOutcomeNote(historyRollover)).toBe('Rollover: £1,800.00 carried into Game 28')
    expect(homeRolloverOpeningLabel(next)).toContain('rollover from Game 27')
    expect(homeRolloverOpeningLabel(sampleGame({ opening_pot: 0, rolled_from_game_id: null }))).toBeNull()
    expect(homeSource).toContain('homeCompletionView')
    expect(historySource).toContain('historyOutcomeNote')
  })

  it('does not leak old eliminated status into a new game', () => {
    expect(shouldShowEliminatedBanner('eliminated', { status: 'complete' })).toBe(false)
    expect(shouldShowEliminatedBanner('eliminated', { status: 'open' })).toBe(true)
    expect(survivingEntries([{ player_id: 'p1', paid: false, status: 'pending_payment' }])).toEqual([])
    expect(shellSource).toContain('shouldShowEliminatedBanner(survivalStatus, game)')
    expect(homeSource).toContain('gameFinished')
  })
})

describe('history overlay', () => {
  it('keeps Game 27 history and overlays live completion without wiping earlier games', () => {
    const live = sampleGame({
      status: 'complete',
      result_type: 'winner_paid',
      winner_display_name: 'Arky Jr',
      prize_paid_amount: 2930,
      current_pot: 2930,
    })
    const merged = mergeHistoryWithLiveGames(HISTORY_GAMES_1_TO_27, [live])
    expect(merged.find((row) => row.game_number === 1)?.winner_name).toBe('Virge')
    expect(merged.find((row) => row.game_number === 27)?.winner_name).toBe('Arky Jr')
    expect(merged.find((row) => row.game_number === 27)?.result_type).toBe('winner')
  })
})

describe('backend RPC security', () => {
  it('keeps complete and start-new-game admin-only, idempotent, and non-destructive', () => {
    expect(migration14).toContain('admin_complete_game')
    expect(migration14).toContain('admin_start_new_game')
    expect(migration14).toContain('admin_open_first_round')
    expect(migration14).toContain("if not public.is_admin() then")
    expect(migration14).toContain('ADMIN_REQUIRED')
    expect(migration14).toContain('GAME_ALREADY_COMPLETE')
    expect(migration14).toContain('already_complete')
    expect(migration14).toContain('already_exists')
    expect(migration14).toContain('WINNER_REQUIRED')
    expect(migration14).toContain('WINNER_NOT_SURVIVOR')
    expect(migration14).toContain('WINNER_PAID_CANNOT_HAVE_ROLLOVER')
    expect(migration14).toContain('ROLLOVER_CANNOT_HAVE_WINNER')
    expect(migration14).toContain('GAME_HAS_WINNER')
    expect(migration14).toContain('GAME_COMPLETE')
    expect(migration14).toContain('DUPLICATE_OPEN_GAME')
    expect(migration14).toContain('PREVIOUS_GAME_NOT_COMPLETE')
    expect(migration14).toContain('window_number')
    expect(migration14).toContain('NO_ELIGIBLE_FIXTURES')
    expect(migration14).toContain('NON_WEEKEND_FIXTURES')
    expect(migration14).not.toMatch(/delete from selections/i)
    expect(migration14).not.toMatch(/delete from games/i)
    expect(migration14).not.toMatch(/delete from game_entries/i)
    expect(gameEntriesSource).toContain("rpc('admin_complete_game'")
    expect(gameEntriesSource).toContain("rpc('admin_start_new_game'")
    expect(gameEntriesSource).toContain('selectCurrentGame')
    expect(gameEntriesSource).not.toContain("eq('game_number', CURRENT_GAME)")
  })
})
