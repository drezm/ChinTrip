import { createServerFn } from '@tanstack/react-start'

import {
  calculateAmountCny,
  createExpenseSplits,
} from '../../lib/money'
import type {
  Checklist,
  ChecklistItem,
  Day,
  DayItem,
  Expense,
  Hotel,
  Payment,
  Place,
  PlaceSection,
  Ticket,
} from '../../types/trip'
import { notFound } from '../../lib/errors/server-error'
import {
  assignPlaceToDaySchema,
  changePlaceStatusSchema,
  createChecklistItemSchema,
  createChecklistSchema,
  createDayItemSchema,
  createDaySchema,
  createExpenseSchema,
  createHotelSchema,
  createPaymentSchema,
  createPlaceSchema,
  createTicketSchema,
  markPaymentAsCompletedSchema,
  moveDayItemToAnotherDaySchema,
  parseWithSchema,
  reorderChecklistItemsSchema,
  reorderDayItemsSchema,
  toggleChecklistItemSchema,
  updateChecklistItemSchema,
  updateChecklistSchema,
  updateDayItemSchema,
  updateDaySchema,
  updateExpenseSchema,
  updateHotelSchema,
  updatePaymentSchema,
  updatePlaceSchema,
  updateTicketSchema,
  updateTripSettingsSchema,
  validateEntityLinks,
  validateExpenseBusinessRules,
} from '../validation/schemas'

export const createExpense = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(createExpenseSchema, data)
      validateExpenseBusinessRules(state, input)
      const timestamp = nowIso()
      const expenseId = id('expense')
      const amountCny = calculateAmountCny(
        input.amount,
        input.currency,
        input.exchangeRate,
      )
      const expense: Expense = {
        id: expenseId,
        payerId: input.payerId,
        amount: input.amount,
        currency: input.currency,
        exchangeRate: input.exchangeRate,
        amountCny,
        splitType: input.splitType,
        category: input.category,
        description: input.description,
        spentAt: input.spentAt,
        dayId: input.dayId,
        placeId: input.placeId,
        hotelId: input.hotelId,
        ticketId: input.ticketId,
        createdBy: input.createdBy,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      const splits = createExpenseSplits({
        expenseId,
        amountCny,
        splitType: input.splitType,
        participants: input.participants,
      })

      return {
        state: {
          ...state,
          expenses: [expense, ...state.expenses],
          expenseSplits: [...splits, ...state.expenseSplits],
          expenseShares: [
            ...splits.map((split) => ({
              expenseId,
              travelerId: split.travelerId,
            })),
            ...state.expenseShares,
          ],
        },
        result: { expense, splits },
      }
    })
  })

export const updateExpense = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(updateExpenseSchema, data)
      const existing = findRequired(state.expenses, input.id, 'Расход не найден')
      const fullInput = {
        payerId: input.payerId ?? existing.payerId,
        amount: input.amount ?? existing.amount,
        currency: input.currency ?? existing.currency,
        exchangeRate: input.exchangeRate ?? existing.exchangeRate,
        splitType: input.splitType ?? existing.splitType,
        category: input.category ?? existing.category,
        description: input.description ?? existing.description,
        spentAt: input.spentAt ?? existing.spentAt,
        participants:
          input.participants ??
          state.expenseSplits
            .filter((split) => split.expenseId === existing.id)
            .map((split) => ({
              travelerId: split.travelerId,
              value: split.value,
            })),
        dayId: input.dayId ?? existing.dayId,
        placeId: input.placeId ?? existing.placeId,
        hotelId: input.hotelId ?? existing.hotelId,
        ticketId: input.ticketId ?? existing.ticketId,
        createdBy: input.createdBy ?? existing.createdBy,
      }
      validateExpenseBusinessRules(state, fullInput)
      const amountCny = calculateAmountCny(
        fullInput.amount,
        fullInput.currency,
        fullInput.exchangeRate,
      )
      const expense: Expense = {
        ...existing,
        ...fullInput,
        amountCny,
        updatedAt: nowIso(),
      }
      const splits = createExpenseSplits({
        expenseId: existing.id,
        amountCny,
        splitType: fullInput.splitType,
        participants: fullInput.participants,
      })

      return {
        state: {
          ...state,
          expenses: state.expenses.map((item) =>
            item.id === existing.id ? expense : item,
          ),
          expenseSplits: [
            ...state.expenseSplits.filter((split) => split.expenseId !== existing.id),
            ...splits,
          ],
          expenseShares: [
            ...state.expenseShares.filter((share) => share.expenseId !== existing.id),
            ...splits.map((split) => ({
              expenseId: existing.id,
              travelerId: split.travelerId,
            })),
          ],
        },
        result: { expense, splits },
      }
    })
  })

export const deleteExpense = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(updateExpenseSchema.pick({ id: true }), data)
      findRequired(state.expenses, input.id, 'Расход не найден')
      return {
        state: {
          ...state,
          expenses: state.expenses.filter((expense) => expense.id !== input.id),
          expenseSplits: state.expenseSplits.filter(
            (split) => split.expenseId !== input.id,
          ),
          expenseShares: state.expenseShares.filter(
            (share) => share.expenseId !== input.id,
          ),
        },
        result: { id: input.id },
      }
    })
  })

export const createPayment = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(createPaymentSchema, data)
      assertTraveler(state, input.fromTravelerId)
      assertTraveler(state, input.toTravelerId)
      const timestamp = nowIso()
      const amountCny = calculateAmountCny(
        input.amount,
        input.currency,
        input.exchangeRate,
      )
      const payment: Payment = {
        id: id('payment'),
        fromTravelerId: input.fromTravelerId,
        toTravelerId: input.toTravelerId,
        amount: input.amount,
        currency: input.currency,
        exchangeRate: input.exchangeRate,
        amountCny,
        status: input.status,
        paidAt: input.status === 'completed' ? input.paidAt ?? todayIsoDate() : input.paidAt,
        note: input.note,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      return {
        state: { ...state, payments: [payment, ...state.payments] },
        result: payment,
      }
    })
  })

export const updatePayment = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(updatePaymentSchema, data)
      const existing = findRequired(state.payments, input.id, 'Платёж не найден')
      if (input.fromTravelerId) assertTraveler(state, input.fromTravelerId)
      if (input.toTravelerId) assertTraveler(state, input.toTravelerId)
      const amount = input.amount ?? existing.amount
      const currency = input.currency ?? existing.currency
      const exchangeRate = input.exchangeRate ?? existing.exchangeRate
      const payment: Payment = {
        ...existing,
        ...input,
        amount,
        currency,
        exchangeRate,
        amountCny: calculateAmountCny(amount, currency, exchangeRate),
        updatedAt: nowIso(),
      }
      return {
        state: {
          ...state,
          payments: state.payments.map((candidate) =>
            candidate.id === payment.id ? payment : candidate,
          ),
        },
        result: payment,
      }
    })
  })

export const deletePayment = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(updatePaymentSchema.pick({ id: true }), data)
      findRequired(state.payments, input.id, 'Платёж не найден')
      return {
        state: {
          ...state,
          payments: state.payments.filter((payment) => payment.id !== input.id),
        },
        result: { id: input.id },
      }
    })
  })

export const markPaymentAsCompleted = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(markPaymentAsCompletedSchema, data)
      const existing = findRequired(state.payments, input.id, 'Платёж не найден')
      const payment: Payment = {
        ...existing,
        status: input.completed ? 'completed' : 'planned',
        paidAt: input.completed ? existing.paidAt ?? todayIsoDate() : undefined,
        updatedAt: nowIso(),
      }
      return {
        state: {
          ...state,
          payments: state.payments.map((candidate) =>
            candidate.id === payment.id ? payment : candidate,
          ),
        },
        result: payment,
      }
    })
  })

export const createPlace = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(createPlaceSchema, data)
      validateEntityLinks(state, input)
      const timestamp = nowIso()
      const place: Place = {
        id: id('place'),
        ...input,
        url: input.url ?? '',
        note: input.note ?? '',
        photoUrl: input.photoUrl ?? '',
        status: input.status ?? 'want',
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      return {
        state: {
          ...state,
          places: [place, ...state.places],
          dayItems: place.dayId
            ? [
                ...state.dayItems,
                makeDayItem(state, place.dayId, 'place', place.id),
              ]
            : state.dayItems,
        },
        result: place,
      }
    })
  })

export const updatePlace = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(updatePlaceSchema, data)
      validateEntityLinks(state, input)
      const existing = findRequired(state.places, input.id, 'Место не найдено')
      const place: Place = {
        ...existing,
        ...input,
        updatedAt: nowIso(),
      }
      return {
        state: {
          ...state,
          places: state.places.map((candidate) =>
            candidate.id === place.id ? place : candidate,
          ),
          dayItems: syncDayItemLink(state.dayItems, state, 'place', place.id, place.dayId),
        },
        result: place,
      }
    })
  })

export const deletePlace = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const placeId = String((data as { id?: string }).id ?? '')
      findRequired(state.places, placeId, 'Место не найдено')
      return {
        state: {
          ...state,
          places: state.places.filter((place) => place.id !== placeId),
          dayItems: state.dayItems.filter(
            (item) => !(item.kind === 'place' && item.refId === placeId),
          ),
        },
        result: { id: placeId },
      }
    })
  })

export const changePlaceStatus = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(changePlaceStatusSchema, data)
      const existing = findRequired(state.places, input.id, 'Место не найдено')
      const place: Place = { ...existing, status: input.status, updatedAt: nowIso() }
      return {
        state: {
          ...state,
          places: state.places.map((candidate) =>
            candidate.id === place.id ? place : candidate,
          ),
        },
        result: place,
      }
    })
  })

export const assignPlaceToDay = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(assignPlaceToDaySchema, data)
      validateEntityLinks(state, { dayId: input.dayId })
      const existing = findRequired(state.places, input.placeId, 'Место не найдено')
      const place: Place = { ...existing, dayId: input.dayId, updatedAt: nowIso() }
      return {
        state: {
          ...state,
          places: state.places.map((candidate) =>
            candidate.id === place.id ? place : candidate,
          ),
          dayItems: syncDayItemLink(state.dayItems, state, 'place', place.id, input.dayId),
        },
        result: place,
      }
    })
  })

export const createPlaceSection = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const title = String((data as { title?: string }).title ?? '').trim()
      if (!title) throw new Error('{"code":"VALIDATION_ERROR","message":"Название раздела обязательно","fieldErrors":{"title":["Название раздела обязательно"]}}')
      const section: PlaceSection = {
        id: slugify(title, state.placeSections.map((item) => item.id)),
        title,
        sortOrder: nextSortOrder(state.placeSections),
      }
      return {
        state: { ...state, placeSections: [...state.placeSections, section] },
        result: section,
      }
    })
  })

export const updatePlaceSection = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = data as { id?: string; title?: string }
      const section = findRequired(
        state.placeSections,
        String(input.id ?? ''),
        'Раздел не найден',
      )
      const title = String(input.title ?? '').trim()
      if (!title) throw new Error('{"code":"VALIDATION_ERROR","message":"Название раздела обязательно","fieldErrors":{"title":["Название раздела обязательно"]}}')
      const updated = { ...section, title }
      return {
        state: {
          ...state,
          placeSections: state.placeSections.map((item) =>
            item.id === updated.id ? updated : item,
          ),
        },
        result: updated,
      }
    })
  })

export const deletePlaceSection = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const sectionId = String((data as { id?: string }).id ?? '')
      findRequired(state.placeSections, sectionId, 'Раздел не найден')
      const fallback = state.placeSections.find((section) => section.id !== sectionId)
      if (!fallback) throw new Error('Нельзя удалить последний раздел')
      return {
        state: {
          ...state,
          placeSections: state.placeSections.filter(
            (section) => section.id !== sectionId,
          ),
          places: state.places.map((place) =>
            place.category === sectionId
              ? { ...place, category: fallback.id, updatedAt: nowIso() }
              : place,
          ),
        },
        result: { id: sectionId, fallbackId: fallback.id },
      }
    })
  })

export const createDay = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(createDaySchema, data)
      const day: Day = {
        ...input,
        id: id('day'),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      return {
        state: { ...state, days: [day, ...state.days] },
        result: day,
      }
    })
  })

export const updateDay = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(updateDaySchema, data)
      const existing = findRequired(state.days, input.id, 'День не найден')
      const day: Day = { ...existing, ...input, updatedAt: nowIso() }
      return {
        state: {
          ...state,
          days: state.days.map((candidate) =>
            candidate.id === day.id ? day : candidate,
          ),
        },
        result: day,
      }
    })
  })
export const deleteDay = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(updateDaySchema.pick({ id: true }), data)
      findRequired(state.days, input.id, 'День не найден')
      return {
        state: {
          ...state,
          days: state.days.filter((day) => day.id !== input.id),
          dayItems: state.dayItems.filter((item) => item.dayId !== input.id),
          places: state.places.map((place) =>
            place.dayId === input.id ? { ...place, dayId: undefined } : place,
          ),
        },
        result: { id: input.id },
      }
    })
  })

export const createDayItem = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(createDayItemSchema, data)
      findRequired(state.days, input.dayId, 'День не найден')
      const item = makeDayItem(
        state,
        input.dayId,
        input.kind,
        input.refId,
        input.title,
        input.note,
      )
      return {
        state: { ...state, dayItems: [...state.dayItems, item] },
        result: item,
      }
    })
  })
export const updateDayItem = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(updateDayItemSchema, data)
      const existing = findRequired(
        state.dayItems,
        input.id,
        'Элемент маршрута не найден',
      )
      const item: DayItem = { ...existing, ...input, updatedAt: nowIso() }
      return {
        state: {
          ...state,
          dayItems: state.dayItems.map((candidate) =>
            candidate.id === item.id ? item : candidate,
          ),
        },
        result: item,
      }
    })
  })

export const deleteDayItem = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const itemId = String((data as { id?: string }).id ?? '')
      findRequired(state.dayItems, itemId, 'Элемент маршрута не найден')
      return {
        state: {
          ...state,
          dayItems: state.dayItems.filter((item) => item.id !== itemId),
        },
        result: { id: itemId },
      }
    })
  })
export const reorderDayItems = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(reorderDayItemsSchema, data)
      findRequired(state.days, input.dayId, 'День не найден')
      const order = new Map(input.itemIds.map((itemId, index) => [itemId, (index + 1) * 10]))
      const dayItems = state.dayItems.map((item) =>
        item.dayId === input.dayId && order.has(item.id)
          ? { ...item, sortOrder: order.get(item.id) ?? item.sortOrder, updatedAt: nowIso() }
          : item,
      )
      return { state: { ...state, dayItems }, result: { dayId: input.dayId } }
    })
  })
export const moveDayItemToAnotherDay = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(moveDayItemToAnotherDaySchema, data)
      findRequired(state.days, input.dayId, 'День не найден')
      const existing = findRequired(state.dayItems, input.id, 'Элемент маршрута не найден')
      const item = {
        ...existing,
        dayId: input.dayId,
        sortOrder:
          input.sortOrder ??
          nextSortOrder(state.dayItems.filter((candidate) => candidate.dayId === input.dayId)),
        updatedAt: nowIso(),
      }
      return {
        state: {
          ...state,
          dayItems: state.dayItems.map((candidate) =>
            candidate.id === item.id ? item : candidate,
          ),
        },
        result: item,
      }
    })
  })

export const createHotel = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(createHotelSchema, data)
      validateEntityLinks(state, input)
      const timestamp = nowIso()
      const hotel: Hotel = {
        id: id('hotel'),
        name: input.name,
        city: input.city,
        address: input.address,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        price: input.price,
        currency: input.currency,
        url: input.url,
        confirmationUrl: input.confirmationUrl,
        note: input.note,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      return {
        state: {
          ...state,
          hotels: [...state.hotels, hotel],
          dayItems: input.dayId
            ? [...state.dayItems, makeDayItem(state, input.dayId, 'hotel', hotel.id)]
            : state.dayItems,
        },
        result: hotel,
      }
    })
  })

export const updateHotel = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(updateHotelSchema, data)
      validateEntityLinks(state, input)
      const existing = findRequired(state.hotels, input.id, 'Отель не найден')
      const { dayId, ...hotelInput } = input
      const hotel: Hotel = { ...existing, ...hotelInput, updatedAt: nowIso() }
      return {
        state: {
          ...state,
          hotels: state.hotels.map((candidate) =>
            candidate.id === hotel.id ? hotel : candidate,
          ),
          dayItems: syncDayItemLink(state.dayItems, state, 'hotel', hotel.id, dayId),
        },
        result: hotel,
      }
    })
  })

export const deleteHotel = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const hotelId = String((data as { id?: string }).id ?? '')
      findRequired(state.hotels, hotelId, 'Отель не найден')
      return {
        state: {
          ...state,
          hotels: state.hotels.filter((hotel) => hotel.id !== hotelId),
          dayItems: state.dayItems.filter(
            (item) => !(item.kind === 'hotel' && item.refId === hotelId),
          ),
        },
        result: { id: hotelId },
      }
    })
  })

export const createTicket = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(createTicketSchema, data)
      validateEntityLinks(state, input)
      const timestamp = nowIso()
      const ticket: Ticket = {
        id: id('ticket'),
        kind: input.kind,
        fromCity: input.fromCity,
        toCity: input.toCity,
        departAt: input.departAt,
        arriveAt: input.arriveAt,
        refNumber: input.refNumber,
        seat: input.seat,
        price: input.price,
        currency: input.currency,
        url: input.url,
        fileUrl: input.fileUrl,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      return {
        state: {
          ...state,
          tickets: [...state.tickets, ticket],
          dayItems: input.dayId
            ? [...state.dayItems, makeDayItem(state, input.dayId, 'ticket', ticket.id)]
            : state.dayItems,
        },
        result: ticket,
      }
    })
  })

export const updateTicket = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(updateTicketSchema, data)
      validateEntityLinks(state, input)
      const existing = findRequired(state.tickets, input.id, 'Билет не найден')
      const { dayId, ...ticketInput } = input
      const ticket: Ticket = { ...existing, ...ticketInput, updatedAt: nowIso() }
      return {
        state: {
          ...state,
          tickets: state.tickets.map((candidate) =>
            candidate.id === ticket.id ? ticket : candidate,
          ),
          dayItems: syncDayItemLink(state.dayItems, state, 'ticket', ticket.id, dayId),
        },
        result: ticket,
      }
    })
  })

export const deleteTicket = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const ticketId = String((data as { id?: string }).id ?? '')
      findRequired(state.tickets, ticketId, 'Билет не найден')
      return {
        state: {
          ...state,
          tickets: state.tickets.filter((ticket) => ticket.id !== ticketId),
          dayItems: state.dayItems.filter(
            (item) => !(item.kind === 'ticket' && item.refId === ticketId),
          ),
        },
        result: { id: ticketId },
      }
    })
  })

export const createChecklist = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(createChecklistSchema, data)
      const checklist: Checklist = {
        ...input,
        id: id('checklist'),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      return {
        state: { ...state, checklists: [checklist, ...state.checklists] },
        result: checklist,
      }
    })
  })

export const updateChecklist = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(updateChecklistSchema, data)
      const existing = findRequired(state.checklists, input.id, 'Список не найден')
      const checklist: Checklist = { ...existing, ...input, updatedAt: nowIso() }
      return {
        state: {
          ...state,
          checklists: state.checklists.map((candidate) =>
            candidate.id === checklist.id ? checklist : candidate,
          ),
        },
        result: checklist,
      }
    })
  })
export const deleteChecklist = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(updateChecklistSchema.pick({ id: true }), data)
      findRequired(state.checklists, input.id, 'Список не найден')
      return {
        state: {
          ...state,
          checklists: state.checklists.filter((item) => item.id !== input.id),
          checklistItems: state.checklistItems.filter(
            (item) => item.checklistId !== input.id,
          ),
        },
        result: { id: input.id },
      }
    })
  })
export const createChecklistItem = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(createChecklistItemSchema, data)
      findRequired(state.checklists, input.checklistId, 'Список не найден')
      const timestamp = nowIso()
      const item: ChecklistItem = {
        id: id('check-item'),
        checklistId: input.checklistId,
        text: input.text,
        done: false,
        sortOrder: nextSortOrder(
          state.checklistItems.filter(
            (candidate) => candidate.checklistId === input.checklistId,
          ),
        ),
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      return {
        state: { ...state, checklistItems: [...state.checklistItems, item] },
        result: item,
      }
    })
  })
export const updateChecklistItem = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(updateChecklistItemSchema, data)
      const existing = findRequired(state.checklistItems, input.id, 'Пункт не найден')
      const item: ChecklistItem = { ...existing, ...input, updatedAt: nowIso() }
      return {
        state: {
          ...state,
          checklistItems: state.checklistItems.map((candidate) =>
            candidate.id === item.id ? item : candidate,
          ),
        },
        result: item,
      }
    })
  })
export const toggleChecklistItem = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(toggleChecklistItemSchema, data)
      const existing = findRequired(state.checklistItems, input.id, 'Пункт не найден')
      const item = { ...existing, done: input.done, updatedAt: nowIso() }
      return {
        state: {
          ...state,
          checklistItems: state.checklistItems.map((candidate) =>
            candidate.id === item.id ? item : candidate,
          ),
        },
        result: item,
      }
    })
  })
export const deleteChecklistItem = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const itemId = String((data as { id?: string }).id ?? '')
      findRequired(state.checklistItems, itemId, 'Пункт не найден')
      return {
        state: {
          ...state,
          checklistItems: state.checklistItems.filter((item) => item.id !== itemId),
        },
        result: { id: itemId },
      }
    })
  })
export const reorderChecklistItems = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(reorderChecklistItemsSchema, data)
      findRequired(state.checklists, input.checklistId, 'Список не найден')
      const order = new Map(input.itemIds.map((itemId, index) => [itemId, (index + 1) * 10]))
      const checklistItems = state.checklistItems.map((item) =>
        item.checklistId === input.checklistId && order.has(item.id)
          ? { ...item, sortOrder: order.get(item.id) ?? item.sortOrder, updatedAt: nowIso() }
          : item,
      )
      return {
        state: { ...state, checklistItems },
        result: { checklistId: input.checklistId },
      }
    })
  })

export const updateTripSettings = createServerFn({ method: 'POST' })
  .validator((value: unknown) => value)
  .handler(async ({ data }) => {
    const { mutateTripState } = await import('../repositories/stateMutation')
    return mutateTripState((state) => {
      const input = parseWithSchema(updateTripSettingsSchema, data)
      const settings = {
        ...state.settings,
        ...input,
        rateUpdatedAt: input.cnyToRubRate ? nowIso() : state.settings.rateUpdatedAt,
      }
      return { state: { ...state, settings }, result: settings }
    })
  })

function makeDayItem(
  state: import('../../types/trip').TripState,
  dayId: string,
  kind: DayItem['kind'],
  refId: string,
  title?: string,
  note?: string,
): DayItem {
  const timestamp = nowIso()
  return {
    id: id('day-item'),
    dayId,
    kind,
    refId,
    sortOrder: nextSortOrder(
      state.dayItems.filter((candidate) => candidate.dayId === dayId),
    ),
    title,
    note,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function syncDayItemLink(
  items: DayItem[],
  state: import('../../types/trip').TripState,
  kind: 'place' | 'hotel' | 'ticket',
  refId: string,
  dayId?: string,
) {
  const existing = items.find((item) => item.kind === kind && item.refId === refId)
  if (!dayId) {
    return items.filter((item) => !(item.kind === kind && item.refId === refId))
  }
  if (existing) {
    return items.map((item) =>
      item.id === existing.id ? { ...item, dayId, updatedAt: nowIso() } : item,
    )
  }
  return [...items, makeDayItem(state, dayId, kind, refId)]
}

function assertTraveler(state: import('../../types/trip').TripState, travelerId: string) {
  findRequired(state.travelers, travelerId, 'Путешественник не найден')
}

function slugify(title: string, existingIds: string[]) {
  const base =
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  let candidate = base
  let index = 2
  while (existingIds.includes(candidate)) {
    candidate = `${base}-${index}`
    index += 1
  }
  return candidate
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function id(prefix: string) {
  const random =
    globalThis.crypto && 'randomUUID' in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return `${prefix}-${random}`
}

function nowIso() {
  return new Date().toISOString()
}

function findRequired<T extends { id: string }>(
  collection: T[],
  itemId: string,
  message = 'Запись не найдена',
) {
  const item = collection.find((candidate) => candidate.id === itemId)
  if (!item) throw notFound(message)
  return item
}

function nextSortOrder(items: Array<{ sortOrder: number }>) {
  if (!items.length) return 10
  return Math.max(...items.map((item) => item.sortOrder)) + 10
}
