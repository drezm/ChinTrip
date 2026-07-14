import pg from 'pg'

import { createSeedTripState } from '../lib/seed'
import type {
  ChecklistKind,
  Currency,
  DayItemKind,
  PlaceCategory,
  PlaceStatus,
  TicketKind,
  TravelerId,
  TripState,
} from '../lib/types'

const { Pool } = pg

let pool: pg.Pool | undefined

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL)
}

export async function readTripStateFromPostgres(): Promise<TripState> {
  const client = await getPool().connect()

  try {
    const [
      travelers,
      places,
      hotels,
      tickets,
      days,
      dayItems,
      expenses,
      expenseShares,
      checklists,
      checklistItems,
      settings,
    ] = await Promise.all([
      client.query('select * from travelers order by sort_order asc'),
      client.query('select * from places order by created_at desc, name asc'),
      client.query('select * from hotels order by check_in asc, name asc'),
      client.query('select * from tickets order by depart_at asc, from_city asc'),
      client.query('select * from days order by date asc'),
      client.query('select * from day_items order by day_id asc, sort_order asc'),
      client.query('select * from expenses order by spent_at desc, created_at desc'),
      client.query('select * from expense_shares order by expense_id asc'),
      client.query('select * from checklists order by title asc'),
      client.query(
        'select * from checklist_items order by checklist_id asc, sort_order asc',
      ),
      client.query('select * from settings where id = 1'),
    ])

    if (days.rowCount === 0) {
      const seed = createSeedTripState()
      await writeTripStateToPostgres(seed)
      return seed
    }

    const seed = createSeedTripState()
    const settingsRow = settings.rows[0]

    return {
      travelers: travelers.rows.map((row) => ({
        id: row.id as TravelerId,
        name: row.name,
        color: row.color,
        sortOrder: Number(row.sort_order),
      })),
      places: places.rows.map((row) => ({
        id: row.id,
        name: row.name,
        city: row.city,
        category: row.category as PlaceCategory,
        url: row.url,
        note: row.note,
        photoUrl: row.photo_url,
        status: row.status as PlaceStatus,
        dayId: row.day_id || undefined,
        createdAt: row.created_at,
      })),
      hotels: hotels.rows.map((row) => ({
        id: row.id,
        name: row.name,
        city: row.city,
        address: row.address,
        checkIn: row.check_in,
        checkOut: row.check_out,
        price: Number(row.price),
        currency: row.currency as Currency,
        url: row.url,
        confirmationUrl: row.confirmation_url,
        note: row.note,
      })),
      tickets: tickets.rows.map((row) => ({
        id: row.id,
        kind: row.kind as TicketKind,
        fromCity: row.from_city,
        toCity: row.to_city,
        departAt: row.depart_at,
        arriveAt: row.arrive_at,
        refNumber: row.ref_number,
        seat: row.seat,
        price: Number(row.price),
        currency: row.currency as Currency,
        url: row.url,
        fileUrl: row.file_url,
      })),
      days: days.rows.map((row) => ({
        id: row.id,
        date: row.date,
        city: row.city,
        note: row.note,
      })),
      dayItems: dayItems.rows.map((row) => ({
        id: row.id,
        dayId: row.day_id,
        kind: row.kind as DayItemKind,
        refId: row.ref_id,
        sortOrder: Number(row.sort_order),
        title: row.title || undefined,
        note: row.note || undefined,
      })),
      expenses: expenses.rows.map((row) => ({
        id: row.id,
        payerId: row.payer_id as TravelerId,
        amount: Number(row.amount),
        currency: row.currency as Currency,
        category: row.category,
        description: row.description,
        spentAt: row.spent_at,
        createdAt: row.created_at,
      })),
      expenseShares: expenseShares.rows.map((row) => ({
        expenseId: row.expense_id,
        travelerId: row.traveler_id as TravelerId,
      })),
      checklists: checklists.rows.map((row) => ({
        id: row.id,
        title: row.title,
        kind: row.kind as ChecklistKind,
      })),
      checklistItems: checklistItems.rows.map((row) => ({
        id: row.id,
        checklistId: row.checklist_id,
        text: row.text,
        done: Boolean(row.done),
        sortOrder: Number(row.sort_order),
      })),
      settings: {
        ...seed.settings,
        ...(settingsRow
          ? {
              cnyToRubRate: Number(settingsRow.cny_to_rub_rate),
              rateUpdatedAt: settingsRow.rate_updated_at,
              displayCurrency: settingsRow.display_currency as Currency,
            }
          : {}),
      },
    }
  } finally {
    client.release()
  }
}

export async function writeTripStateToPostgres(state: TripState) {
  const client = await getPool().connect()

  try {
    await client.query('begin')

    await client.query('delete from checklist_items')
    await client.query('delete from checklists')
    await client.query('delete from expense_shares')
    await client.query('delete from expenses')
    await client.query('delete from day_items')
    await client.query('delete from places')
    await client.query('delete from hotels')
    await client.query('delete from tickets')
    await client.query('delete from days')
    await client.query('delete from travelers')

    for (const traveler of state.travelers) {
      await client.query(
        'insert into travelers (id, name, color, sort_order) values ($1, $2, $3, $4)',
        [traveler.id, traveler.name, traveler.color, traveler.sortOrder],
      )
    }

    for (const day of state.days) {
      await client.query(
        'insert into days (id, date, city, note) values ($1, $2, $3, $4)',
        [day.id, day.date, day.city, day.note],
      )
    }

    for (const place of state.places) {
      await client.query(
        `insert into places
          (id, name, city, category, url, note, photo_url, status, day_id, created_at)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          place.id,
          place.name,
          place.city,
          place.category,
          place.url,
          place.note,
          place.photoUrl,
          place.status,
          place.dayId ?? null,
          place.createdAt,
        ],
      )
    }

    for (const hotel of state.hotels) {
      await client.query(
        `insert into hotels
          (id, name, city, address, check_in, check_out, price, currency, url, confirmation_url, note)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          hotel.id,
          hotel.name,
          hotel.city,
          hotel.address,
          hotel.checkIn,
          hotel.checkOut,
          hotel.price,
          hotel.currency,
          hotel.url,
          hotel.confirmationUrl,
          hotel.note,
        ],
      )
    }

    for (const ticket of state.tickets) {
      await client.query(
        `insert into tickets
          (id, kind, from_city, to_city, depart_at, arrive_at, ref_number, seat, price, currency, url, file_url)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          ticket.id,
          ticket.kind,
          ticket.fromCity,
          ticket.toCity,
          ticket.departAt,
          ticket.arriveAt,
          ticket.refNumber,
          ticket.seat,
          ticket.price,
          ticket.currency,
          ticket.url,
          ticket.fileUrl,
        ],
      )
    }

    for (const item of state.dayItems) {
      await client.query(
        `insert into day_items
          (id, day_id, kind, ref_id, sort_order, title, note)
          values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          item.id,
          item.dayId,
          item.kind,
          item.refId,
          item.sortOrder,
          item.title ?? null,
          item.note ?? null,
        ],
      )
    }

    for (const expense of state.expenses) {
      await client.query(
        `insert into expenses
          (id, payer_id, amount, currency, category, description, spent_at, created_at)
          values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          expense.id,
          expense.payerId,
          expense.amount,
          expense.currency,
          expense.category,
          expense.description,
          expense.spentAt,
          expense.createdAt,
        ],
      )
    }

    for (const share of state.expenseShares) {
      await client.query(
        'insert into expense_shares (expense_id, traveler_id) values ($1, $2)',
        [share.expenseId, share.travelerId],
      )
    }

    for (const checklist of state.checklists) {
      await client.query(
        'insert into checklists (id, title, kind) values ($1, $2, $3)',
        [checklist.id, checklist.title, checklist.kind],
      )
    }

    for (const item of state.checklistItems) {
      await client.query(
        `insert into checklist_items
          (id, checklist_id, text, done, sort_order)
          values ($1, $2, $3, $4, $5)`,
        [item.id, item.checklistId, item.text, item.done, item.sortOrder],
      )
    }

    await client.query(
      `insert into settings (id, cny_to_rub_rate, rate_updated_at, display_currency)
       values (1, $1, $2, $3)
       on conflict (id) do update set
        cny_to_rub_rate = excluded.cny_to_rub_rate,
        rate_updated_at = excluded.rate_updated_at,
        display_currency = excluded.display_currency`,
      [
        state.settings.cnyToRubRate,
        state.settings.rateUpdatedAt,
        state.settings.displayCurrency,
      ],
    )

    await client.query('commit')
    return state
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for Postgres storage')
  }

  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.PGSSLMODE === 'disable'
        ? undefined
        : { rejectUnauthorized: false },
    max: 5,
  })

  return pool
}
