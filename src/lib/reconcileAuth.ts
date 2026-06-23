export type ReconcileCaller =
  | { kind: 'admin'; userId: string; playerId: string }
  | { kind: 'scheduler' }
  | { kind: 'unauthorized'; reason: string }

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

export function resolveReconcileCaller(input: {
  authorizationHeader: string | null
  schedulerHeader: string | null
  schedulerSecret: string | null
  isAdminPlayer: boolean
  authUserId: string | null
  playerId: string | null
}): ReconcileCaller {
  const configuredSecret = input.schedulerSecret?.trim() ?? ''
  const providedSecret = input.schedulerHeader?.trim() ?? ''

  if (configuredSecret && providedSecret && timingSafeEqual(configuredSecret, providedSecret)) {
    return { kind: 'scheduler' }
  }

  if (providedSecret && (!configuredSecret || !timingSafeEqual(configuredSecret, providedSecret))) {
    return { kind: 'unauthorized', reason: 'INVALID_SCHEDULER_SECRET' }
  }

  if (!input.authorizationHeader?.startsWith('Bearer ')) {
    return { kind: 'unauthorized', reason: 'UNAUTHORIZED' }
  }

  if (!input.authUserId || !input.playerId) {
    return { kind: 'unauthorized', reason: 'UNAUTHORIZED' }
  }

  if (!input.isAdminPlayer) {
    return { kind: 'unauthorized', reason: 'ADMIN_REQUIRED' }
  }

  return { kind: 'admin', userId: input.authUserId, playerId: input.playerId }
}

/** London-hour guard for scheduled scans. Returns false when the job should no-op. */
export function shouldExecuteScheduledScan(
  londonHour: number,
  londonMinute: number,
  schedule: 'monday' | 'friday' | 'saturday_early',
): boolean {
  switch (schedule) {
    case 'monday':
    case 'friday':
      return londonHour === 9 && londonMinute < 15
    case 'saturday_early':
      return londonHour === 6 && londonMinute < 15
  }
}
