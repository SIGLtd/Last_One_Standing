export type PickErrorCode =
  | 'ENTRY_INACTIVE'
  | 'NO_ACTIVE_WINDOW'
  | 'DEADLINE_PASSED'
  | 'WINDOW_LOCKED'
  | 'TEAM_NOT_ELIGIBLE'
  | 'TEAM_ALREADY_USED'
  | 'FIXTURE_STARTED'
  | 'PLAYER_NOT_FOUND'

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
      return 'You have already used that team in a locked window.'
    case 'FIXTURE_STARTED':
      return 'That fixture has already kicked off.'
    case 'PLAYER_NOT_FOUND':
      return 'Player profile not found.'
    default:
      return code
  }
}
