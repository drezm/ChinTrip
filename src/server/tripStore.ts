import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { createSeedTripState } from '../lib/seed'
import type { TripState } from '../lib/types'

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

  return {
    travelers: state.travelers ?? seed.travelers,
    places: state.places ?? seed.places,
    hotels: state.hotels ?? seed.hotels,
    tickets: state.tickets ?? seed.tickets,
    days: state.days ?? seed.days,
    dayItems: state.dayItems ?? seed.dayItems,
    expenses: state.expenses ?? seed.expenses,
    expenseShares: state.expenseShares ?? seed.expenseShares,
    checklists: state.checklists ?? seed.checklists,
    checklistItems: state.checklistItems ?? seed.checklistItems,
    settings: {
      ...seed.settings,
      ...(state.settings ?? {}),
    },
  }
}
