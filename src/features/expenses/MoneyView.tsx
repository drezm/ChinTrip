import { useMemo, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  CreditCard,
  Plus,
  ReceiptText,
} from 'lucide-react'

import {
  createExpense,
  createPayment,
  deleteExpense,
  deletePayment,
  markPaymentAsCompleted,
  updateExpense,
} from '../../server/functions'
import {
  calculateAmountCny,
  calculateBalances,
  calculateSettlements,
  createExpenseSplits,
  formatPlainMoney,
  formatRawMoney,
  formatTripMoney,
  getSplitProgressMessage,
} from '../../lib/money'
import type { Expense, ExpenseSplitType, Payment } from '../../types/trip'
import type { FeatureProps } from '../trip/types'
import {
  Badge,
  Card,
  CardContent,
  CurrencySelect,
  DaySelect,
  DeleteButton,
  EntityActions,
  EntityModal,
  Field,
  Input,
  PageHeader,
  SelectField,
  SubmitRow,
  Textarea,
  TravelerSelect,
  formGridClass,
  formatShortDate,
  getFormNumber,
  getFormString,
  getTravelerName,
  todayDate,
} from '../trip/shared'
import { Button } from '../../components/ui/button'

export function MoneyView({ state, currentTravelerId, mutate }: FeatureProps) {
  const [isCreatingExpense, setIsCreatingExpense] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [isCreatingPayment, setIsCreatingPayment] = useState(false)
  const balances = useMemo(
    () =>
      calculateBalances(
        state.travelers,
        state.expenses,
        state.expenseSplits,
        state.payments,
      ),
    [state.travelers, state.expenses, state.expenseSplits, state.payments],
  )
  const settlements = useMemo(() => calculateSettlements(balances), [balances])
  const totalCny = state.expenses.reduce((sum, expense) => sum + expense.amountCny, 0)

  return (
    <section className="grid w-full min-w-0 max-w-full gap-4 overflow-x-clip">
      <PageHeader
        eyebrow="Деньги"
        title="Расходы и долги"
        aside={<Badge>{formatTripMoney(totalCny, state.settings.displayCurrency, state.settings.cnyToRubRate)}</Badge>}
        action={
          <Button type="button" size="icon-lg" onClick={() => setIsCreatingExpense(true)}>
            <Plus />
          </Button>
        }
      />

      <div className="grid min-w-0 gap-3 md:grid-cols-3">
        {balances.map((balance) => (
          <Card key={balance.travelerId}>
            <CardContent className="grid gap-2 pt-4">
              <span className="text-sm font-medium text-muted-foreground">
                {getTravelerName(state.travelers, balance.travelerId)}
              </span>
              <strong
                className={balance.balanceCny >= 0 ? 'text-emerald-600' : 'text-destructive'}
              >
                {formatTripMoney(
                  balance.balanceCny,
                  state.settings.displayCurrency,
                  state.settings.cnyToRubRate,
                )}
              </strong>
              <span className="text-xs text-muted-foreground">
                Потратил {formatTripMoney(balance.paidCny, state.settings.displayCurrency, state.settings.cnyToRubRate)}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-4">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase text-destructive">Кто кому</p>
              <h3 className="text-lg font-semibold">Оптимальные переводы</h3>
            </div>
            <Button className="shrink-0" variant="outline" type="button" onClick={() => setIsCreatingPayment(true)}>
              <CreditCard />
              Платёж
            </Button>
          </div>
          <div className="grid gap-2">
            {settlements.length ? (
              settlements.map((settlement) => (
                <div
                  className="grid min-w-0 gap-2 rounded-2xl bg-muted/60 p-3 md:grid-cols-[minmax(0,1fr)_auto]"
                  key={`${settlement.fromId}-${settlement.toId}`}
                >
                  <div className="flex min-w-0 items-center gap-2 text-sm">
                    <strong className="min-w-0 truncate">{getTravelerName(state.travelers, settlement.fromId)}</strong>
                    <ArrowRight className="size-4 text-muted-foreground" />
                    <strong className="min-w-0 truncate">{getTravelerName(state.travelers, settlement.toId)}</strong>
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <Badge>
                      {formatTripMoney(
                        settlement.amountCny,
                        state.settings.displayCurrency,
                        state.settings.cnyToRubRate,
                      )}
                    </Badge>
                    <Button
                      size="sm"
                      type="button"
                      onClick={() =>
                        void mutate(
                          'Платёж создан',
                          createPayment({
                            data: {
                              fromTravelerId: settlement.fromId,
                              toTravelerId: settlement.toId,
                              amount: settlement.amountCny,
                              currency: 'CNY',
                              exchangeRate: state.settings.cnyToRubRate,
                              status: 'planned',
                              note: 'Погашение долга',
                            },
                          }),
                          (current, payment) => ({
                            ...current,
                            payments: [payment, ...current.payments],
                          }),
                        )
                      }
                    >
                      Создать
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Балансы ровные.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3">
          {state.expenses.map((expense) => {
            const splits = state.expenseSplits.filter(
              (split) => split.expenseId === expense.id,
            )
            return (
              <Card key={expense.id}>
                <CardContent className="grid gap-3 pt-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Badge className="mb-2">{expense.category}</Badge>
                      <h3 className="line-clamp-2 break-words text-lg font-semibold leading-6 [overflow-wrap:anywhere]">
                        {expense.description}
                      </h3>
                      <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                        {formatShortDate(expense.spentAt)} · оплатил{' '}
                        {getTravelerName(state.travelers, expense.payerId)}
                      </p>
                    </div>
                    <EntityActions
                      deleteTitle="Удалить расход"
                      onEdit={() => setEditingExpense(expense)}
                      onDelete={() =>
                        void mutate(
                          'Расход удалён',
                          deleteExpense({ data: { id: expense.id } }),
                          (current) => ({
                            ...current,
                            expenses: current.expenses.filter(
                              (candidate) => candidate.id !== expense.id,
                            ),
                            expenseSplits: current.expenseSplits.filter(
                              (split) => split.expenseId !== expense.id,
                            ),
                          }),
                        )
                      }
                    />
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <Badge>{formatRawMoney(expense.amount, expense.currency)}</Badge>
                    <Badge>
                      {formatRawMoney(expense.amountCny, 'CNY')} · курс{' '}
                      {formatPlainMoney(expense.exchangeRate)}
                    </Badge>
                    <Badge>{splitTypeLabel(expense.splitType)}</Badge>
                  </div>
                  <div className="grid min-w-0 gap-1 text-sm text-muted-foreground">
                    {splits.map((split) => (
                      <span className="break-words [overflow-wrap:anywhere]" key={split.id}>
                        {getTravelerName(state.travelers, split.travelerId)}:{' '}
                        {formatRawMoney(split.amountCny, 'CNY')}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card>
          <CardContent className="grid gap-3 pt-4">
            <div>
              <p className="text-xs font-semibold uppercase text-destructive">Платежи</p>
              <h3 className="text-lg font-semibold">История</h3>
            </div>
            <div className="grid gap-2">
              {state.payments.length ? (
                state.payments.map((payment) => (
                  <PaymentRow
                    key={payment.id}
                    payment={payment}
                    state={state}
                    onToggle={() =>
                      void mutate(
                        payment.status === 'completed'
                          ? 'Платёж снова ожидает'
                          : 'Платёж закрыт',
                        markPaymentAsCompleted({
                          data: {
                            id: payment.id,
                            completed: payment.status !== 'completed',
                          },
                        }),
                        (current, updated) => ({
                          ...current,
                          payments: current.payments.map((candidate) =>
                            candidate.id === updated.id ? updated : candidate,
                          ),
                        }),
                      )
                    }
                    onDelete={() =>
                      void mutate(
                        'Платёж удалён',
                        deletePayment({ data: { id: payment.id } }),
                        (current) => ({
                          ...current,
                          payments: current.payments.filter(
                            (candidate) => candidate.id !== payment.id,
                          ),
                        }),
                      )
                    }
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Платежей пока нет.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <EntityModal
        open={isCreatingExpense}
        title="Добавить расход"
        description="Курс фиксируется в расходе и не меняется после обновления общего курса."
        onOpenChange={setIsCreatingExpense}
      >
        <ExpenseForm
          state={state}
          currentTravelerId={currentTravelerId}
          onCancel={() => setIsCreatingExpense(false)}
          onSubmit={(payload) =>
            void mutate(
              'Расход добавлен',
              createExpense({ data: payload }),
              (current, result) => ({
                ...current,
                expenses: [result.expense, ...current.expenses],
                expenseSplits: [...result.splits, ...current.expenseSplits],
              }),
            ).then(() => setIsCreatingExpense(false))
          }
        />
      </EntityModal>

      <EntityModal
        open={Boolean(editingExpense)}
        title="Редактировать расход"
        onOpenChange={(open) => !open && setEditingExpense(null)}
      >
        {editingExpense ? (
          <ExpenseForm
            state={state}
            expense={editingExpense}
            currentTravelerId={currentTravelerId}
            onCancel={() => setEditingExpense(null)}
            onSubmit={(payload) =>
              void mutate(
                'Расход сохранён',
                updateExpense({ data: { id: editingExpense.id, ...payload } }),
                (current, result) => ({
                  ...current,
                  expenses: current.expenses.map((candidate) =>
                    candidate.id === result.expense.id ? result.expense : candidate,
                  ),
                  expenseSplits: [
                    ...current.expenseSplits.filter(
                      (split) => split.expenseId !== result.expense.id,
                    ),
                    ...result.splits,
                  ],
                }),
              ).then(() => setEditingExpense(null))
            }
          />
        ) : null}
      </EntityModal>

      <EntityModal
        open={isCreatingPayment}
        title="Создать платёж"
        onOpenChange={setIsCreatingPayment}
      >
        <PaymentForm
          state={state}
          onCancel={() => setIsCreatingPayment(false)}
          onSubmit={(payload) =>
            void mutate(
              'Платёж создан',
              createPayment({ data: payload }),
              (current, payment) => ({
                ...current,
                payments: [payment, ...current.payments],
              }),
            ).then(() => setIsCreatingPayment(false))
          }
        />
      </EntityModal>
    </section>
  )
}

function ExpenseForm({
  state,
  expense,
  currentTravelerId,
  onSubmit,
  onCancel,
}: {
  state: FeatureProps['state']
  expense?: Expense
  currentTravelerId: string
  onSubmit: (payload: any) => void
  onCancel: () => void
}) {
  const existingSplits = expense
    ? state.expenseSplits.filter((split) => split.expenseId === expense.id)
    : []
  const [amount, setAmount] = useState(String(expense?.amount ?? ''))
  const [currency, setCurrency] = useState(expense?.currency ?? 'CNY')
  const [exchangeRate, setExchangeRate] = useState(
    String(expense?.exchangeRate ?? state.settings.cnyToRubRate),
  )
  const [splitType, setSplitType] = useState<ExpenseSplitType>(
    expense?.splitType ?? 'equal',
  )
  const [participants, setParticipants] = useState(() =>
    state.travelers.map((traveler) => {
      const split = existingSplits.find((item) => item.travelerId === traveler.id)
      return {
        travelerId: traveler.id,
        checked: existingSplits.length ? Boolean(split) : true,
        value: split?.value ?? '',
      }
    }),
  )
  const numericAmount = Number(amount.replace(',', '.')) || 0
  const numericRate = Number(exchangeRate.replace(',', '.')) || state.settings.cnyToRubRate
  const amountCny =
    numericAmount > 0 ? calculateAmountCny(numericAmount, currency, numericRate) : 0
  const selected = participants
    .filter((participant) => participant.checked)
    .map((participant) => ({
      travelerId: participant.travelerId,
      value:
        typeof participant.value === 'number'
          ? participant.value
          : Number(String(participant.value).replace(',', '.')) || 0,
    }))
  const preview = (() => {
    try {
      return createExpenseSplits({
        expenseId: expense?.id ?? 'preview',
        amountCny,
        splitType,
        participants: selected,
      })
    } catch {
      return []
    }
  })()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onSubmit({
      payerId: getFormString(data, 'payerId'),
      amount: numericAmount,
      currency,
      exchangeRate: numericRate,
      splitType,
      category: getFormString(data, 'category') || 'Общее',
      description: getFormString(data, 'description') || 'Трата',
      spentAt: getFormString(data, 'spentAt') || todayDate(),
      participants: selected,
      dayId: getFormString(data, 'dayId') || undefined,
      placeId: getFormString(data, 'placeId') || undefined,
      hotelId: getFormString(data, 'hotelId') || undefined,
      ticketId: getFormString(data, 'ticketId') || undefined,
      createdBy: currentTravelerId,
    })
  }

  return (
    <form className={formGridClass()} onSubmit={handleSubmit}>
      <Field label="Кто платил">
        <TravelerSelect
          travelers={state.travelers}
          name="payerId"
          defaultValue={expense?.payerId ?? currentTravelerId}
        />
      </Field>
      <Field label="Сумма">
        <Input
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </Field>
      <Field label="Валюта">
        <SelectField
          name="currency"
          value={currency}
          onChange={(event) => setCurrency(event.target.value as 'CNY' | 'RUB')}
        >
          <option value="CNY">CNY</option>
          <option value="RUB">RUB</option>
        </SelectField>
      </Field>
      <Field label="Курс в расходе">
        <Input
          name="exchangeRate"
          type="number"
          min="0.0001"
          step="0.0001"
          value={exchangeRate}
          onChange={(event) => setExchangeRate(event.target.value)}
        />
      </Field>
      <Field label="Категория">
        <Input name="category" defaultValue={expense?.category} placeholder="Еда" />
      </Field>
      <Field label="Дата">
        <Input name="spentAt" type="date" defaultValue={expense?.spentAt ?? todayDate()} />
      </Field>
      <Field className="md:col-span-2" label="Комментарий">
        <Input name="description" defaultValue={expense?.description} placeholder="Ужин, такси, билеты" />
      </Field>
      <Field label="День">
        <DaySelect days={state.days} defaultValue={expense?.dayId ?? ''} />
      </Field>
      <Field label="Привязка">
        <SelectField name="placeId" defaultValue={expense?.placeId ?? ''}>
          <option value="">Без места</option>
          {state.places.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name}
            </option>
          ))}
        </SelectField>
      </Field>
      <Field className="md:col-span-2" label="Способ разделения">
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">
          {(['equal', 'exact', 'percentage'] as ExpenseSplitType[]).map((type) => (
            <Button
              key={type}
              variant={splitType === type ? 'default' : 'secondary'}
              type="button"
              onClick={() => setSplitType(type)}
            >
              {splitTypeLabel(type)}
            </Button>
          ))}
        </div>
      </Field>
      <div className="grid gap-2 md:col-span-2">
        {participants.map((participant) => (
          <label
            className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_minmax(88px,120px)] items-center gap-2 rounded-2xl bg-muted/60 p-2 text-sm"
            key={participant.travelerId}
          >
            <input
              className="size-4 shrink-0 accent-primary"
              type="checkbox"
              checked={participant.checked}
              onChange={(event) =>
                setParticipants((current) =>
                  current.map((item) =>
                    item.travelerId === participant.travelerId
                      ? { ...item, checked: event.target.checked }
                      : item,
                  ),
                )
              }
            />
            <span className="min-w-0 truncate">
              {getTravelerName(state.travelers, participant.travelerId)}
            </span>
            <Input
              className={splitType === 'equal' ? 'opacity-50' : ''}
              disabled={splitType === 'equal' || !participant.checked}
              inputMode="decimal"
              value={participant.value}
              placeholder={splitType === 'percentage' ? '%' : 'CNY'}
              onChange={(event) =>
                setParticipants((current) =>
                  current.map((item) =>
                    item.travelerId === participant.travelerId
                      ? { ...item, value: event.target.value }
                      : item,
                  ),
                )
              }
            />
          </label>
        ))}
      </div>
      <div className="grid min-w-0 gap-2 rounded-2xl bg-muted p-3 text-sm md:col-span-2">
        <strong className="break-words [overflow-wrap:anywhere]">
          {getSplitProgressMessage(amountCny, splitType, selected)}
        </strong>
        <span className="break-words text-muted-foreground [overflow-wrap:anywhere]">
          Эквивалент: {formatRawMoney(amountCny, 'CNY')}. Текущий общий курс:{' '}
          {formatPlainMoney(state.settings.cnyToRubRate)} RUB.
        </span>
        {preview.length ? (
          <div className="flex min-w-0 flex-wrap gap-2">
            {preview.map((split) => (
              <Badge key={split.travelerId}>
                {getTravelerName(state.travelers, split.travelerId)} ·{' '}
                {formatRawMoney(split.amountCny, 'CNY')}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      <div className="md:col-span-2">
        <SubmitRow onCancel={onCancel} />
      </div>
    </form>
  )
}

function PaymentForm({
  state,
  onSubmit,
  onCancel,
}: {
  state: FeatureProps['state']
  onSubmit: (payload: any) => void
  onCancel: () => void
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const currency = getFormString(data, 'currency') as 'CNY' | 'RUB'
    const amount = getFormNumber(data, 'amount')
    const exchangeRate = getFormNumber(data, 'exchangeRate') || state.settings.cnyToRubRate
    onSubmit({
      fromTravelerId: getFormString(data, 'fromTravelerId'),
      toTravelerId: getFormString(data, 'toTravelerId'),
      amount,
      currency,
      exchangeRate,
      status: getFormString(data, 'status') as 'planned' | 'completed',
      note: getFormString(data, 'note'),
    })
  }

  return (
    <form className={formGridClass()} onSubmit={handleSubmit}>
      <Field label="Кто переводит">
        <TravelerSelect travelers={state.travelers} name="fromTravelerId" />
      </Field>
      <Field label="Кому">
        <TravelerSelect travelers={state.travelers} name="toTravelerId" />
      </Field>
      <Field label="Сумма">
        <Input name="amount" type="number" min="0.01" step="0.01" required />
      </Field>
      <Field label="Валюта">
        <CurrencySelect />
      </Field>
      <Field label="Курс">
        <Input
          name="exchangeRate"
          type="number"
          min="0.0001"
          step="0.0001"
          defaultValue={state.settings.cnyToRubRate}
        />
      </Field>
      <Field label="Статус">
        <SelectField name="status" defaultValue="planned">
          <option value="planned">Ожидает</option>
          <option value="completed">Оплачен</option>
        </SelectField>
      </Field>
      <Field className="md:col-span-2" label="Заметка">
        <Textarea name="note" placeholder="Например: перевод в T-bank" />
      </Field>
      <div className="md:col-span-2">
        <SubmitRow onCancel={onCancel} />
      </div>
    </form>
  )
}

function PaymentRow({
  payment,
  state,
  onToggle,
  onDelete,
}: {
  payment: Payment
  state: FeatureProps['state']
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className="grid gap-2 rounded-2xl bg-muted/60 p-3 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <strong className="min-w-0 truncate">{getTravelerName(state.travelers, payment.fromTravelerId)}</strong>
        <ArrowRight className="size-4 text-muted-foreground" />
        <strong className="min-w-0 truncate">{getTravelerName(state.travelers, payment.toTravelerId)}</strong>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge>{formatRawMoney(payment.amount, payment.currency)}</Badge>
        <Badge>{payment.status === 'completed' ? 'оплачен' : 'ожидает'}</Badge>
        <Button variant="outline" size="sm" type="button" onClick={onToggle}>
          <Check />
          {payment.status === 'completed' ? 'Отменить' : 'Оплачено'}
        </Button>
        <DeleteButton title="Удалить платёж" onConfirm={onDelete} />
      </div>
      {payment.note ? (
        <p className="break-words text-muted-foreground [overflow-wrap:anywhere]">
          {payment.note}
        </p>
      ) : null}
    </div>
  )
}

function splitTypeLabel(splitType: ExpenseSplitType) {
  if (splitType === 'exact') return 'Точно'
  if (splitType === 'percentage') return 'Проценты'
  return 'Поровну'
}
