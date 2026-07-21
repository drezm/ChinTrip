import { z } from 'zod'

import type { TripState } from '../../types/trip'
import { calculateAmountCny, createExpenseSplits } from '../../lib/money'
import { validationError } from '../../lib/errors/server-error'

const idSchema = z.string().trim().min(1)
const optionalIdSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
const cleanString = z.string().trim()
const requiredString = cleanString.min(1)
const optionalUrl = cleanString.refine(
  (value) => !value || isValidUrl(value) || value.startsWith('data:'),
  'Введите корректную ссылку или оставьте поле пустым',
)
const dateSchema = cleanString.regex(/^\d{4}-\d{2}-\d{2}$/, 'Неверная дата')
const dateTimeSchema = cleanString.refine(
  (value) => !value || !Number.isNaN(Date.parse(value)),
  'Неверные дата и время',
)
const moneySchema = z.coerce.number().finite().positive()
const nonNegativeMoneySchema = z.coerce.number().finite().min(0)
const rateSchema = z.coerce.number().finite().positive()

export const travelerSchema = z
  .object({
    id: idSchema,
    name: requiredString,
    color: requiredString,
    sortOrder: z.coerce.number().int(),
  })
  .strict()

export const placeSchema = z
  .object({
    id: idSchema,
    name: requiredString,
    city: requiredString,
    category: requiredString,
    url: optionalUrl,
    note: cleanString,
    photoUrl: cleanString,
    status: z.enum(['want', 'done']),
    dayId: optionalIdSchema,
  })
  .strict()

export const createPlaceSchema = placeSchema.omit({ id: true, status: true }).extend({
  status: z.enum(['want', 'done']).default('want'),
})
export const updatePlaceSchema = placeSchema.partial().required({ id: true })
export const changePlaceStatusSchema = z.object({
  id: idSchema,
  status: z.enum(['want', 'done']),
})
export const assignPlaceToDaySchema = z.object({
  placeId: idSchema,
  dayId: optionalIdSchema,
})

const hotelObjectSchema = z
  .object({
    id: idSchema,
    name: requiredString,
    city: requiredString,
    address: cleanString,
    checkIn: dateSchema,
    checkOut: dateSchema,
    price: nonNegativeMoneySchema,
    currency: z.enum(['CNY', 'RUB']),
    url: optionalUrl,
    confirmationUrl: cleanString,
    note: cleanString,
    dayId: optionalIdSchema,
  })
  .strict()

export const hotelSchema = hotelObjectSchema.refine((value) => value.checkOut > value.checkIn, {
    message: 'Дата выезда должна быть позже заезда',
    path: ['checkOut'],
  })

export const createHotelSchema = hotelObjectSchema
  .omit({ id: true })
  .refine((value) => value.checkOut > value.checkIn, {
    message: 'Дата выезда должна быть позже заезда',
    path: ['checkOut'],
  })
export const updateHotelSchema = hotelObjectSchema
  .partial()
  .required({ id: true })
  .refine(
    (value) =>
      !value.checkIn ||
      !value.checkOut ||
      value.checkOut > value.checkIn,
    {
      message: 'Дата выезда должна быть позже заезда',
      path: ['checkOut'],
    },
  )

const ticketObjectSchema = z
  .object({
    id: idSchema,
    kind: z.enum(['flight', 'train', 'metro-pass']),
    fromCity: requiredString,
    toCity: requiredString,
    departAt: dateTimeSchema,
    arriveAt: dateTimeSchema,
    refNumber: cleanString,
    seat: cleanString,
    price: nonNegativeMoneySchema,
    currency: z.enum(['CNY', 'RUB']),
    url: optionalUrl,
    fileUrl: cleanString,
    dayId: optionalIdSchema,
  })
  .strict()

export const ticketSchema = ticketObjectSchema.refine(
    (value) =>
      !value.departAt ||
      !value.arriveAt ||
      new Date(value.arriveAt).getTime() > new Date(value.departAt).getTime(),
    {
      message: 'Прибытие должно быть позже отправления',
      path: ['arriveAt'],
    },
  )

export const createTicketSchema = ticketObjectSchema
  .omit({ id: true })
  .refine(
    (value) =>
      !value.departAt ||
      !value.arriveAt ||
      new Date(value.arriveAt).getTime() > new Date(value.departAt).getTime(),
    {
      message: 'Прибытие должно быть позже отправления',
      path: ['arriveAt'],
    },
  )
export const updateTicketSchema = ticketObjectSchema
  .partial()
  .required({ id: true })
  .refine(
    (value) =>
      !value.departAt ||
      !value.arriveAt ||
      new Date(value.arriveAt).getTime() > new Date(value.departAt).getTime(),
    {
      message: 'Прибытие должно быть позже отправления',
      path: ['arriveAt'],
    },
  )

export const daySchema = z
  .object({
    id: idSchema,
    date: dateSchema,
    city: requiredString,
    note: cleanString,
  })
  .strict()

export const createDaySchema = daySchema.omit({ id: true })
export const updateDaySchema = daySchema.partial().required({ id: true })

export const dayItemSchema = z
  .object({
    id: idSchema,
    dayId: idSchema,
    kind: z.enum(['place', 'hotel', 'ticket', 'note']),
    refId: idSchema,
    sortOrder: z.coerce.number().int().min(0),
    title: cleanString.optional(),
    note: cleanString.optional(),
  })
  .strict()

export const createDayItemSchema = dayItemSchema.omit({
  id: true,
  sortOrder: true,
})
export const updateDayItemSchema = dayItemSchema.partial().required({ id: true })
export const reorderDayItemsSchema = z.object({
  dayId: idSchema,
  itemIds: z.array(idSchema).min(1),
})
export const moveDayItemToAnotherDaySchema = z.object({
  id: idSchema,
  dayId: idSchema,
  sortOrder: z.coerce.number().int().min(0).optional(),
})

export const expenseSplitSchema = z
  .object({
    travelerId: idSchema,
    value: z.coerce.number().finite().min(0).optional(),
  })
  .strict()

export const expenseSchema = z
  .object({
    id: idSchema,
    payerId: idSchema,
    amount: moneySchema,
    currency: z.enum(['CNY', 'RUB']),
    exchangeRate: rateSchema,
    splitType: z.enum(['equal', 'exact', 'percentage']),
    category: requiredString,
    description: requiredString,
    spentAt: dateSchema,
    participants: z.array(expenseSplitSchema).min(1),
    dayId: optionalIdSchema,
    placeId: optionalIdSchema,
    hotelId: optionalIdSchema,
    ticketId: optionalIdSchema,
    createdBy: idSchema,
  })
  .strict()

export const createExpenseSchema = expenseSchema.omit({ id: true })
export const updateExpenseSchema = expenseSchema.partial().required({ id: true })

const paymentObjectSchema = z
  .object({
    id: idSchema,
    fromTravelerId: idSchema,
    toTravelerId: idSchema,
    amount: moneySchema,
    currency: z.enum(['CNY', 'RUB']),
    exchangeRate: rateSchema,
    status: z.enum(['planned', 'completed']),
    paidAt: dateSchema.optional(),
    note: cleanString,
  })
  .strict()

export const paymentSchema = paymentObjectSchema.refine((value) => value.fromTravelerId !== value.toTravelerId, {
    message: 'Отправитель и получатель не могут совпадать',
    path: ['toTravelerId'],
  })

export const createPaymentSchema = paymentObjectSchema
  .omit({ id: true })
  .refine((value) => value.fromTravelerId !== value.toTravelerId, {
    message: 'Отправитель и получатель не могут совпадать',
    path: ['toTravelerId'],
  })
export const updatePaymentSchema = paymentObjectSchema
  .partial()
  .required({ id: true })
  .refine(
    (value) =>
      !value.fromTravelerId ||
      !value.toTravelerId ||
      value.fromTravelerId !== value.toTravelerId,
    {
      message: 'Отправитель и получатель не могут совпадать',
      path: ['toTravelerId'],
    },
  )
export const markPaymentAsCompletedSchema = z.object({
  id: idSchema,
  completed: z.boolean().default(true),
})

export const checklistSchema = z
  .object({
    id: idSchema,
    title: requiredString,
    kind: z.enum(['notes', 'packing', 'visa', 'phrases']),
  })
  .strict()

export const createChecklistSchema = checklistSchema.omit({ id: true })
export const updateChecklistSchema = checklistSchema.partial().required({ id: true })

export const checklistItemSchema = z
  .object({
    id: idSchema,
    checklistId: idSchema,
    text: requiredString,
    done: z.boolean(),
    sortOrder: z.coerce.number().int().min(0),
  })
  .strict()

export const createChecklistItemSchema = checklistItemSchema.omit({
  id: true,
  done: true,
  sortOrder: true,
})
export const updateChecklistItemSchema = checklistItemSchema.partial().required({
  id: true,
})
export const toggleChecklistItemSchema = z.object({
  id: idSchema,
  done: z.boolean(),
})
export const reorderChecklistItemsSchema = z.object({
  checklistId: idSchema,
  itemIds: z.array(idSchema).min(1),
})

export const settingsSchema = z
  .object({
    cnyToRubRate: rateSchema,
    displayCurrency: z.enum(['CNY', 'RUB']),
    theme: z.enum(['light', 'dark', 'system']),
  })
  .strict()

export const updateTripSettingsSchema = settingsSchema.partial()

export function parseWithSchema<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) throw validationError(result.error)
  return result.data
}

export function validateExpenseBusinessRules(
  state: TripState,
  data: z.infer<typeof createExpenseSchema> | z.infer<typeof updateExpenseSchema>,
) {
  if (data.payerId && !state.travelers.some((traveler) => traveler.id === data.payerId)) {
    throw validationError(
      new z.ZodError([
        {
          code: 'custom',
          path: ['payerId'],
          message: 'Плательщик должен существовать',
        },
      ]),
    )
  }

  if (data.createdBy && !state.travelers.some((traveler) => traveler.id === data.createdBy)) {
    throw validationError(
      new z.ZodError([
        {
          code: 'custom',
          path: ['createdBy'],
          message: 'Автор должен существовать',
        },
      ]),
    )
  }

  if (data.dayId) assertExists(state.days, data.dayId, 'dayId', 'День не найден')
  if (data.placeId) assertExists(state.places, data.placeId, 'placeId', 'Место не найдено')
  if (data.hotelId) assertExists(state.hotels, data.hotelId, 'hotelId', 'Отель не найден')
  if (data.ticketId) assertExists(state.tickets, data.ticketId, 'ticketId', 'Билет не найден')

  if (data.participants) {
    const participantIds = new Set<string>()
    for (const participant of data.participants) {
      if (!state.travelers.some((traveler) => traveler.id === participant.travelerId)) {
        throw validationError(
          new z.ZodError([
            {
              code: 'custom',
              path: ['participants'],
              message: 'Все участники расхода должны существовать',
            },
          ]),
        )
      }
      participantIds.add(participant.travelerId)
    }
    if (participantIds.size !== data.participants.length) {
      throw validationError(
        new z.ZodError([
          {
            code: 'custom',
            path: ['participants'],
            message: 'Участники не должны повторяться',
          },
        ]),
      )
    }

    const amountCny =
      data.amount && data.currency && data.exchangeRate
        ? calculateAmountCny(data.amount, data.currency, data.exchangeRate)
        : undefined
    if (amountCny && data.splitType) {
      createExpenseSplits({
        expenseId: 'id' in data && data.id ? data.id : 'preview',
        amountCny,
        splitType: data.splitType,
        participants: data.participants,
      })
    }
  }
}

export function validateEntityLinks(state: TripState, data: { dayId?: string }) {
  if (data.dayId) assertExists(state.days, data.dayId, 'dayId', 'День не найден')
}

function assertExists(
  collection: Array<{ id: string }>,
  id: string,
  field: string,
  message: string,
) {
  if (collection.some((item) => item.id === id)) return
  throw validationError(
    new z.ZodError([
      {
        code: 'custom',
        path: [field],
        message,
      },
    ]),
  )
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
