import type {
  Currency,
  Expense,
  ExpenseShare,
  Settlement,
  Traveler,
  TravelerBalance,
} from './types'

export function toCny(amount: number, currency: Currency, cnyToRubRate: number) {
  if (currency === 'CNY') return amount
  if (!cnyToRubRate) return amount
  return amount / cnyToRubRate
}

export function fromCny(amountCny: number, currency: Currency, cnyToRubRate: number) {
  if (currency === 'CNY') return amountCny
  return amountCny * cnyToRubRate
}

export function calculateBalances(
  travelers: Traveler[],
  expenses: Expense[],
  shares: ExpenseShare[],
  cnyToRubRate: number,
): TravelerBalance[] {
  const totals = new Map(travelers.map((traveler) => [traveler.id, 0]))

  for (const expense of expenses) {
    const participantIds = shares
      .filter((share) => share.expenseId === expense.id)
      .map((share) => share.travelerId)

    if (participantIds.length === 0) continue

    const amountCny = toCny(expense.amount, expense.currency, cnyToRubRate)
    totals.set(expense.payerId, (totals.get(expense.payerId) ?? 0) + amountCny)

    const split = amountCny / participantIds.length
    for (const travelerId of participantIds) {
      totals.set(travelerId, (totals.get(travelerId) ?? 0) - split)
    }
  }

  return travelers
    .map((traveler) => ({
      travelerId: traveler.id,
      balanceCny: roundMoney(totals.get(traveler.id) ?? 0),
    }))
    .sort((left, right) => right.balanceCny - left.balanceCny)
}

export function calculateSettlements(balances: TravelerBalance[]): Settlement[] {
  const debtors = balances
    .filter((balance) => balance.balanceCny < -0.01)
    .map((balance) => ({
      travelerId: balance.travelerId,
      amount: Math.abs(balance.balanceCny),
    }))
    .sort((left, right) => right.amount - left.amount)

  const creditors = balances
    .filter((balance) => balance.balanceCny > 0.01)
    .map((balance) => ({
      travelerId: balance.travelerId,
      amount: balance.balanceCny,
    }))
    .sort((left, right) => right.amount - left.amount)

  const settlements: Settlement[] = []
  let debtorIndex = 0
  let creditorIndex = 0

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]
    const creditor = creditors[creditorIndex]
    const amount = Math.min(debtor.amount, creditor.amount)

    if (amount > 0.01) {
      settlements.push({
        fromId: debtor.travelerId,
        toId: creditor.travelerId,
        amountCny: roundMoney(amount),
      })
    }

    debtor.amount = roundMoney(debtor.amount - amount)
    creditor.amount = roundMoney(creditor.amount - amount)

    if (debtor.amount <= 0.01) debtorIndex += 1
    if (creditor.amount <= 0.01) creditorIndex += 1
  }

  return settlements
}

export function formatTripMoney(
  amountCny: number,
  currency: Currency,
  cnyToRubRate: number,
) {
  const amount = fromCny(amountCny, currency, cnyToRubRate)
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'CNY' ? 2 : 0,
  }).format(amount)
}

function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}
