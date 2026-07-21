import { createServerOnlyFn } from '@tanstack/react-start'

import type { TripState } from '../../types/trip'
import { throwServerError } from '../../lib/errors/server-error'

export const mutateTripState = createServerOnlyFn(
  async <T>(
    updater: (state: TripState) => { state: TripState; result: T },
  ) => {
    try {
      const { requireUnlocked } = await import('../auth')
      const { readTripState, writeTripState } = await import('../tripStore')
      await requireUnlocked()
      const current = await readTripState()
      const { state, result } = updater(current)
      await writeTripState(state)
      return result
    } catch (error) {
      throwServerError(error)
    }
  },
)

export const readAuthorizedTripState = createServerOnlyFn(async () => {
  const { requireUnlocked } = await import('../auth')
  const { readTripState } = await import('../tripStore')
  await requireUnlocked()
  return readTripState()
})

