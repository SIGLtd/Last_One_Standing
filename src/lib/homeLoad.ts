export const AUTH_RESTORE_TIMEOUT_MS = 4000
export const ESSENTIAL_FETCH_TIMEOUT_MS = 10000

export const PLAYER_LOAD_ERROR = 'Could not load the current round. Check your connection and try again.'

export function withTimeout<T>(promise: Promise<T>, ms: number, message = PLAYER_LOAD_ERROR): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      reject(new Error(message))
    }, ms)

    promise.then(
      (value) => {
        globalThis.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        globalThis.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export type HomeViewState = {
  authLoading: boolean
  roundLoading: boolean
  roundFailed: boolean
  hasRoundData: boolean
  playerLoading: boolean
  distributionLoading: boolean
  distributionFailed: boolean
}

export function shouldRenderPickShell(state: Pick<HomeViewState, 'roundLoading' | 'roundFailed' | 'hasRoundData'>): boolean {
  return !state.roundLoading && (state.hasRoundData || state.roundFailed)
}

export function guestHomeWaitsForPlayerProfile(): boolean {
  return false
}

export function distributionFailureBlocksPickUi(_state?: HomeViewState): boolean {
  return false
}

export function essentialFailureShowsRetry(state: HomeViewState): boolean {
  return state.roundFailed && !state.roundLoading
}

export function authAndHomeLoadingAreSeparate(state: HomeViewState): boolean {
  return shouldRenderPickShell(state) && state.authLoading
}

export function playerFacingLoadError(_technical?: unknown): string {
  return PLAYER_LOAD_ERROR
}
