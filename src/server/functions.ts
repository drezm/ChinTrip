import { createServerFn } from '@tanstack/react-start'

import {
  calculateBalances,
  calculateSettlements,
} from '../lib/money'
import { throwServerError } from '../lib/errors/server-error'
import {
  parseWithSchema,
  updateTripSettingsSchema,
} from './validation/schemas'

export { lockTrip } from './sessionActions'
export {
  assignPlaceToDay,
  changePlaceStatus,
  createChecklist,
  createChecklistItem,
  createDay,
  createDayItem,
  createExpense,
  createHotel,
  createPayment,
  createPlace,
  createPlaceSection,
  createTicket,
  deleteChecklist,
  deleteChecklistItem,
  deleteDay,
  deleteDayItem,
  deleteExpense,
  deleteHotel,
  deletePayment,
  deletePlace,
  deletePlaceSection,
  deleteTicket,
  markPaymentAsCompleted,
  moveDayItemToAnotherDay,
  reorderChecklistItems,
  reorderDayItems,
  toggleChecklistItem,
  updateChecklist,
  updateChecklistItem,
  updateDay,
  updateDayItem,
  updateExpense,
  updateHotel,
  updatePayment,
  updatePlace,
  updatePlaceSection,
  updateTicket,
  updateTripSettings,
} from './actions/entityActions'

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

export const getTripState = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { readAuthorizedTripState } = await import('./repositories/stateMutation')
    return readAuthorizedTripState()
  },
)

export const getBalances = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { readAuthorizedTripState } = await import('./repositories/stateMutation')
    const state = await readAuthorizedTripState()
    const balances = calculateBalances(
      state.travelers,
      state.expenses,
      state.expenseSplits,
      state.payments,
    )

    return {
      balances,
      settlements: calculateSettlements(balances),
    }
  },
)

export const refreshExchangeRate = createServerFn({ method: 'POST' }).handler(
  async () => {
    try {
      const rate = await fetchCnyToRubRate()
      const { mutateTripState } = await import('./repositories/stateMutation')
      return mutateTripState((state) => {
        const input = parseWithSchema(updateTripSettingsSchema, {
          cnyToRubRate: rate,
        })
        return {
          state: {
            ...state,
            settings: {
              ...state.settings,
              ...input,
              rateUpdatedAt: new Date().toISOString(),
            },
          },
          result: {
            ...state.settings,
            ...input,
            rateUpdatedAt: new Date().toISOString(),
          },
        }
      })
    } catch (error) {
      throwServerError(error)
    }
  },
)

export const refreshRate = refreshExchangeRate

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
      // Try the next no-key provider before using the cached rate.
    }
  }

  throw new Error('Не удалось обновить курс CNY/RUB')
}
