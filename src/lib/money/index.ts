import type {
  Currency,
  Expense,
  ExpenseSplit,
  ExpenseSplitType,
  Payment,
  Settlement,
  Traveler,
  TravelerBalance,
  TravelerId,
} from '../../types/trip'

const MONEY_FACTOR = 100

export interface SplitInputParticipant {
  travelerId: TravelerId
  value?: number
}

export interface CreateExpenseSplitsInput {
  expenseId: string
  amountCny: number
  splitType: ExpenseSplitType
  participants: SplitInputParticipant[]
}

export function roundMoney(amount: number) {
  return fromMinor(toMinor(amount))
}

export function toMinor(amount: number) {
  return Math.round((amount + Number.EPSILON) * MONEY_FACTOR)
}

export function fromMinor(amountMinor: number) {
  return amountMinor / MONEY_FACTOR
}

export function calculateAmountCny(
  amount: number,
  currency: Currency,
  exchangeRate: number,
) {
  if (currency === 'CNY') return roundMoney(amount)
  assertPositive(exchangeRate, 'Курс должен быть больше нуля')
  return roundMoney(amount / exchangeRate)
}

export function convertFromCny(
  amountCny: number,
  currency: Currency,
  exchangeRate: number,
) {
  if (currency === 'CNY') return roundMoney(amountCny)
  return roundMoney(amountCny * exchangeRate)
}

export function createExpenseSplits({
  expenseId,
  amountCny,
  splitType,
  participants,
}: CreateExpenseSplitsInput): ExpenseSplit[] {
  if (!participants.length) {
    throw new Error('Нужно выбрать хотя бы одного участника')
  }

  const amountMinor = toMinor(amountCny)
  const amountsMinor =
    splitType === 'equal'
      ? distributeEqual(amountMinor, participants.length)
      : splitType === 'exact'
        ? distributeExact(amountMinor, participants)
        : distributePercentage(amountMinor, participants)

  return participants.map((participant, index) => ({
    id: `${expenseId}-split-${participant.travelerId}`,
    expenseId,
    travelerId: participant.travelerId,
    value:
      splitType === 'equal'
        ? fromMinor(amountsMinor[index])
        : roundMoney(participant.value ?? 0),
    amountCny: fromMinor(amountsMinor[index]),
  }))
}

export function getSplitProgressMessage(
  amountCny: number,
  splitType: ExpenseSplitType,
  participants: SplitInputParticipant[],
) {
  if (splitType === 'equal') {
    return `Распределено ${formatPlainMoney(amountCny)} из ${formatPlainMoney(amountCny)} CNY`
  }

  const total = participants.reduce((sum, participant) => {
    return sum + (Number.isFinite(participant.value) ? Number(participant.value) : 0)
  }, 0)

  if (splitType === 'percentage') {
    const diff = roundMoney(100 - total)
    if (diff === 0) return 'Распределено 100%, всё сходится'
    if (diff > 0) return `Распределено ${formatPlainMoney(total)}%, осталось ${formatPlainMoney(diff)}%`
    return `Проценты превышают 100% на ${formatPlainMoney(Math.abs(diff))}%`
  }

  const diff = roundMoney(amountCny - total)
  if (diff === 0) {
    return `Распределено ${formatPlainMoney(total)} из ${formatPlainMoney(amountCny)} CNY`
  }
  if (diff > 0) {
    return `Распределено ${formatPlainMoney(total)} из ${formatPlainMoney(amountCny)} CNY`
  }
  return `Сумма долей превышает расход на ${formatPlainMoney(Math.abs(diff))} CNY`
}

export function calculateBalances(
  travelers: Traveler[],
  expenses: Expense[],
  expenseSplits: ExpenseSplit[],
  payments: Payment[] = [],
): TravelerBalance[] {
  const totals = new Map<
    TravelerId,
    { paidMinor: number; owedMinor: number; paymentDeltaMinor: number }
  >()

  for (const traveler of travelers) {
    totals.set(traveler.id, {
      paidMinor: 0,
      owedMinor: 0,
      paymentDeltaMinor: 0,
    })
  }

  for (const expense of expenses) {
    const total = totals.get(expense.payerId)
    if (total) total.paidMinor += toMinor(expense.amountCny)

    for (const split of expenseSplits.filter(
      (candidate) => candidate.expenseId === expense.id,
    )) {
      const splitTotal = totals.get(split.travelerId)
      if (splitTotal) splitTotal.owedMinor += toMinor(split.amountCny)
    }
  }

  for (const payment of payments) {
    if (payment.status !== 'completed') continue
    const amountMinor = toMinor(payment.amountCny)
    const from = totals.get(payment.fromTravelerId)
    const to = totals.get(payment.toTravelerId)
    if (from) from.paymentDeltaMinor += amountMinor
    if (to) to.paymentDeltaMinor -= amountMinor
  }

  return travelers
    .map((traveler) => {
      const total = totals.get(traveler.id) ?? {
        paidMinor: 0,
        owedMinor: 0,
        paymentDeltaMinor: 0,
      }
      const balanceMinor =
        total.paidMinor - total.owedMinor + total.paymentDeltaMinor

      return {
        travelerId: traveler.id,
        paidCny: fromMinor(total.paidMinor),
        owedCny: fromMinor(total.owedMinor),
        paymentDeltaCny: fromMinor(total.paymentDeltaMinor),
        balanceCny: fromMinor(balanceMinor),
      }
    })
    .sort((left, right) => right.balanceCny - left.balanceCny)
}

export function calculateSettlements(balances: TravelerBalance[]): Settlement[] {
  const debtors = balances
    .filter((balance) => toMinor(balance.balanceCny) < 0)
    .map((balance) => ({
      travelerId: balance.travelerId,
      amountMinor: Math.abs(toMinor(balance.balanceCny)),
    }))
    .sort((left, right) => right.amountMinor - left.amountMinor)

  const creditors = balances
    .filter((balance) => toMinor(balance.balanceCny) > 0)
    .map((balance) => ({
      travelerId: balance.travelerId,
      amountMinor: toMinor(balance.balanceCny),
    }))
    .sort((left, right) => right.amountMinor - left.amountMinor)

  const settlements: Settlement[] = []
  let debtorIndex = 0
  let creditorIndex = 0

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]
    const creditor = creditors[creditorIndex]
    const amountMinor = Math.min(debtor.amountMinor, creditor.amountMinor)

    if (amountMinor > 0) {
      settlements.push({
        fromId: debtor.travelerId,
        toId: creditor.travelerId,
        amountCny: fromMinor(amountMinor),
      })
    }

    debtor.amountMinor -= amountMinor
    creditor.amountMinor -= amountMinor

    if (debtor.amountMinor <= 0) debtorIndex += 1
    if (creditor.amountMinor <= 0) creditorIndex += 1
  }

  return settlements
}

export function formatTripMoney(
  amountCny: number,
  currency: Currency,
  cnyToRubRate: number,
) {
  const amount = convertFromCny(amountCny, currency, cnyToRubRate)
  return formatRawMoney(amount, currency)
}

export function formatRawMoney(amount: number, currency: Currency) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'CNY' ? 2 : 0,
  }).format(amount)
}

export function formatPlainMoney(amount: number) {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 2,
  }).format(roundMoney(amount))
}

function distributeEqual(amountMinor: number, count: number) {
  const base = Math.floor(amountMinor / count)
  let remainder = amountMinor - base * count

  return Array.from({ length: count }, () => {
    const value = base + (remainder > 0 ? 1 : 0)
    remainder -= 1
    return value
  })
}

function distributeExact(
  amountMinor: number,
  participants: SplitInputParticipant[],
) {
  const values = participants.map((participant) => toMinor(participant.value ?? 0))
  const total = values.reduce((sum, value) => sum + value, 0)

  if (total !== amountMinor) {
    throw new Error('Сумма индивидуальных долей должна совпадать с расходом')
  }

  return values
}

function distributePercentage(
  amountMinor: number,
  participants: SplitInputParticipant[],
) {
  const percentTotal = participants.reduce(
    (sum, participant) => sum + roundMoney(participant.value ?? 0),
    0,
  )

  if (Math.abs(percentTotal - 100) > 0.0001) {
    throw new Error('Сумма процентов должна составлять 100%')
  }

  const rawShares = participants.map((participant, index) => {
    const raw = (amountMinor * (participant.value ?? 0)) / 100
    return {
      index,
      floor: Math.floor(raw),
      remainder: raw - Math.floor(raw),
    }
  })
  const result = rawShares.map((share) => share.floor)
  let remainder =
    amountMinor - result.reduce((sum, value) => sum + value, 0)

  for (const share of [...rawShares].sort((left, right) => right.remainder - left.remainder)) {
    if (remainder <= 0) break
    result[share.index] += 1
    remainder -= 1
  }

  return result
}

function assertPositive(value: number, message: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(message)
}

