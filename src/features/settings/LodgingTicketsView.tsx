import { useState } from 'react'
import { Bed, Plus, Ticket as TicketIcon } from 'lucide-react'

import {
  createHotel,
  createTicket,
  deleteHotel,
  deleteTicket,
  updateHotel,
  updateTicket,
} from '../../server/functions'
import type { Hotel, Ticket } from '../../types/trip'
import { Button } from '../../components/ui/button'
import type { FeatureProps } from '../trip/types'
import {
  Badge,
  Card,
  CardContent,
  CurrencySelect,
  DaySelect,
  EntityActions,
  EntityModal,
  Field,
  Input,
  OpenLinkButton,
  PageHeader,
  SelectField,
  SimpleCard,
  SubmitRow,
  Textarea,
  formGridClass,
  formatDateTime,
  formatRawMoney,
  formatShortDate,
  getFormNumber,
  getFormString,
} from '../trip/shared'

export function HotelsView({ state, mutate }: Pick<FeatureProps, 'state' | 'mutate'>) {
  const [editing, setEditing] = useState<Hotel | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <EntityList title="Отели" count={state.hotels.length} onCreate={() => setCreating(true)}>
      {state.hotels.map((hotel) => (
        <SimpleCard
          key={hotel.id}
          title={hotel.name}
          subtitle={`${hotel.city} · ${formatShortDate(hotel.checkIn)}-${formatShortDate(hotel.checkOut)}`}
          icon={<Bed className="size-5" />}
          actions={
            <EntityActions
              deleteTitle="Удалить отель"
              onEdit={() => setEditing(hotel)}
              onDelete={() =>
                void mutate(
                  'Отель удалён',
                  deleteHotel({ data: { id: hotel.id } }),
                  (current) => ({
                    ...current,
                    hotels: current.hotels.filter((candidate) => candidate.id !== hotel.id),
                    dayItems: current.dayItems.filter(
                      (item) => !(item.kind === 'hotel' && item.refId === hotel.id),
                    ),
                  }),
                )
              }
            />
          }
        >
          <div className="grid gap-2 text-sm">
            {hotel.address ? <span>{hotel.address}</span> : null}
            <span className="text-muted-foreground">
              {formatRawMoney(hotel.price, hotel.currency)}
            </span>
            <div className="flex flex-wrap gap-2">
              <OpenLinkButton href={hotel.url} label="Бронь" />
              <OpenLinkButton href={hotel.confirmationUrl} label="Документ" />
            </div>
          </div>
        </SimpleCard>
      ))}
      <HotelModal state={state} open={creating} onOpenChange={setCreating} mutate={mutate} />
      <HotelModal
        state={state}
        hotel={editing ?? undefined}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        mutate={mutate}
      />
    </EntityList>
  )
}

export function TicketsView({ state, mutate }: Pick<FeatureProps, 'state' | 'mutate'>) {
  const [editing, setEditing] = useState<Ticket | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <EntityList title="Билеты" count={state.tickets.length} onCreate={() => setCreating(true)}>
      {state.tickets.map((ticket) => (
        <SimpleCard
          key={ticket.id}
          title={`${ticket.fromCity} - ${ticket.toCity}`}
          subtitle={`${ticket.kind} · ${formatDateTime(ticket.departAt)}`}
          icon={<TicketIcon className="size-5" />}
          actions={
            <EntityActions
              deleteTitle="Удалить билет"
              onEdit={() => setEditing(ticket)}
              onDelete={() =>
                void mutate(
                  'Билет удалён',
                  deleteTicket({ data: { id: ticket.id } }),
                  (current) => ({
                    ...current,
                    tickets: current.tickets.filter((candidate) => candidate.id !== ticket.id),
                    dayItems: current.dayItems.filter(
                      (item) => !(item.kind === 'ticket' && item.refId === ticket.id),
                    ),
                  }),
                )
              }
            />
          }
        >
          <div className="flex flex-wrap gap-2">
            <OpenLinkButton href={ticket.url} label="Ссылка" />
            <OpenLinkButton href={ticket.fileUrl} label="Файл" />
          </div>
        </SimpleCard>
      ))}
      <TicketModal state={state} open={creating} onOpenChange={setCreating} mutate={mutate} />
      <TicketModal
        state={state}
        ticket={editing ?? undefined}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        mutate={mutate}
      />
    </EntityList>
  )
}

function HotelModal({
  state,
  hotel,
  open,
  onOpenChange,
  mutate,
}: {
  state: FeatureProps['state']
  hotel?: Hotel
  open: boolean
  onOpenChange: (open: boolean) => void
  mutate: FeatureProps['mutate']
}) {
  return (
    <EntityModal
      open={open}
      title={hotel ? 'Редактировать отель' : 'Добавить отель'}
      onOpenChange={onOpenChange}
    >
      <HotelForm
        state={state}
        hotel={hotel}
        onCancel={() => onOpenChange(false)}
        onSubmit={(payload) =>
          void mutate(
            hotel ? 'Отель сохранён' : 'Отель добавлен',
            hotel
              ? updateHotel({ data: { id: hotel.id, ...payload } })
              : createHotel({ data: payload }),
            (current, result) => ({
              ...current,
              hotels: hotel
                ? current.hotels.map((candidate) =>
                    candidate.id === result.id ? result : candidate,
                  )
                : [...current.hotels, result],
            }),
          ).then(() => onOpenChange(false))
        }
      />
    </EntityModal>
  )
}

function HotelForm({
  state,
  hotel,
  onSubmit,
  onCancel,
}: {
  state: FeatureProps['state']
  hotel?: Hotel
  onSubmit: (payload: Record<string, unknown>) => void
  onCancel: () => void
}) {
  return (
    <form
      className={formGridClass()}
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        onSubmit({
          name: getFormString(data, 'name'),
          city: getFormString(data, 'city'),
          address: getFormString(data, 'address'),
          checkIn: getFormString(data, 'checkIn'),
          checkOut: getFormString(data, 'checkOut'),
          price: getFormNumber(data, 'price'),
          currency: getFormString(data, 'currency'),
          url: getFormString(data, 'url'),
          confirmationUrl: getFormString(data, 'confirmationUrl'),
          note: getFormString(data, 'note'),
          dayId: getFormString(data, 'dayId') || undefined,
        })
      }}
    >
      <Field label="Отель">
        <Input name="name" defaultValue={hotel?.name} required />
      </Field>
      <Field label="Город">
        <Input name="city" defaultValue={hotel?.city} required />
      </Field>
      <Field label="Заезд">
        <Input name="checkIn" type="date" defaultValue={hotel?.checkIn} required />
      </Field>
      <Field label="Выезд">
        <Input name="checkOut" type="date" defaultValue={hotel?.checkOut} required />
      </Field>
      <Field label="Цена">
        <Input name="price" type="number" min="0" step="0.01" defaultValue={hotel?.price} />
      </Field>
      <Field label="Валюта">
        <CurrencySelect defaultValue={hotel?.currency} />
      </Field>
      <Field label="День">
        <DaySelect days={state.days} defaultValue="" />
      </Field>
      <Field label="Бронь">
        <Input name="url" defaultValue={hotel?.url} />
      </Field>
      <Field className="md:col-span-2" label="Адрес">
        <Input name="address" defaultValue={hotel?.address} />
      </Field>
      <Field className="md:col-span-2" label="Документ">
        <Input name="confirmationUrl" defaultValue={hotel?.confirmationUrl} />
      </Field>
      <Field className="md:col-span-2" label="Заметка">
        <Textarea name="note" defaultValue={hotel?.note} />
      </Field>
      <div className="md:col-span-2">
        <SubmitRow onCancel={onCancel} />
      </div>
    </form>
  )
}

function TicketModal({
  state,
  ticket,
  open,
  onOpenChange,
  mutate,
}: {
  state: FeatureProps['state']
  ticket?: Ticket
  open: boolean
  onOpenChange: (open: boolean) => void
  mutate: FeatureProps['mutate']
}) {
  return (
    <EntityModal
      open={open}
      title={ticket ? 'Редактировать билет' : 'Добавить билет'}
      onOpenChange={onOpenChange}
    >
      <TicketForm
        state={state}
        ticket={ticket}
        onCancel={() => onOpenChange(false)}
        onSubmit={(payload) =>
          void mutate(
            ticket ? 'Билет сохранён' : 'Билет добавлен',
            ticket
              ? updateTicket({ data: { id: ticket.id, ...payload } })
              : createTicket({ data: payload }),
            (current, result) => ({
              ...current,
              tickets: ticket
                ? current.tickets.map((candidate) =>
                    candidate.id === result.id ? result : candidate,
                  )
                : [...current.tickets, result],
            }),
          ).then(() => onOpenChange(false))
        }
      />
    </EntityModal>
  )
}

function TicketForm({
  state,
  ticket,
  onSubmit,
  onCancel,
}: {
  state: FeatureProps['state']
  ticket?: Ticket
  onSubmit: (payload: Record<string, unknown>) => void
  onCancel: () => void
}) {
  return (
    <form
      className={formGridClass()}
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        onSubmit({
          kind: getFormString(data, 'kind'),
          fromCity: getFormString(data, 'fromCity'),
          toCity: getFormString(data, 'toCity'),
          departAt: getFormString(data, 'departAt'),
          arriveAt: getFormString(data, 'arriveAt'),
          refNumber: getFormString(data, 'refNumber'),
          seat: getFormString(data, 'seat'),
          price: getFormNumber(data, 'price'),
          currency: getFormString(data, 'currency'),
          url: getFormString(data, 'url'),
          fileUrl: getFormString(data, 'fileUrl'),
          dayId: getFormString(data, 'dayId') || undefined,
        })
      }}
    >
      <Field label="Тип">
        <SelectField name="kind" defaultValue={ticket?.kind ?? 'train'}>
          <option value="flight">Самолёт</option>
          <option value="train">Поезд</option>
          <option value="metro-pass">Метро</option>
        </SelectField>
      </Field>
      <Field label="Откуда">
        <Input name="fromCity" defaultValue={ticket?.fromCity} required />
      </Field>
      <Field label="Куда">
        <Input name="toCity" defaultValue={ticket?.toCity} required />
      </Field>
      <Field label="Отправление">
        <Input name="departAt" type="datetime-local" defaultValue={ticket?.departAt} />
      </Field>
      <Field label="Прибытие">
        <Input name="arriveAt" type="datetime-local" defaultValue={ticket?.arriveAt} />
      </Field>
      <Field label="Номер">
        <Input name="refNumber" defaultValue={ticket?.refNumber} />
      </Field>
      <Field label="Места">
        <Input name="seat" defaultValue={ticket?.seat} />
      </Field>
      <Field label="Цена">
        <Input name="price" type="number" min="0" step="0.01" defaultValue={ticket?.price} />
      </Field>
      <Field label="Валюта">
        <CurrencySelect defaultValue={ticket?.currency} />
      </Field>
      <Field label="День">
        <DaySelect days={state.days} defaultValue="" />
      </Field>
      <Field label="Ссылка">
        <Input name="url" defaultValue={ticket?.url} />
      </Field>
      <Field label="Файл">
        <Input name="fileUrl" defaultValue={ticket?.fileUrl} />
      </Field>
      <div className="md:col-span-2">
        <SubmitRow onCancel={onCancel} />
      </div>
    </form>
  )
}

function EntityList({
  title,
  count,
  onCreate,
  children,
}: {
  title: string
  count: number
  onCreate: () => void
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-4">
      <PageHeader
        eyebrow="Список"
        title={title}
        aside={<Badge>{count}</Badge>}
        action={
          <Button type="button" size="icon-lg" onClick={onCreate}>
            <Plus />
          </Button>
        }
      />
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  )
}
