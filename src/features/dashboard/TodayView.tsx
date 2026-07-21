import { CheckSquare, Clock, Hotel, MapPin } from 'lucide-react'

import { toggleChecklistItem } from '../../server/functions'
import type { FeatureProps } from '../trip/types'
import {
  Badge,
  Card,
  CardContent,
  PageHeader,
  RouteEntityCard,
  formatShortDate,
  formatWeekday,
  sortedDays,
  todayDate,
} from '../trip/shared'

export function TodayView({
  state,
  mutate,
}: FeatureProps) {
  const days = sortedDays(state.days)
  const today = todayDate()
  const activeDay =
    days.find((day) => day.date === today) ??
    days.find((day) => day.date >= today) ??
    days[days.length - 1]
  const dayItems = activeDay
    ? state.dayItems
        .filter((item) => item.dayId === activeDay.id)
        .sort((left, right) => left.sortOrder - right.sortOrder)
    : []
  const currentHotel = state.hotels.find((hotel) => {
    return hotel.checkIn <= (activeDay?.date ?? today) && hotel.checkOut >= (activeDay?.date ?? today)
  })
  const openChecklistItems = state.checklistItems
    .filter((item) => !item.done)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, 6)

  return (
    <section className="grid gap-4">
      <PageHeader
        eyebrow={activeDay?.date === today ? 'Сегодня' : 'Ближайший день'}
        title={activeDay ? activeDay.city : 'План поездки'}
        aside={activeDay ? <Badge>{formatWeekday(activeDay.date)}</Badge> : null}
      />

      <Card>
        <CardContent className="grid grid-cols-3 gap-2 p-3">
          <TimeStat label="Дата" value={formatShortDate(activeDay?.date ?? today)} />
          <TimeStat label="МСК" value={formatZonedTime('Europe/Moscow')} />
          <TimeStat label="Гуанчжоу" value={formatZonedTime('Asia/Shanghai')} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardContent className="grid gap-3 pt-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase text-destructive">План</p>
                <h3 className="text-lg font-semibold">На день</h3>
              </div>
              <MapPin className="size-5 text-muted-foreground" />
            </div>
            {activeDay?.note ? (
              <p className="rounded-2xl bg-muted p-3 text-sm leading-6 text-muted-foreground">
                {activeDay.note}
              </p>
            ) : null}
            <div className="grid gap-2">
              {dayItems.length ? (
                dayItems.map((item) => (
                  <RouteEntityCard key={item.id} item={item} state={state} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  На этот день пока ничего не привязано.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardContent className="grid gap-3 pt-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-destructive">База</p>
                  <h3 className="text-lg font-semibold">Отель</h3>
                </div>
                <Hotel className="size-5 text-muted-foreground" />
              </div>
              {currentHotel ? (
                <div className="grid gap-1">
                  <strong>{currentHotel.name}</strong>
                  <span className="text-sm text-muted-foreground">
                    {currentHotel.city} · {currentHotel.address || 'адрес не указан'}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Отель на этот день не выбран.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-3 pt-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-destructive">Чеклист</p>
                  <h3 className="text-lg font-semibold">Открытые дела</h3>
                </div>
                <CheckSquare className="size-5 text-muted-foreground" />
              </div>
              <div className="grid gap-2">
                {openChecklistItems.length ? (
                  openChecklistItems.map((item) => (
                    <label
                      className="flex min-h-11 items-center gap-3 rounded-2xl bg-muted/60 px-3 text-sm"
                      key={item.id}
                    >
                      <input
                        className="size-4 accent-primary"
                        type="checkbox"
                        checked={item.done}
                        onChange={(event) => {
                          const done = event.target.checked
                          void mutate(
                            'Пункт обновлён',
                            toggleChecklistItem({ data: { id: item.id, done } }),
                            (current, updated) => ({
                              ...current,
                              checklistItems: current.checklistItems.map((candidate) =>
                                candidate.id === updated.id ? updated : candidate,
                              ),
                            }),
                            (current) => ({
                              ...current,
                              checklistItems: current.checklistItems.map((candidate) =>
                                candidate.id === item.id
                                  ? { ...candidate, done }
                                  : candidate,
                              ),
                            }),
                          )
                        }}
                      />
                      <span>{item.text}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Все открытые пункты закрыты.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

function TimeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-muted/60 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Clock className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <strong className="mt-1 block truncate text-base leading-tight">{value}</strong>
    </div>
  )
}

function formatZonedTime(timeZone: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date())
}
