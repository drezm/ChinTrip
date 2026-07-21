import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { createSeedTripState } from '../lib/seed'
import { calculateAmountCny, createExpenseSplits } from '../lib/money'
import type { Expense, ExpenseShare, TripState } from '../lib/types'

const DATA_FILE = join(process.cwd(), 'data', 'trip-db.json')

export async function readTripState(): Promise<TripState> {
  const postgres = await import('./postgresStore')
  if (postgres.hasDatabaseUrl()) {
    return postgres.readTripStateFromPostgres()
  }

  try {
    const raw = await readFile(DATA_FILE, 'utf8')
    return normalizeTripState(JSON.parse(raw) as Partial<TripState>)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    const seed = createSeedTripState()
    await writeTripState(seed)
    return seed
  }
}

export async function writeTripState(state: TripState) {
  const postgres = await import('./postgresStore')
  if (postgres.hasDatabaseUrl()) {
    return postgres.writeTripStateToPostgres(normalizeTripState(state))
  }

  const normalized = normalizeTripState(state)
  await mkdir(dirname(DATA_FILE), { recursive: true })
  await writeFile(DATA_FILE, JSON.stringify(normalized, null, 2), 'utf8')
  return normalized
}

function normalizeTripState(state: Partial<TripState>): TripState {
  const seed = createSeedTripState()
  const settings = {
    ...seed.settings,
    ...(state.settings ?? {}),
  }
  const expenses = normalizeExpenses(
    state.expenses ?? seed.expenses,
    settings.cnyToRubRate,
    state.travelers ?? seed.travelers,
  )
  const expenseShares = state.expenseShares ?? seed.expenseShares
  const expenseSplits =
    state.expenseSplits && state.expenseSplits.length
      ? state.expenseSplits
      : migrateExpenseShares(expenses, expenseShares)

  return {
    travelers: state.travelers ?? seed.travelers,
    placeSections: mergePlaceSections(
      state.placeSections ?? seed.placeSections,
      (state.places ?? seed.places).map((place) => place.category),
    ),
    places: state.places ?? seed.places,
    hotels: state.hotels ?? seed.hotels,
    tickets: state.tickets ?? seed.tickets,
    days: state.days ?? seed.days,
    dayItems: state.dayItems ?? seed.dayItems,
    expenses,
    expenseShares,
    expenseSplits,
    payments: state.payments ?? seed.payments,
    checklists: state.checklists ?? seed.checklists,
    checklistItems: state.checklistItems ?? seed.checklistItems,
    settings,
  }
}

function mergePlaceSections(
  sections: TripState['placeSections'],
  categories: string[],
) {
  const result = [...sections]
  const knownIds = new Set(result.map((section) => section.id))
  let nextOrder = result.length
    ? Math.max(...result.map((section) => section.sortOrder)) + 10
    : 10

  for (const category of categories) {
    if (!category || knownIds.has(category)) continue
    result.push({
      id: category,
      title: category,
      sortOrder: nextOrder,
    })
    knownIds.add(category)
    nextOrder += 10
  }

  return result.sort((left, right) => left.sortOrder - right.sortOrder)
}

function normalizeExpenses(
  expenses: TripState['expenses'],
  cnyToRubRate: number,
  travelers: TripState['travelers'],
) {
  const fallbackTravelerId = travelers[0]?.id ?? 'traveler-a'

  return expenses.map((expense) => {
    const legacyExpense = expense as Partial<Expense>
    const exchangeRate = positiveNumber(legacyExpense.exchangeRate, cnyToRubRate)
    const amountCny =
      positiveNumber(legacyExpense.amountCny, 0) ||
      calculateAmountCny(expense.amount, expense.currency, exchangeRate)
    const createdAt = legacyExpense.createdAt ?? new Date().toISOString()

    return {
      ...expense,
      exchangeRate,
      amountCny,
      splitType: legacyExpense.splitType ?? 'equal',
      createdBy: legacyExpense.createdBy ?? expense.payerId ?? fallbackTravelerId,
      createdAt,
      updatedAt: legacyExpense.updatedAt ?? createdAt,
    }
  })
}

function migrateExpenseShares(expenses: TripState['expenses'], shares: ExpenseShare[]) {
  return expenses.flatMap((expense) => {
    const participantIds = shares
      .filter((share) => share.expenseId === expense.id)
      .map((share) => share.travelerId)

    if (!participantIds.length) return []

    return createExpenseSplits({
      expenseId: expense.id,
      amountCny: expense.amountCny,
      splitType: 'equal',
      participants: participantIds.map((travelerId) => ({ travelerId })),
    })
  })
}

function positiveNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback
}
