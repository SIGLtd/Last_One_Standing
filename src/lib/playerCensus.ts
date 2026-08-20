import type { GameEntryWithPlayer, Player } from '../types'

export type PlayerCensus = {
  registered: number
  activeEntrants: number
  paidVerified: number
  awaitingPayment: number
  awaitingVerification: number
  inactive: number
  adminBuildOnly: number
  manualOffline: number
}

function hasActiveEntry(entry: GameEntryWithPlayer | undefined): boolean {
  return entry?.status === 'active'
}

function isPaidVerified(entry: GameEntryWithPlayer | undefined): boolean {
  return Boolean(entry?.paid && entry.status === 'active')
}

export function buildPlayerCensus(players: Player[], entries: GameEntryWithPlayer[]): PlayerCensus {
  const entryByPlayer = new Map(entries.map((entry) => [entry.player_id, entry]))

  let activeEntrants = 0
  let paidVerified = 0
  let awaitingPayment = 0
  let awaitingVerification = 0
  let inactive = 0
  let adminBuildOnly = 0
  let manualOffline = 0

  for (const player of players) {
    const entry = entryByPlayer.get(player.id)
    const active = hasActiveEntry(entry)
    const paidActive = isPaidVerified(entry)

    if (player.is_manual) manualOffline += 1

    if (player.is_admin && !paidActive) {
      adminBuildOnly += 1
    }

    if (paidActive) paidVerified += 1
    if (active) activeEntrants += 1

    if (entry?.payment_claimed && !entry.paid) awaitingVerification += 1
    else if (entry && !entry.paid && !entry.payment_claimed) awaitingPayment += 1

    if (!active) inactive += 1
  }

  return {
    registered: players.length,
    activeEntrants,
    paidVerified,
    awaitingPayment,
    awaitingVerification,
    inactive,
    adminBuildOnly,
    manualOffline,
  }
}

export function describeRegisteredVsActive(census: PlayerCensus): string {
  const extra = census.registered - census.activeEntrants
  if (extra <= 0) {
    return 'Registered and active counts match.'
  }

  const reasons: string[] = []
  if (census.adminBuildOnly > 0) reasons.push(`${census.adminBuildOnly} admin/build-only`)
  if (census.manualOffline > 0) reasons.push(`${census.manualOffline} manual/offline`)
  if (census.awaitingPayment > 0) reasons.push(`${census.awaitingPayment} awaiting payment`)
  if (census.awaitingVerification > 0) reasons.push(`${census.awaitingVerification} awaiting verification`)
  const leftover = extra
  const detail = reasons.length > 0 ? reasons.join(', ') : `${leftover} registered player(s) are not live entrants`
  return `Registered is ${extra} higher than active because ${detail}.`
}
