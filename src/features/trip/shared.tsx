import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  Building2,
  CalendarDays,
  Check,
  ExternalLink,
  FileText,
  ImageIcon,
  MapPin,
  Pencil,
  Plus,
  QrCode,
  Save,
  Trash2,
  X,
} from 'lucide-react'

import { Button } from '../../components/ui/button'
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  Field,
  Input,
  SelectField,
  Textarea,
} from '../../components/ui/primitives'
import { ConfirmDeleteDialog, ResponsiveModal } from '../../components/ui/overlays'
import { cn } from '../../lib/utils'
import type {
  Currency,
  Day,
  DayItem,
  Hotel,
  Place,
  PlaceSection,
  Ticket,
  Traveler,
  TripState,
} from '../../types/trip'
import { formatRawMoney } from '../../lib/money'

export function PageHeader({
  eyebrow,
  title,
  aside,
  action,
}: {
  eyebrow: string
  title: string
  aside?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
          {eyebrow}
        </p>
        <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h2>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {aside}
        {action}
      </div>
    </div>
  )
}

export function EntityModal({
  open,
  title,
  description,
  children,
  onOpenChange,
}: {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  onOpenChange: (open: boolean) => void
}) {
  return (
    <ResponsiveModal
      open={open}
      title={title}
      description={description}
      onOpenChange={onOpenChange}
    >
      {children}
    </ResponsiveModal>
  )
}

export function DeleteButton({
  title,
  description,
  onConfirm,
  children,
  className,
}: {
  title: string
  description?: string
  onConfirm: () => void
  children?: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        className={className}
        variant="ghost"
        size={children ? 'sm' : 'icon'}
        type="button"
        onClick={() => setOpen(true)}
      >
        {children ?? <Trash2 />}
      </Button>
      <ConfirmDeleteDialog
        open={open}
        title={title}
        description={description}
        onOpenChange={setOpen}
        onConfirm={() => {
          onConfirm()
          setOpen(false)
        }}
      />
    </>
  )
}

export function SubmitRow({
  onCancel,
  submitLabel = 'Сохранить',
  disabled,
}: {
  onCancel: () => void
  submitLabel?: string
  disabled?: boolean
}) {
  return (
    <div className="sticky bottom-0 -mx-1 mt-2 grid grid-cols-2 gap-2 bg-popover/95 p-1 pb-[calc(4px+env(safe-area-inset-bottom))] backdrop-blur md:static md:m-0 md:bg-transparent md:p-0">
      <Button variant="secondary" type="button" onClick={onCancel}>
        <X />
        Отмена
      </Button>
      <Button disabled={disabled} type="submit">
        <Save />
        {submitLabel}
      </Button>
    </div>
  )
}

export function CurrencySelect({ defaultValue = 'CNY' }: { defaultValue?: Currency }) {
  return (
    <SelectField name="currency" defaultValue={defaultValue}>
      <option value="CNY">CNY</option>
      <option value="RUB">RUB</option>
    </SelectField>
  )
}

export function DaySelect({
  days,
  defaultValue = '',
  required,
}: {
  days: Day[]
  defaultValue?: string
  required?: boolean
}) {
  return (
    <SelectField name="dayId" defaultValue={defaultValue} required={required}>
      <option value="">Не привязывать</option>
      {[...days]
        .sort((left, right) => left.date.localeCompare(right.date))
        .map((day) => (
          <option key={day.id} value={day.id}>
            {formatShortDate(day.date)} · {day.city}
          </option>
        ))}
    </SelectField>
  )
}

export function TravelerSelect({
  travelers,
  name,
  defaultValue,
}: {
  travelers: Traveler[]
  name: string
  defaultValue?: string
}) {
  return (
    <SelectField name={name} defaultValue={defaultValue ?? travelers[0]?.id}>
      {travelers.map((traveler) => (
        <option key={traveler.id} value={traveler.id}>
          {traveler.name}
        </option>
      ))}
    </SelectField>
  )
}

export function EntityActions({
  onEdit,
  onDelete,
  deleteTitle,
}: {
  onEdit: () => void
  onDelete: () => void
  deleteTitle: string
}) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" type="button" onClick={onEdit}>
        <Pencil />
      </Button>
      <DeleteButton title={deleteTitle} onConfirm={onDelete} />
    </div>
  )
}

export function PhotoGallery({ value }: { value: string }) {
  const [active, setActive] = useState<string | null>(null)
  const photos = parseMultilineValue(value).filter(isImageLike)

  if (!photos.length) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-muted text-muted-foreground">
        <ImageIcon className="size-7" />
      </div>
    )
  }

  return (
    <>
      <div className="flex snap-x gap-2 overflow-x-auto pb-1">
        {photos.map((photo, index) => (
          <button
            key={`${photo}-${index}`}
            type="button"
            className="relative aspect-[4/3] w-full min-w-full snap-start overflow-hidden rounded-2xl bg-muted md:min-w-64"
            onClick={() => setActive(photo)}
            aria-label={`Открыть фото ${index + 1}`}
          >
            <img
              className="size-full object-cover"
              src={photo}
              alt=""
              loading="lazy"
            />
            {photos.length > 1 ? (
              <Badge className="absolute right-2 top-2 border-white/20 bg-black/60 text-white">
                {index + 1}/{photos.length}
              </Badge>
            ) : null}
          </button>
        ))}
      </div>
      {active ? <MediaLightbox src={active} onClose={() => setActive(null)} /> : null}
    </>
  )
}

export function DocumentPreview({ value }: { value: string }) {
  if (!value) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-muted text-muted-foreground">
        <QrCode className="size-7" />
      </div>
    )
  }

  const normalized = normalizeUrl(value)
  const content = isPdf(value) ? (
    <iframe
      className="size-full rounded-2xl border-0"
      title="PDF"
      src={value}
      loading="lazy"
    />
  ) : isImageLike(value) ? (
    <img className="size-full object-cover" src={value} alt="" loading="lazy" />
  ) : (
    <div className="grid size-full place-items-center bg-muted text-muted-foreground">
      <FileText className="size-8" />
    </div>
  )

  return (
    <button
      type="button"
      className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted text-left"
      onClick={() => openDocument(value)}
      aria-label="Открыть документ"
    >
      {content}
      {!normalized && !isEmbedded(value) ? (
        <span className="block truncate p-3 text-sm text-muted-foreground">
          {value}
        </span>
      ) : null}
    </button>
  )
}

export function MediaLightbox({
  src,
  onClose,
}: {
  src: string
  onClose: () => void
}) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/90 p-3"
      role="dialog"
      aria-modal="true"
    >
      <Button
        className="absolute right-3 top-[calc(12px+env(safe-area-inset-top))] bg-white/10 text-white hover:bg-white/20"
        variant="ghost"
        size="icon-lg"
        type="button"
        onClick={onClose}
      >
        <X />
      </Button>
      <img className="max-h-full max-w-full rounded-2xl object-contain" src={src} alt="" />
    </div>
  )
}

export function InfoRow({ label, value }: { label: string; value?: ReactNode }) {
  if (!value) return null
  return (
    <div className="grid gap-1 rounded-2xl bg-muted/60 p-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <strong className="min-w-0 break-words text-sm font-medium">{value}</strong>
    </div>
  )
}

export function RouteEntityCard({
  item,
  state,
  onOpen,
  onRemove,
}: {
  item: DayItem
  state: TripState
  onOpen?: () => void
  onRemove?: () => void
}) {
  const entity = getDayItemEntity(item, state)
  const content = (
    <>
      <div className="grid size-9 place-items-center rounded-2xl bg-muted text-muted-foreground">
        {dayItemIcon(item.kind)}
      </div>
      <div className="min-w-0 text-left">
        <strong className="block truncate text-sm">{entity.title}</strong>
        <span className="block truncate text-xs text-muted-foreground">
          {entity.subtitle}
        </span>
      </div>
    </>
  )

  return (
    <div className="flex items-center gap-2 rounded-2xl bg-muted/60 p-2">
      {onOpen ? (
        <button
          className="flex min-w-0 flex-1 items-center gap-2"
          type="button"
          onClick={onOpen}
        >
          {content}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">{content}</div>
      )}
      {onRemove ? (
        <DeleteButton title="Убрать из дня" onConfirm={onRemove} />
      ) : null}
    </div>
  )
}

export function EntityDetailModal({
  open,
  item,
  state,
  onOpenChange,
}: {
  open: boolean
  item: DayItem | null
  state: TripState
  onOpenChange: (open: boolean) => void
}) {
  if (!item) return null
  const entity = getDayItemEntity(item, state)

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={entity.title}
      description={entity.subtitle}
    >
      {item.kind === 'place' ? (
        <PlaceDetails place={state.places.find((place) => place.id === item.refId)} state={state} />
      ) : null}
      {item.kind === 'hotel' ? (
        <HotelDetails hotel={state.hotels.find((hotel) => hotel.id === item.refId)} />
      ) : null}
      {item.kind === 'ticket' ? (
        <TicketDetails ticket={state.tickets.find((ticket) => ticket.id === item.refId)} />
      ) : null}
      {item.kind === 'note' ? (
        <p className="text-sm leading-6">{item.note || item.title}</p>
      ) : null}
    </ResponsiveModal>
  )
}

export function PlaceDetails({
  place,
  state,
}: {
  place?: Place
  state: TripState
}) {
  if (!place) return <p className="text-sm text-muted-foreground">Место не найдено</p>
  const day = state.days.find((candidate) => candidate.id === place.dayId)
  const section = state.placeSections.find((item) => item.id === place.category)
  return (
    <div className="grid gap-3">
      <PhotoGallery value={place.photoUrl} />
      <div className="grid grid-cols-2 gap-2">
        <InfoRow label="Город" value={place.city} />
        <InfoRow label="День" value={day ? `${formatShortDate(day.date)} · ${day.city}` : 'Не привязано'} />
        <InfoRow label="Раздел" value={section?.title ?? place.category} />
        <InfoRow label="Статус" value={place.status === 'want' ? 'Хочу' : 'Были'} />
      </div>
      {place.note ? <p className="text-sm leading-6">{place.note}</p> : null}
      <OpenLinkButton href={place.url || placeMapUrl(place)} label="Открыть карту" />
    </div>
  )
}

export function HotelDetails({ hotel }: { hotel?: Hotel }) {
  if (!hotel) return <p className="text-sm text-muted-foreground">Отель не найден</p>
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <InfoRow label="Город" value={hotel.city} />
        <InfoRow label="Даты" value={`${formatShortDate(hotel.checkIn)} - ${formatShortDate(hotel.checkOut)}`} />
        <InfoRow label="Адрес" value={hotel.address} />
        <InfoRow label="Цена" value={formatRawMoney(hotel.price, hotel.currency)} />
      </div>
      {hotel.note ? <p className="text-sm leading-6">{hotel.note}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <OpenLinkButton href={hotel.url} label="Бронь" />
        <OpenLinkButton href={hotel.confirmationUrl} label="Документ" />
      </div>
    </div>
  )
}

export function TicketDetails({ ticket }: { ticket?: Ticket }) {
  if (!ticket) return <p className="text-sm text-muted-foreground">Билет не найден</p>
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <InfoRow label="Маршрут" value={`${ticket.fromCity} - ${ticket.toCity}`} />
        <InfoRow label="Тип" value={ticketKindLabel(ticket.kind)} />
        <InfoRow label="Отправление" value={formatDateTime(ticket.departAt)} />
        <InfoRow label="Прибытие" value={formatDateTime(ticket.arriveAt)} />
        <InfoRow label="Номер" value={ticket.refNumber} />
        <InfoRow label="Места" value={ticket.seat} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <OpenLinkButton href={ticket.url} label="Ссылка" />
        <OpenLinkButton href={ticket.fileUrl} label="Файл" />
      </div>
    </div>
  )
}

export function OpenLinkButton({ href, label }: { href: string; label: string }) {
  const normalized = normalizeUrl(href)
  if (!normalized && !isEmbedded(href)) return null
  return (
    <Button variant="outline" type="button" onClick={() => openDocument(href)}>
      <ExternalLink />
      {label}
    </Button>
  )
}

export function TextInputForm({
  placeholder,
  buttonLabel,
  onSubmit,
}: {
  placeholder: string
  buttonLabel: string
  onSubmit: (value: string) => void
}) {
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const value = new FormData(form).get('value')?.toString().trim() ?? ''
        if (!value) return
        onSubmit(value)
        form.reset()
      }}
    >
      <Input name="value" placeholder={placeholder} />
      <Button type="submit" size="icon-lg" aria-label={buttonLabel}>
        <Plus />
      </Button>
    </form>
  )
}

export async function formDataWithFileValue(
  form: HTMLFormElement,
  fileField: string,
  textField: string,
  existingValue = '',
) {
  const data = new FormData(form)
  const typed = data.get(textField)?.toString().trim() ?? ''
  const files = data.getAll(fileField).filter((value): value is File => {
    return value instanceof File && value.size > 0
  })
  const embedded = await Promise.all(files.map(fileToDataUrl))
  return [typed, ...embedded, existingValue].filter(Boolean).join('\n')
}

export function getFormString(data: FormData, key: string) {
  return data.get(key)?.toString().trim() ?? ''
}

export function getFormNumber(data: FormData, key: string) {
  const value = Number(getFormString(data, key).replace(',', '.'))
  return Number.isFinite(value) ? value : 0
}

export function formatShortDate(value: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${value}T00:00:00`))
}

export function formatDateTime(value: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatWeekday(value: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
  }).format(new Date(`${value}T00:00:00`))
}

export function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

export function parseMultilineValue(value: string) {
  return value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function normalizeUrl(value: string) {
  if (!value) return ''
  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString()
    return ''
  } catch {
    return ''
  }
}

export function openDocument(value: string) {
  if (!value) return
  if (isEmbedded(value)) {
    const page = window.open('', '_blank', 'noopener,noreferrer')
    if (!page) return
    page.document.write(
      `<html><head><title>China Trip document</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#111;display:grid;place-items:center;min-height:100vh"><iframe src="${value}" style="border:0;width:100vw;height:100vh"></iframe></body></html>`,
    )
    page.document.close()
    return
  }
  const normalized = normalizeUrl(value)
  if (normalized) window.open(normalized, '_blank', 'noopener,noreferrer')
}

export function isEmbedded(value: string) {
  return value.startsWith('data:')
}

export function isImageLike(value: string) {
  return (
    value.startsWith('data:image/') ||
    /\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(value)
  )
}

export function isPdf(value: string) {
  return value.startsWith('data:application/pdf') || /\.pdf(\?.*)?$/i.test(value)
}

export function getTravelerName(travelers: Traveler[], travelerId: string) {
  return travelers.find((traveler) => traveler.id === travelerId)?.name ?? travelerId
}

export function sortedDays(days: Day[]) {
  return [...days].sort((left, right) => left.date.localeCompare(right.date))
}

export function getPlaceSections(state: TripState) {
  const categories = new Set(state.places.map((place) => place.category))
  const sections = [...state.placeSections]
  let sortOrder = sections.length
    ? Math.max(...sections.map((section) => section.sortOrder)) + 10
    : 10
  for (const category of categories) {
    if (sections.some((section) => section.id === category)) continue
    sections.push({ id: category, title: category, sortOrder })
    sortOrder += 10
  }
  return sections.sort((left, right) => left.sortOrder - right.sortOrder)
}

export function placeSectionLabel(sectionId: string, sections: PlaceSection[]) {
  return sections.find((section) => section.id === sectionId)?.title ?? sectionId
}

export function placeMapUrl(place: Place) {
  if (place.url) return place.url
  return `https://maps.apple.com/?q=${encodeURIComponent(`${place.name} ${place.city}`)}`
}

export function ticketKindLabel(kind: Ticket['kind']) {
  if (kind === 'flight') return 'Самолёт'
  if (kind === 'metro-pass') return 'Метро'
  return 'Поезд'
}

export function getDayItemEntity(item: DayItem, state: TripState) {
  if (item.kind === 'place') {
    const place = state.places.find((candidate) => candidate.id === item.refId)
    return {
      title: place?.name ?? 'Место',
      subtitle: [place?.city, place?.note].filter(Boolean).join(' · '),
    }
  }
  if (item.kind === 'hotel') {
    const hotel = state.hotels.find((candidate) => candidate.id === item.refId)
    return {
      title: hotel?.name ?? 'Отель',
      subtitle: hotel ? `${hotel.city} · ${hotel.address || 'адрес не указан'}` : '',
    }
  }
  if (item.kind === 'ticket') {
    const ticket = state.tickets.find((candidate) => candidate.id === item.refId)
    return {
      title: ticket ? `${ticket.fromCity} - ${ticket.toCity}` : 'Билет',
      subtitle: ticket ? `${ticketKindLabel(ticket.kind)} · ${formatDateTime(ticket.departAt)}` : '',
    }
  }
  return {
    title: item.title || 'Заметка',
    subtitle: item.note || '',
  }
}

function dayItemIcon(kind: DayItem['kind']) {
  if (kind === 'place') return <MapPin className="size-4" />
  if (kind === 'hotel') return <Building2 className="size-4" />
  if (kind === 'ticket') return <CalendarDays className="size-4" />
  return <FileText className="size-4" />
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsDataURL(file)
  })
}

export function SimpleCard({
  title,
  subtitle,
  icon,
  actions,
  children,
  className,
}: {
  title: string
  subtitle?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{title}</h3>
            {subtitle ? (
              <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {actions}
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  )
}

export function StatusBadge({ saved }: { saved: boolean }) {
  return (
    <Badge
      className={cn(
        saved
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-destructive/20 bg-destructive/10 text-destructive',
      )}
    >
      <Check className="size-3" />
      {saved ? 'готово' : 'в плане'}
    </Badge>
  )
}

export function formGridClass() {
  return 'grid gap-3 md:grid-cols-2'
}

export {
  Badge,
  Card,
  CardContent,
  CardHeader,
  Field,
  Input,
  SelectField,
  Textarea,
  formatRawMoney,
}
