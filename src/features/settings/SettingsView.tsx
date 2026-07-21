import { useState } from 'react'
import { LockKeyhole, RefreshCw } from 'lucide-react'

import { refreshExchangeRate, updateTripSettings } from '../../server/functions'
import { Button } from '../../components/ui/button'
import type { FeatureProps } from '../trip/types'
import {
  Badge,
  Card,
  CardContent,
  Field,
  Input,
  PageHeader,
  SelectField,
  formGridClass,
  getFormNumber,
  getFormString,
} from '../trip/shared'

export function SettingsView({
  state,
  mutate,
  currentTravelerId,
  onTravelerChange,
  onLock,
}: Pick<FeatureProps, 'state' | 'mutate'> & {
  currentTravelerId: string
  onTravelerChange: (travelerId: string) => void
  onLock: () => void
}) {
  const [refreshing, setRefreshing] = useState(false)

  return (
    <section className="grid w-full min-w-0 max-w-full gap-4 overflow-x-clip">
      <PageHeader
        eyebrow="Настройки"
        title="Поездка"
        aside={<Badge>1 CNY = {state.settings.cnyToRubRate.toFixed(2)} RUB</Badge>}
      />
      <Card>
        <CardContent className="grid gap-3 pt-4">
          <h3 className="text-lg font-semibold">Я сейчас</h3>
          <div className="grid min-w-0 grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
            {state.travelers.map((traveler) => (
              <Button
                className="min-w-0"
                key={traveler.id}
                variant={currentTravelerId === traveler.id ? 'default' : 'secondary'}
                type="button"
                onClick={() => onTravelerChange(traveler.id)}
              >
                {traveler.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="grid gap-3 pt-4">
          <form
            className={formGridClass()}
            onSubmit={(event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              void mutate(
                'Настройки сохранены',
                updateTripSettings({
                  data: {
                    cnyToRubRate: getFormNumber(data, 'cnyToRubRate'),
                    displayCurrency: getFormString(data, 'displayCurrency') as 'CNY' | 'RUB',
                    theme: getFormString(data, 'theme') as 'light' | 'dark' | 'system',
                  },
                }),
                (current, settings) => ({ ...current, settings }),
              )
            }}
          >
            <Field label="Курс CNY/RUB">
              <Input
                name="cnyToRubRate"
                type="number"
                min="0.0001"
                step="0.0001"
                defaultValue={state.settings.cnyToRubRate}
              />
            </Field>
            <Field label="Валюта показа">
              <SelectField name="displayCurrency" defaultValue={state.settings.displayCurrency}>
                <option value="CNY">CNY</option>
                <option value="RUB">RUB</option>
              </SelectField>
            </Field>
            <Field label="Тема">
              <SelectField name="theme" defaultValue={state.settings.theme}>
                <option value="system">Системная</option>
                <option value="light">Светлая</option>
                <option value="dark">Тёмная</option>
              </SelectField>
            </Field>
            <div className="grid content-end gap-2">
              <Button type="submit">Сохранить</Button>
            </div>
          </form>
          <div className="flex min-w-0 flex-wrap gap-2">
            <Button
              variant="outline"
              type="button"
              disabled={refreshing}
              onClick={() => {
                setRefreshing(true)
                void mutate(
                  'Курс обновлён',
                  refreshExchangeRate(),
                  (current, settings) => ({ ...current, settings }),
                ).finally(() => setRefreshing(false))
              }}
            >
              <RefreshCw className={refreshing ? 'animate-spin' : ''} />
              Обновить курс
            </Button>
            <Button variant="destructive" type="button" onClick={onLock}>
              <LockKeyhole />
              Заблокировать
            </Button>
          </div>
          <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
            Если сети нет, конвертер и новые расходы используют последний сохранённый курс.
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
