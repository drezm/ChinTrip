import { useMemo, useState } from 'react'
import { Calculator, Repeat2 } from 'lucide-react'

import { Button } from '../ui/button'
import type { Currency, Settings } from '../../types/trip'
import {
  Badge,
  EntityModal,
  Field,
  Input,
  SelectField,
  formatDateTime,
  formatRawMoney,
} from '../../features/trip/shared'
import { convertFromCny, roundMoney } from '../../lib/money'

export function CurrencyCalculator({ settings }: { settings: Settings }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('100')
  const [fromCurrency, setFromCurrency] = useState<Currency>('CNY')
  const [toCurrency, setToCurrency] = useState<Currency>('RUB')

  const result = useMemo(() => {
    const value = Number(amount.replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) return 0
    if (fromCurrency === toCurrency) return roundMoney(value)
    if (fromCurrency === 'CNY') return convertFromCny(value, 'RUB', settings.cnyToRubRate)
    return roundMoney(value / settings.cnyToRubRate)
  }, [amount, fromCurrency, settings.cnyToRubRate, toCurrency])

  function swapCurrencies() {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
  }

  return (
    <>
      <Button
        className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-40 rounded-full shadow-lg md:bottom-6 md:right-6"
        type="button"
        size="icon-lg"
        aria-label="Открыть калькулятор валют"
        onClick={() => setOpen(true)}
      >
        <Calculator />
      </Button>

      <EntityModal open={open} title="Калькулятор валют" onOpenChange={setOpen}>
        <div className="grid gap-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <Field label="Из">
              <SelectField
                name="fromCurrency"
                value={fromCurrency}
                onChange={(event) => setFromCurrency(event.currentTarget.value as Currency)}
              >
                <option value="CNY">CNY</option>
                <option value="RUB">RUB</option>
              </SelectField>
            </Field>
            <Button
              variant="secondary"
              type="button"
              size="icon-lg"
              aria-label="Поменять валюты местами"
              onClick={swapCurrencies}
            >
              <Repeat2 />
            </Button>
            <Field label="В">
              <SelectField
                name="toCurrency"
                value={toCurrency}
                onChange={(event) => setToCurrency(event.currentTarget.value as Currency)}
              >
                <option value="RUB">RUB</option>
                <option value="CNY">CNY</option>
              </SelectField>
            </Field>
          </div>
          <Field label="Сумма">
            <Input
              name="amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.currentTarget.value)}
            />
          </Field>
          <div className="rounded-3xl border bg-muted/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Итого</span>
              <Badge>1 CNY = {settings.cnyToRubRate.toFixed(2)} RUB</Badge>
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight">
              {formatRawMoney(result, toCurrency)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Курс обновлён {formatDateTime(settings.rateUpdatedAt)}
            </p>
          </div>
        </div>
      </EntityModal>
    </>
  )
}
