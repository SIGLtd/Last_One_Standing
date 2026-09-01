export type PickErrorCode =
  | 'ENTRY_INACTIVE'
  | 'NO_ACTIVE_WINDOW'
  | 'DEADLINE_PASSED'
  | 'WINDOW_LOCKED'
  | 'TEAM_NOT_ELIGIBLE'
  | 'TEAM_ALREADY_USED'
  | 'FIXTURE_STARTED'
  | 'PLAYER_NOT_FOUND'
  | 'LATE_REASON_REQUIRED'
  | 'ROUND_ALREADY_RESOLVED'
  | 'CORRECTION_NOT_CONFIRMED'
  | 'RESULT_NOT_FINAL'
  | 'WINDOW_HAS_PICKS_ON_INVALID'

export function parsePickError(message: string): PickErrorCode | string {
  const codes: PickErrorCode[] = [
    'ENTRY_INACTIVE',
    'NO_ACTIVE_WINDOW',
    'DEADLINE_PASSED',
    'WINDOW_LOCKED',
    'TEAM_NOT_ELIGIBLE',
    'TEAM_ALREADY_USED',
    'FIXTURE_STARTED',
    'PLAYER_NOT_FOUND',
    'LATE_REASON_REQUIRED',
    'ROUND_ALREADY_RESOLVED',
    'CORRECTION_NOT_CONFIRMED',
    'RESULT_NOT_FINAL',
    'WINDOW_HAS_PICKS_ON_INVALID',
  ]
  return codes.find((code) => message.includes(code)) ?? message
}

export function pickErrorLabel(code: PickErrorCode | string): string {
  switch (code) {
    case 'ENTRY_INACTIVE':
      return 'Verified active entry required.'
    case 'NO_ACTIVE_WINDOW':
      return 'No open selection window is available.'
    case 'DEADLINE_PASSED':
      return 'The selection deadline has passed.'
    case 'WINDOW_LOCKED':
      return 'This selection window is locked.'
    case 'TEAM_NOT_ELIGIBLE':
      return 'That team is not eligible in this window.'
    case 'TEAM_ALREADY_USED':
      return 'You have already used that team in a previous round.'
    case 'FIXTURE_STARTED':
      return 'That fixture has already kicked off.'
    case 'PLAYER_NOT_FOUND':
      return 'Player profile not found.'
    case 'LATE_REASON_REQUIRED':
      return 'A reason is required for a post-deadline admin override.'
    case 'ROUND_ALREADY_RESOLVED':
      return 'This round has already been resolved. Reopen/correction workflow required.'
    case 'CORRECTION_NOT_CONFIRMED':
      return 'Confirm that this is an organiser-approved exception.'
    case 'RESULT_NOT_FINAL':
      return 'The selected fixture does not yet have a stored final score.'
    case 'WINDOW_HAS_PICKS_ON_INVALID':
      return 'This round already has picks on the invalid Friday/Monday fixture. The snapshot was not changed.'
    default:
      return code
  }
}
