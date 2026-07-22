import { useState, type FormEvent } from 'react'
import { CalendarPlus } from 'lucide-react'

import {
  createDay,
  createDayItem,
  deleteDay,
  deleteDayItem,
  updateDay,
  updateDayItem,
} from '../../server/functions'
import type { Day, DayItem } from '../../types/trip'
import type { FeatureProps } from '../trip/types'
import {
  DeleteButton,
  EntityActions,
  EntityDetailModal,
  EntityModal,
  Field,
  Input,
  PageHeader,
  RouteEntityCard,
  SubmitRow,
  Textarea,
  TextInputForm,
  formatShortDate,
  formatWeekday,
  formGridClass,
  getFormString,
  sortedDays,
} from '../trip/shared'
import { Button } from '../../components/ui/button'
import { Badge, Card, CardContent } from '../../components/ui/primitives'

export function RouteView({ state, mutate }: FeatureProps) {
  const [editingDay, setEditingDay] = useState<Day | null>(null)
  const [isCreatingDay, setIsCreatingDay] = useState(false)
  const [detailItem, setDetailItem] = useState<DayItem | null>(null)
  const days = sortedDays(state.days)

  return (
    <section className="grid w-full min-w-0 max-w-full gap-4 overflow-x-clip">
      <PageHeader
        eyebrow="Маршрут"
        title="Дни поездки"
        aside={<Badge>{days.length} дней</Badge>}
        action={
          <Button type="button" size="icon-lg" onClick={() => setIsCreatingDay(true)}>
            <CalendarPlus />
          </Button>
        }
      />

      <div className="grid gap-3">
        {days.map((day, index) => {
          const items = state.dayItems
            .filter((item) => item.dayId === day.id)
            .sort((left, right) => left.sortOrder - right.sortOrder)
          return (
            <Card key={day.id} className="overflow-hidden">
              <CardContent className="grid gap-3 pt-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                      <span className="text-sm font-semibold">{index + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-semibold">{day.city}</h3>
                      <p className="truncate text-sm text-muted-foreground">
                        {formatShortDate(day.date)} · {formatWeekday(day.date)}
                      </p>
                    </div>
                  </div>
                  <EntityActions
                    deleteTitle="Удалить день"
                    onEdit={() => setEditingDay(day)}
                    onDelete={() =>
                      void mutate(
                        'День удалён',
                        deleteDay({ data: { id: day.id } }),
                        (current) => ({
                          ...current,
                          days: current.days.filter((candidate) => candidate.id !== day.id),
                          dayItems: current.dayItems.filter(
                            (item) => item.dayId !== day.id,
                          ),
                          places: current.places.map((place) =>
                            place.dayId === day.id
                              ? { ...place, dayId: undefined }
                              : place,
                          ),
                        }),
                      )
                    }
                  />
                </div>
                {day.note ? (
                  <p className="break-words rounded-2xl bg-muted/60 p-3 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                    {day.note}
                  </p>
                ) : null}
                <div className="grid gap-2">
                  {items.length ? (
                    items.map((item) => (
                      <RouteEntityCard
                        key={item.id}
                        item={item}
                        state={state}
                        onOpen={() => setDetailItem(item)}
                        onRemove={() =>
                          void mutate(
                            'Элемент удалён',
                            deleteDayItem({ data: { id: item.id } }),
                            (current) => ({
                              ...current,
                              dayItems: current.dayItems.filter(
                                (candidate) => candidate.id !== item.id,
                              ),
                            }),
                          )
                        }
                      />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Пока нет пунктов.</p>
                  )}
                </div>
                <NoteForm
                  dayId={day.id}
                  onCreate={(note) =>
                    void mutate(
                      'Заметка добавлена',
                      createDayItem({
                        data: {
                          dayId: day.id,
                          kind: 'note',
                          refId: `note-${Date.now()}`,
                          title: 'Заметка',
                          note,
                        },
                      }),
                      (current, item) => ({
                        ...current,
                        dayItems: [...current.dayItems, item],
                      }),
                    )
                  }
                />
              </CardContent>
            </Card>
          )
        })}
      </div>

      <EntityModal
        open={isCreatingDay}
        title="Добавить день"
        description="Новый день появится в маршруте и будет доступен для привязки мест."
        onOpenChange={setIsCreatingDay}
      >
        <DayForm
          onCancel={() => setIsCreatingDay(false)}
          onSubmit={(payload) =>
            void mutate(
              'День добавлен',
              createDay({ data: payload }),
              (current, day) => ({
                ...current,
                days: [...current.days, day],
              }),
            ).then(() => setIsCreatingDay(false))
          }
        />
      </EntityModal>

      <EntityModal
        open={Boolean(editingDay)}
        title="Редактировать день"
        onOpenChange={(open) => !open && setEditingDay(null)}
      >
        {editingDay ? (
          <DayForm
            day={editingDay}
            onCancel={() => setEditingDay(null)}
            onSubmit={(payload) =>
              void mutate(
                'День сохранён',
                updateDay({ data: { id: editingDay.id, ...payload } }),
                (current, day) => ({
                  ...current,
                  days: current.days.map((candidate) =>
                    candidate.id === day.id ? day : candidate,
                  ),
                }),
              ).then(() => setEditingDay(null))
            }
          />
        ) : null}
      </EntityModal>

      <EntityDetailModal
        open={Boolean(detailItem)}
        item={detailItem}
        state={state}
        onOpenChange={(open) => !open && setDetailItem(null)}
      />
    </section>
  )
}

function DayForm({
  day,
  onSubmit,
  onCancel,
}: {
  day?: Day
  onSubmit: (payload: { date: string; city: string; note: string }) => void
  onCancel: () => void
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onSubmit({
      date: getFormString(data, 'date'),
      city: getFormString(data, 'city'),
      note: getFormString(data, 'note'),
    })
  }

  return (
    <form className={formGridClass()} onSubmit={handleSubmit}>
      <Field label="Дата">
        <Input name="date" type="date" defaultValue={day?.date} required />
      </Field>
      <Field label="Город">
        <Input name="city" defaultValue={day?.city} placeholder="Гуанчжоу" required />
      </Field>
      <Field className="md:col-span-2" label="Заметка">
        <Textarea name="note" defaultValue={day?.note} placeholder="Переезд, прогулка, бронь" />
      </Field>
      <div className="md:col-span-2">
        <SubmitRow onCancel={onCancel} />
      </div>
    </form>
  )
}

function NoteForm({
  dayId,
  onCreate,
}: {
  dayId: string
  onCreate: (note: string) => void
}) {
  return (
    <TextInputForm
      placeholder="Заметка к дню"
      buttonLabel={`Добавить заметку ${dayId}`}
      onSubmit={onCreate}
    />
  )
}
