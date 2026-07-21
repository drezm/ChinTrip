import pg from 'pg'

import { createSeedTripState } from '../lib/seed'
import type {
  ChecklistKind,
  Currency,
  DayItemKind,
  PlaceCategory,
  PlaceSection,
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
      placeSections,
      dayItems,
      expenses,
      expenseShares,
      expenseSplits,
      payments,
      checklists,
      checklistItems,
      settings,
    ] = await Promise.all([
      client.query('select * from travelers order by sort_order asc'),
      client.query('select * from places order by created_at desc, name asc'),
      client.query('select * from hotels order by check_in asc, name asc'),
      client.query('select * from tickets order by depart_at asc, from_city asc'),
      client.query('select * from days order by date asc'),
      client.query('select * from place_sections order by sort_order asc, title asc'),
      client.query('select * from day_items order by day_id asc, sort_order asc'),
      client.query('select * from expenses order by spent_at desc, created_at desc'),
      client.query('select * from expense_shares order by expense_id asc'),
      client.query('select * from expense_splits order by expense_id asc, traveler_id asc'),
      client.query('select * from payments order by created_at desc'),
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
        updatedAt: row.updated_at,
      })),
      placeSections: mergePlaceSections(
        placeSections.rows.map((row) => ({
          id: row.id,
          title: row.title,
          sortOrder: Number(row.sort_order),
        })),
        places.rows.map((row) => row.category as string),
      ),
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
        createdAt: row.created_at,
        updatedAt: row.updated_at,
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
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      days: days.rows.map((row) => ({
        id: row.id,
        date: row.date,
        city: row.city,
        note: row.note,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      dayItems: dayItems.rows.map((row) => ({
        id: row.id,
        dayId: row.day_id,
        kind: row.kind as DayItemKind,
        refId: row.ref_id,
        sortOrder: Number(row.sort_order),
        title: row.title || undefined,
        note: row.note || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      expenses: expenses.rows.map((row) => ({
        id: row.id,
        payerId: row.payer_id as TravelerId,
        amount: Number(row.amount),
        currency: row.currency as Currency,
        exchangeRate: Number(row.exchange_rate || settingsRow?.cny_to_rub_rate || seed.settings.cnyToRubRate),
        amountCny: Number(row.amount_cny || row.amount),
        splitType: row.split_type || 'equal',
        category: row.category,
        description: row.description,
        spentAt: row.spent_at,
        dayId: row.day_id || undefined,
        placeId: row.place_id || undefined,
        hotelId: row.hotel_id || undefined,
        ticketId: row.ticket_id || undefined,
        createdBy: row.created_by || row.payer_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at || row.created_at,
      })),
      expenseShares: expenseShares.rows.map((row) => ({
        expenseId: row.expense_id,
        travelerId: row.traveler_id as TravelerId,
      })),
      expenseSplits: expenseSplits.rows.map((row) => ({
        id: row.id,
        expenseId: row.expense_id,
        travelerId: row.traveler_id as TravelerId,
        value: Number(row.value),
        amountCny: Number(row.amount_cny),
      })),
      payments: payments.rows.map((row) => ({
        id: row.id,
        fromTravelerId: row.from_traveler_id as TravelerId,
        toTravelerId: row.to_traveler_id as TravelerId,
        amount: Number(row.amount),
        currency: row.currency as Currency,
        exchangeRate: Number(row.exchange_rate),
        amountCny: Number(row.amount_cny),
        status: row.status,
        paidAt: row.paid_at || undefined,
        note: row.note,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      checklists: checklists.rows.map((row) => ({
        id: row.id,
        title: row.title,
        kind: row.kind as ChecklistKind,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      checklistItems: checklistItems.rows.map((row) => ({
        id: row.id,
        checklistId: row.checklist_id,
        text: row.text,
        done: Boolean(row.done),
        sortOrder: Number(row.sort_order),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      settings: {
        ...seed.settings,
        ...(settingsRow
          ? {
              cnyToRubRate: Number(settingsRow.cny_to_rub_rate),
              rateUpdatedAt: settingsRow.rate_updated_at,
              displayCurrency: settingsRow.display_currency as Currency,
              theme: settingsRow.theme ?? seed.settings.theme,
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
    await client.query('delete from expense_splits')
    await client.query('delete from payments')
    await client.query('delete from expenses')
    await client.query('delete from day_items')
    await client.query('delete from places')
    await client.query('delete from place_sections')
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

    for (const section of mergePlaceSections(
      state.placeSections,
      state.places.map((place) => place.category),
    )) {
      await client.query(
        'insert into place_sections (id, title, sort_order) values ($1, $2, $3)',
        [section.id, section.title, section.sortOrder],
      )
    }

    for (const place of state.places) {
      await client.query(
        `insert into places
          (id, name, city, category, url, note, photo_url, status, day_id, created_at, updated_at)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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
          place.updatedAt ?? place.createdAt,
        ],
      )
    }

    for (const hotel of state.hotels) {
      await client.query(
        `insert into hotels
          (id, name, city, address, check_in, check_out, price, currency, url, confirmation_url, note, created_at, updated_at)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
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
          hotel.createdAt ?? new Date().toISOString(),
          hotel.updatedAt ?? hotel.createdAt ?? new Date().toISOString(),
        ],
      )
    }

    for (const ticket of state.tickets) {
      await client.query(
        `insert into tickets
          (id, kind, from_city, to_city, depart_at, arrive_at, ref_number, seat, price, currency, url, file_url, created_at, updated_at)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
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
          ticket.createdAt ?? new Date().toISOString(),
          ticket.updatedAt ?? ticket.createdAt ?? new Date().toISOString(),
        ],
      )
    }

    for (const item of state.dayItems) {
      await client.query(
        `insert into day_items
          (id, day_id, kind, ref_id, sort_order, title, note, created_at, updated_at)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          item.id,
          item.dayId,
          item.kind,
          item.refId,
          item.sortOrder,
          item.title ?? null,
          item.note ?? null,
          item.createdAt ?? new Date().toISOString(),
          item.updatedAt ?? item.createdAt ?? new Date().toISOString(),
        ],
      )
    }

    for (const expense of state.expenses) {
      await client.query(
        `insert into expenses
          (id, payer_id, amount, currency, exchange_rate, amount_cny, split_type, category, description, spent_at, day_id, place_id, hotel_id, ticket_id, created_by, created_at, updated_at)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          expense.id,
          expense.payerId,
          expense.amount,
          expense.currency,
          expense.exchangeRate,
          expense.amountCny,
          expense.splitType,
          expense.category,
          expense.description,
          expense.spentAt,
          expense.dayId ?? null,
          expense.placeId ?? null,
          expense.hotelId ?? null,
          expense.ticketId ?? null,
          expense.createdBy,
          expense.createdAt,
          expense.updatedAt ?? expense.createdAt,
        ],
      )
    }

    for (const share of state.expenseShares) {
      await client.query(
        'insert into expense_shares (expense_id, traveler_id) values ($1, $2)',
        [share.expenseId, share.travelerId],
      )
    }

    for (const split of state.expenseSplits) {
      await client.query(
        `insert into expense_splits (id, expense_id, traveler_id, value, amount_cny)
         values ($1, $2, $3, $4, $5)`,
        [
          split.id,
          split.expenseId,
          split.travelerId,
          split.value,
          split.amountCny,
        ],
      )
    }

    for (const payment of state.payments) {
      await client.query(
        `insert into payments
          (id, from_traveler_id, to_traveler_id, amount, currency, exchange_rate, amount_cny, status, paid_at, note, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          payment.id,
          payment.fromTravelerId,
          payment.toTravelerId,
          payment.amount,
          payment.currency,
          payment.exchangeRate,
          payment.amountCny,
          payment.status,
          payment.paidAt ?? null,
          payment.note,
          payment.createdAt,
          payment.updatedAt,
        ],
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
      `insert into settings (id, cny_to_rub_rate, rate_updated_at, display_currency, theme)
       values (1, $1, $2, $3, $4)
       on conflict (id) do update set
        cny_to_rub_rate = excluded.cny_to_rub_rate,
        rate_updated_at = excluded.rate_updated_at,
        display_currency = excluded.display_currency,
        theme = excluded.theme`,
      [
        state.settings.cnyToRubRate,
        state.settings.rateUpdatedAt,
        state.settings.displayCurrency,
        state.settings.theme,
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

function mergePlaceSections(sections: PlaceSection[], categories: string[]) {
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
