/**
 * Pure helpers for material fixture change policy.
 * Approved open-window snapshots are immutable; master changes create alerts only.
 */

export type SnapshotRow = {
  kickoff_at: string
  home_team_id: string
  away_team_id: string
  fixture_status: string
}

export function snapshotDiffersFromMaster(
  snapshot: SnapshotRow,
  master: { kickoff_at: string; status: string },
): boolean {
  return snapshot.kickoff_at !== master.kickoff_at || snapshot.fixture_status !== master.status
}

export function applyMasterChangeToOpenSnapshot(
  snapshot: SnapshotRow,
  _master: { kickoff_at: string; status: string },
): SnapshotRow {
  // Policy: never mutate approved open snapshots automatically.
  return { ...snapshot }
}
