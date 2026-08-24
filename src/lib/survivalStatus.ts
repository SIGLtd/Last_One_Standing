import type { GameEntry, WindowPickRow } from '../types'
import { getTeamIdentity } from './teamIdentity'

export const ELIMINATED_BANNER_TITLE = '💀 Eliminated'
export const ELIMINATED_BANNER_BODY = 'You are out of this game, but you can still follow the picks.'
export const ELIMINATED_TICKER_TEXT = "Let's hope for a rollover"

export const HOME_SURVIVOR_PREVIEW_COUNT = 4

export type PlayerSurvivalStatus = 'unknown' | 'active' | 'eliminated' | 'other'

export type HomeSurvivorRow = {
  playerId: string
  displayName: string
  teamId: string
  teamName: string
}

export function playerSurvivalStatusFromEntry(
  entry: Pick<GameEntry, 'status'> | null | undefined,
  loaded: boolean,
): PlayerSurvivalStatus {
  if (!loaded) return 'unknown'
  if (!entry) return 'other'
  if (entry.status === 'eliminated') return 'eliminated'
  if (entry.status === 'active') return 'active'
  return 'other'
}

export function shouldShowEliminatedBanner(status: PlayerSurvivalStatus): boolean {
  return status === 'eliminated'
}

export function tickerShouldAnimate(prefersReducedMotion: boolean): boolean {
  return !prefersReducedMotion
}

export function shouldCollapseHomeSurvivorList(count: number): boolean {
  return count > HOME_SURVIVOR_PREVIEW_COUNT
}

export function buildHomeSurvivorRows(picks: WindowPickRow[]): HomeSurvivorRow[] {
  return picks
    .filter((row) => row.outcome === 'survived' && Boolean(row.team_id))
    .map((row) => ({
      playerId: row.player_id,
      displayName: row.display_name,
      teamId: row.team_id as string,
      teamName: getTeamIdentity(row.team_id).shortName,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export function homeSurvivorPreview(rows: HomeSurvivorRow[], expanded: boolean): HomeSurvivorRow[] {
  if (expanded || !shouldCollapseHomeSurvivorList(rows.length)) return rows
  return rows.slice(0, HOME_SURVIVOR_PREVIEW_COUNT)
}

export function survivalAuditGroupOpenByDefault(group: string, count: number): boolean {
  if (group === 'survived') return true
  if (group === 'eliminated') return count > 0 && count <= 8
  return false
}
