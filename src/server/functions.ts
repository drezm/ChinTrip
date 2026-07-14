import { createServerFn } from '@tanstack/react-start'

import {
  calculateBalances,
  calculateSettlements,
} from '../lib/balances'
import type { TripState } from '../lib/types'

export const getSessionStatus = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { isUnlocked } = await import('./auth')
    return { unlocked: await isUnlocked() }
  },
)

export const unlockTrip = createServerFn({ method: 'POST' })
  .validator((pin: string) => pin)
  .handler(async ({ data }) => {
    const { isPinValid, unlockSession } = await import('./auth')
    if (!isPinValid(data.trim())) return { ok: false }
    await unlockSession()
    return { ok: true }
  })

export const lockTrip = createServerFn({ method: 'POST' }).handler(async () => {
  const { lockSession } = await import('./auth')
  await lockSession()
  return { ok: true }
})

export const getTripState = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { requireUnlocked } = await import('./auth')
    const { readTripState } = await import('./tripStore')
    await requireUnlocked()
    return readTripState()
  },
)

export const saveTripState = createServerFn({ method: 'POST' })
  .validator((state: TripState) => state)
  .handler(async ({ data }) => {
    const { requireUnlocked } = await import('./auth')
    const { writeTripState } = await import('./tripStore')
    await requireUnlocked()
    return writeTripState(data)
  })

export const getBalances = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { requireUnlocked } = await import('./auth')
    const { readTripState } = await import('./tripStore')
    await requireUnlocked()
    const state = await readTripState()
    const balances = calculateBalances(
      state.travelers,
      state.expenses,
      state.expenseShares,
      state.settings.cnyToRubRate,
    )

    return {
      balances,
      settlements: calculateSettlements(balances),
    }
  },
)

export const refreshRate = createServerFn({ method: 'POST' }).handler(
  async () => {
    const { requireUnlocked } = await import('./auth')
    const { readTripState, writeTripState } = await import('./tripStore')
    await requireUnlocked()

    const rate = await fetchCnyToRubRate()
    const state = await readTripState()
    const next: TripState = {
      ...state,
      settings: {
        ...state.settings,
        cnyToRubRate: rate,
        rateUpdatedAt: new Date().toISOString(),
      },
    }

    return writeTripState(next)
  },
)

async function fetchCnyToRubRate() {
  const attempts = [
    async () => {
      const response = await fetch('https://open.er-api.com/v6/latest/CNY')
      if (!response.ok) throw new Error('open.er-api request failed')
      const payload = (await response.json()) as {
        rates?: Record<string, number>
      }
      const rate = payload.rates?.RUB
      if (!rate) throw new Error('open.er-api response had no RUB rate')
      return rate
    },
    async () => {
      const response = await fetch(
        'https://api.frankfurter.app/latest?from=CNY&to=RUB',
      )
      if (!response.ok) throw new Error('frankfurter request failed')
      const payload = (await response.json()) as {
        rates?: Record<string, number>
      }
      const rate = payload.rates?.RUB
      if (!rate) throw new Error('frankfurter response had no RUB rate')
      return rate
    },
  ]

  for (const attempt of attempts) {
    try {
      return await attempt()
    } catch {
      // Try the next no-key provider before surfacing the failure.
    }
  }

  throw new Error('Не удалось обновить курс CNY/RUB')
}
