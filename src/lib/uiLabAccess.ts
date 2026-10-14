export const UI_LAB_PATH = '/ui-lab'
export const UI_LAB_LINK_LABEL = 'UI Lab'

export type UiLabAccess = 'loading' | 'guest' | 'forbidden' | 'allowed'

export function canAccessUiLab(input: {
  authLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
}): UiLabAccess {
  if (input.authLoading) return 'loading'
  if (!input.isAuthenticated) return 'guest'
  if (!input.isAdmin) return 'forbidden'
  return 'allowed'
}

export function uiLabBlockedCopy(access: UiLabAccess): string | null {
  if (access === 'guest') return 'Log in with an admin account to view the UI Lab.'
  if (access === 'forbidden') return 'The UI Lab is only available to Admin users.'
  return null
}
