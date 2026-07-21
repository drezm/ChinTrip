import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateAmountCny,
  calculateBalances,
  calculateSettlements,
  createExpenseSplits,
} from './index'
import type { Expense, Payment, Traveler } from '../../types/trip'

const travelers: Traveler[] = [
  { id: 'traveler-a', name: 'Матвей', color: '#e11d48', sortOrder: 1 },
  { id: 'traveler-b', name: 'Артур', color: '#0891b2', sortOrder: 2 },
  { id: 'traveler-c', name: 'Лера', color: '#ca8a04', sortOrder: 3 },
]

test('equal split keeps one fen remainder inside the total', () => {
  const splits = createExpenseSplits({
    expenseId: 'expense-1',
    amountCny: 100,
    splitType: 'equal',
    participants: travelers.map((traveler) => ({ travelerId: traveler.id })),
  })

  assert.deepEqual(
    splits.map((split) => split.amountCny),
    [33.34, 33.33, 33.33],
  )
  assert.equal(sum(splits.map((split) => split.amountCny)), 100)
})

test('RUB expense stores a fixed CNY amount', () => {
  assert.equal(calculateAmountCny(1140, 'RUB', 11.4), 100)
  assert.equal(calculateAmountCny(1140, 'RUB', 12), 95)
})

test('CNY expense is not affected by exchange rate', () => {
  assert.equal(calculateAmountCny(120.25, 'CNY', 99), 120.25)
})

test('exact split must match expense amount', () => {
  const splits = createExpenseSplits({
    expenseId: 'expense-2',
    amountCny: 300,
    splitType: 'exact',
    participants: [
      { travelerId: 'traveler-a', value: 150 },
      { travelerId: 'traveler-b', value: 100 },
      { travelerId: 'traveler-c', value: 50 },
    ],
  })

  assert.equal(sum(splits.map((split) => split.amountCny)), 300)
  assert.throws(() =>
    createExpenseSplits({
      expenseId: 'expense-3',
      amountCny: 300,
      splitType: 'exact',
      participants: [
        { travelerId: 'traveler-a', value: 150 },
        { travelerId: 'traveler-b', value: 100 },
      ],
    }),
  )
})

test('percentage split allocates rounding remainder', () => {
  const splits = createExpenseSplits({
    expenseId: 'expense-4',
    amountCny: 10.01,
    splitType: 'percentage',
    participants: [
      { travelerId: 'traveler-a', value: 50 },
      { travelerId: 'traveler-b', value: 30 },
      { travelerId: 'traveler-c', value: 20 },
    ],
  })

  assert.equal(sum(splits.map((split) => split.amountCny)), 10.01)
  assert.throws(() =>
    createExpenseSplits({
      expenseId: 'expense-5',
      amountCny: 300,
      splitType: 'percentage',
      participants: [
        { travelerId: 'traveler-a', value: 50 },
        { travelerId: 'traveler-b', value: 30 },
      ],
    }),
  )
})

test('completed payment reduces debt and planned payment does not', () => {
  const expense = baseExpense({ id: 'expense-6', payerId: 'traveler-a', amountCny: 300 })
  const splits = createExpenseSplits({
    expenseId: expense.id,
    amountCny: expense.amountCny,
    splitType: 'equal',
    participants: travelers.map((traveler) => ({ travelerId: traveler.id })),
  })
  const plannedPayment = basePayment({
    id: 'payment-1',
    fromTravelerId: 'traveler-b',
    toTravelerId: 'traveler-a',
    amountCny: 100,
    status: 'planned',
  })
  const completedPayment = { ...plannedPayment, status: 'completed' as const }

  const plannedSettlements = calculateSettlements(
    calculateBalances(travelers, [expense], splits, [plannedPayment]),
  )
  const completedSettlements = calculateSettlements(
    calculateBalances(travelers, [expense], splits, [completedPayment]),
  )

  assert.equal(
    plannedSettlements.find((settlement) => settlement.fromId === 'traveler-b')?.amountCny,
    100,
  )
  assert.equal(
    completedSettlements.find((settlement) => settlement.fromId === 'traveler-b'),
    undefined,
  )
})

test('several debtors and creditors are optimized into minimal transfers', () => {
  const expenses = [
    baseExpense({ id: 'expense-7', payerId: 'traveler-a', amountCny: 300 }),
    baseExpense({ id: 'expense-8', payerId: 'traveler-b', amountCny: 60 }),
  ]
  const splits = expenses.flatMap((expense) =>
    createExpenseSplits({
      expenseId: expense.id,
      amountCny: expense.amountCny,
      splitType: 'equal',
      participants: travelers.map((traveler) => ({ travelerId: traveler.id })),
    }),
  )

  const settlements = calculateSettlements(calculateBalances(travelers, expenses, splits))
  assert.deepEqual(settlements, [
    { fromId: 'traveler-c', toId: 'traveler-a', amountCny: 120 },
    { fromId: 'traveler-b', toId: 'traveler-a', amountCny: 60 },
  ])
})

test('one fen value remains balanced', () => {
  const expense = baseExpense({ id: 'expense-9', payerId: 'traveler-a', amountCny: 0.01 })
  const splits = createExpenseSplits({
    expenseId: expense.id,
    amountCny: expense.amountCny,
    splitType: 'equal',
    participants: travelers.map((traveler) => ({ travelerId: traveler.id })),
  })

  assert.equal(sum(splits.map((split) => split.amountCny)), 0.01)
})

function baseExpense(partial: Partial<Expense>): Expense {
  return {
    id: 'expense',
    payerId: 'traveler-a',
    amount: partial.amountCny ?? 100,
    currency: 'CNY',
    exchangeRate: 11.4,
    amountCny: 100,
    splitType: 'equal',
    category: 'Тест',
    description: 'Тест',
    spentAt: '2026-08-10',
    createdBy: 'traveler-a',
    createdAt: '2026-07-21T00:00:00.000Z',
    updatedAt: '2026-07-21T00:00:00.000Z',
    ...partial,
  }
}

function basePayment(partial: Partial<Payment>): Payment {
  return {
    id: 'payment',
    fromTravelerId: 'traveler-b',
    toTravelerId: 'traveler-a',
    amount: partial.amountCny ?? 100,
    currency: 'CNY',
    exchangeRate: 11.4,
    amountCny: 100,
    status: 'planned',
    note: '',
    createdAt: '2026-07-21T00:00:00.000Z',
    updatedAt: '2026-07-21T00:00:00.000Z',
    ...partial,
  }
}

function sum(values: number[]) {
  return Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100
}

