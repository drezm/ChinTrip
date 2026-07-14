import {
  Building2,
  CalendarDays,
  CalendarPlus,
  Check,
  CircleDollarSign,
  ExternalLink,
  ImageIcon,
  KeyRound,
  Landmark,
  ListChecks,
  Loader2,
  LockKeyhole,
  Map,
  MapPin,
  NotebookPen,
  Pencil,
  Plane,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Settings,
  ShoppingBag,
  Ticket,
  Train,
  Trash2,
  UserRound,
  Utensils,
  WalletCards,
  X,
} from 'lucide-react'
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'

import {
  calculateBalances,
  calculateSettlements,
  formatTripMoney,
  toCny,
} from '../lib/balances'
import type {
  Checklist,
  Currency,
  Day,
  DayItem,
  DayItemKind,
  Expense,
  Hotel,
  Place,
  PlaceCategory,
  PlaceStatus,
  Ticket as TripTicket,
  TicketKind,
  Traveler,
  TravelerId,
  TripState,
} from '../lib/types'
import { lockTrip, refreshRate, saveTripState } from '../server/functions'

type TabId =
  | 'route'
  | 'places'
  | 'hotels'
  | 'tickets'
  | 'expenses'
  | 'notes'
  | 'settings'

type Commit = (updater: (state: TripState) => TripState) => void

interface TripAppProps {
  initialState: TripState
}

const tabs: Array<{ id: TabId; label: string; icon: ReactNode }> = [
  { id: 'route', label: 'Маршрут', icon: <Map size={20} /> },
  { id: 'places', label: 'Места', icon: <MapPin size={20} /> },
  { id: 'hotels', label: 'Отели', icon: <Building2 size={20} /> },
  { id: 'tickets', label: 'Билеты', icon: <Ticket size={20} /> },
  { id: 'expenses', label: 'Расходы', icon: <ReceiptText size={20} /> },
  { id: 'notes', label: 'Заметки', icon: <ListChecks size={20} /> },
  { id: 'settings', label: 'Ещё', icon: <Settings size={20} /> },
]

const travelerIds: TravelerId[] = ['traveler-a', 'traveler-b', 'traveler-c']

export function TripApp({ initialState }: TripAppProps) {
  const router = useRouter()
  const [state, setState] = useState(initialState)
  const [activeTab, setActiveTab] = useLocalStorageState<TabId>(
    'china-trip.active-tab',
    'route',
    isTabId,
  )
  const [currentTravelerId, setCurrentTravelerId] =
    useLocalStorageState<TravelerId>(
      'china-trip.current-traveler',
      'traveler-a',
      isTravelerId,
    )
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>(
    'saved',
  )
  const saveVersion = useRef(0)

  const currentTraveler =
    state.travelers.find((traveler) => traveler.id === currentTravelerId) ??
    state.travelers[0]
  const sortedDays = useMemo(
    () => [...state.days].sort((left, right) => left.date.localeCompare(right.date)),
    [state.days],
  )
  const today = todayDate()
  const nextDay = sortedDays.find((day) => day.date >= today) ?? sortedDays[0]
  const nextHotel = useMemo(
    () =>
      [...state.hotels]
        .sort((left, right) => left.checkIn.localeCompare(right.checkIn))
        .find((hotel) => hotel.checkOut >= today) ?? state.hotels[0],
    [state.hotels, today],
  )
  const totalExpenseCny = useMemo(
    () =>
      state.expenses.reduce(
        (sum, expense) =>
          sum +
          toCny(expense.amount, expense.currency, state.settings.cnyToRubRate),
        0,
      ),
    [state.expenses, state.settings.cnyToRubRate],
  )

  async function persist(next: TripState) {
    const version = saveVersion.current + 1
    saveVersion.current = version
    setSaveStatus('saving')
    try {
      const saved = await saveTripState({ data: next })
      if (saveVersion.current === version) {
        setState(saved)
        setSaveStatus('saved')
      }
    } catch {
      if (saveVersion.current === version) setSaveStatus('error')
    }
  }

  const commit: Commit = (updater) => {
    setState((previous) => {
      const next = updater(previous)
      void persist(next)
      return next
    })
  }

  async function handleLock() {
    await lockTrip()
    await router.navigate({ to: '/unlock' })
  }

  return (
    <div className="app-shell">
      <header className="trip-header">
        <div>
          <p className="eyebrow">China Trip</p>
          <h1>План поездки</h1>
          <p className="trip-meta">
            {state.days.length} {pluralRu(state.days.length, ['день', 'дня', 'дней'])} ·{' '}
            {state.places.length}{' '}
            {pluralRu(state.places.length, ['место', 'места', 'мест'])} ·{' '}
            {state.expenses.length}{' '}
            {pluralRu(state.expenses.length, ['трата', 'траты', 'трат'])}
          </p>
        </div>
        <div
          className="trip-photo"
          role="img"
          aria-label="Великая Китайская стена"
        />
      </header>

      <section className="status-strip" aria-label="Текущий пользователь">
        <div className="traveler-pill">
          <span
            style={{ backgroundColor: currentTraveler.color }}
            className="traveler-dot"
          />
          <UserRound size={16} />
          <span>{currentTraveler.name}</span>
        </div>
        <div className={`save-pill save-${saveStatus}`}>
          {saveStatus === 'saving' ? <Loader2 className="spin" size={16} /> : null}
          {saveStatus === 'saved' ? <Check size={16} /> : null}
          {saveStatus === 'error' ? <KeyRound size={16} /> : null}
          <span>
            {saveStatus === 'saving'
              ? 'Сохраняю'
              : saveStatus === 'error'
                ? 'Ошибка'
                : 'Сохранено'}
          </span>
        </div>
      </section>

      <section className="overview-grid" aria-label="Краткая сводка">
        <article className="overview-card">
          <CalendarDays size={18} />
          <div>
            <span>Ближайший день</span>
            <strong>{nextDay ? `${formatShortDate(nextDay.date)} · ${nextDay.city}` : '—'}</strong>
          </div>
        </article>
        <article className="overview-card">
          <Building2 size={18} />
          <div>
            <span>База</span>
            <strong>{nextHotel ? `${nextHotel.city} · ${formatShortDate(nextHotel.checkIn)}` : '—'}</strong>
          </div>
        </article>
        <article className="overview-card">
          <WalletCards size={18} />
          <div>
            <span>Траты</span>
            <strong>
              {formatTripMoney(
                totalExpenseCny,
                state.settings.displayCurrency,
                state.settings.cnyToRubRate,
              )}
            </strong>
          </div>
        </article>
      </section>

      <main className="content-area">
        {activeTab === 'route' ? (
          <RouteView state={state} commit={commit} />
        ) : null}
        {activeTab === 'places' ? (
          <PlacesView state={state} commit={commit} />
        ) : null}
        {activeTab === 'hotels' ? (
          <HotelsView state={state} commit={commit} />
        ) : null}
        {activeTab === 'tickets' ? (
          <TicketsView state={state} commit={commit} />
        ) : null}
        {activeTab === 'expenses' ? (
          <ExpensesView
            state={state}
            commit={commit}
            currentTravelerId={currentTravelerId}
          />
        ) : null}
        {activeTab === 'notes' ? (
          <NotesView state={state} commit={commit} />
        ) : null}
        {activeTab === 'settings' ? (
          <SettingsView
            state={state}
            commit={commit}
            currentTravelerId={currentTravelerId}
            onTravelerChange={setCurrentTravelerId}
            onStateReplace={(next) => {
              setState(next)
              void persist(next)
            }}
            onLock={handleLock}
          />
        ) : null}
      </main>

      <nav className="bottom-tabs" aria-label="Разделы">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function RouteView({ state, commit }: { state: TripState; commit: Commit }) {
  const [editingDayId, setEditingDayId] = useState<string | null>(null)
  const sortedDays = [...state.days].sort((left, right) =>
    left.date.localeCompare(right.date),
  )

  function addDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const date = getFormString(data, 'date')
    const city = getFormString(data, 'city')
    if (!date || !city) return

    commit((previous) => ({
      ...previous,
      days: [
        ...previous.days,
        {
          id: makeId('day'),
          date,
          city,
          note: getFormString(data, 'note'),
        },
      ],
    }))
    form.reset()
  }

  function addDayNote(event: FormEvent<HTMLFormElement>, day: Day) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const note = getFormString(data, 'note')
    if (!note) return

    commit((previous) => ({
      ...previous,
      dayItems: [
        ...previous.dayItems,
        {
          id: makeId('note'),
          dayId: day.id,
          kind: 'note',
          refId: makeId('note-ref'),
          sortOrder: nextSortOrder(previous.dayItems, day.id),
          title: 'Заметка',
          note,
        },
      ],
    }))
    form.reset()
  }

  function updateDay(event: FormEvent<HTMLFormElement>, dayId: string) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const date = getFormString(data, 'date')
    const city = getFormString(data, 'city')
    if (!date || !city) return

    commit((previous) => ({
      ...previous,
      days: previous.days.map((day) =>
        day.id === dayId
          ? {
              ...day,
              date,
              city,
              note: getFormString(data, 'note'),
            }
          : day,
      ),
    }))
    setEditingDayId(null)
  }

  function removeDay(dayId: string) {
    commit((previous) => ({
      ...previous,
      days: previous.days.filter((day) => day.id !== dayId),
      dayItems: previous.dayItems.filter((item) => item.dayId !== dayId),
      places: previous.places.map((place) =>
        place.dayId === dayId ? { ...place, dayId: undefined } : place,
      ),
    }))
  }

  return (
    <section className="view-stack" aria-labelledby="route-title">
      <SectionHeading
        eyebrow="Главная"
        title="Маршрут"
        aside={`${sortedDays.length} ${pluralRu(sortedDays.length, ['день', 'дня', 'дней'])}`}
      />

      <form className="quick-form" onSubmit={addDay}>
        <label>
          <span>Дата</span>
          <input name="date" type="date" required />
        </label>
        <label>
          <span>Город</span>
          <input name="city" placeholder="Гуанчжоу" required />
        </label>
        <label className="wide-field">
          <span>Заметка</span>
          <input name="note" placeholder="Переезд, бронь, план" />
        </label>
        <button className="icon-button primary" type="submit" title="Добавить день">
          <CalendarPlus size={20} />
        </button>
      </form>

      <div className="timeline">
        {sortedDays.map((day) => {
          const items = state.dayItems
            .filter((item) => item.dayId === day.id)
            .sort((left, right) => left.sortOrder - right.sortOrder)

          return (
            <article className="day-card" key={day.id}>
              <div className="day-date">
                <strong>{formatDayNumber(day.date)}</strong>
                <span>{formatMonth(day.date)}</span>
              </div>
              <div className="day-body">
                <div className="day-title-row">
                  <div>
                    <h3>{day.city}</h3>
                    <p>{formatWeekday(day.date)}</p>
                  </div>
                  <EditDeleteActions
                    deleteTitle="Удалить день"
                    onEdit={() => setEditingDayId(day.id)}
                    onDelete={() => removeDay(day.id)}
                  />
                </div>
                {editingDayId === day.id ? (
                  <form
                    className="edit-form"
                    onSubmit={(event) => updateDay(event, day.id)}
                  >
                    <label>
                      <span>Дата</span>
                      <input name="date" type="date" defaultValue={day.date} required />
                    </label>
                    <label>
                      <span>Город</span>
                      <input name="city" defaultValue={day.city} required />
                    </label>
                    <label className="wide-field">
                      <span>Заметка</span>
                      <input name="note" defaultValue={day.note} />
                    </label>
                    <SaveCancelActions onCancel={() => setEditingDayId(null)} />
                  </form>
                ) : null}
                {day.note ? <p className="muted-text">{day.note}</p> : null}
                <div className="day-items">
                  {items.length ? (
                    items.map((item) => (
                      <DayItemRow
                        key={item.id}
                        item={item}
                        state={state}
                        onRemove={() =>
                          commit((previous) => ({
                            ...previous,
                            dayItems: previous.dayItems.filter(
                              (candidate) => candidate.id !== item.id,
                            ),
                          }))
                        }
                        onSaveNote={(note) =>
                          commit((previous) => ({
                            ...previous,
                            dayItems: previous.dayItems.map((candidate) =>
                              candidate.id === item.id
                                ? { ...candidate, title: 'Заметка', note }
                                : candidate,
                            ),
                          }))
                        }
                      />
                    ))
                  ) : (
                    <p className="empty-text">Пока ничего не привязано</p>
                  )}
                </div>
                <form
                  className="inline-note-form"
                  onSubmit={(event) => addDayNote(event, day)}
                >
                  <input name="note" placeholder="Короткая заметка к дню" />
                  <button className="icon-button" type="submit" title="Добавить заметку">
                    <Plus size={18} />
                  </button>
                </form>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function PlacesView({ state, commit }: { state: TripState; commit: Commit }) {
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null)

  function addPlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const name = getFormString(data, 'name')
    const city = getFormString(data, 'city')
    if (!name || !city) return
    const dayId = getFormString(data, 'dayId') || undefined
    const id = makeId('place')

    commit((previous) => ({
      ...previous,
      places: [
        {
          id,
          name,
          city,
          category: getFormString(data, 'category') as PlaceCategory,
          url: getFormString(data, 'url'),
          note: getFormString(data, 'note'),
          photoUrl: getFormString(data, 'photoUrl'),
          status: 'want',
          dayId,
          createdAt: new Date().toISOString(),
        },
        ...previous.places,
      ],
      dayItems: dayId
        ? [
            ...previous.dayItems,
            {
              id: makeId('day-item'),
              dayId,
              kind: 'place',
              refId: id,
              sortOrder: nextSortOrder(previous.dayItems, dayId),
            },
          ]
        : previous.dayItems,
    }))
    form.reset()
  }

  function updatePlace(event: FormEvent<HTMLFormElement>, placeId: string) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = getFormString(data, 'name')
    const city = getFormString(data, 'city')
    if (!name || !city) return
    const dayId = getFormString(data, 'dayId')

    commit((previous) => ({
      ...previous,
      places: previous.places.map((place) =>
        place.id === placeId
          ? {
              ...place,
              name,
              city,
              category: getFormString(data, 'category') as PlaceCategory,
              url: getFormString(data, 'url'),
              note: getFormString(data, 'note'),
              photoUrl: getFormString(data, 'photoUrl'),
              status: getFormString(data, 'status') as PlaceStatus,
              dayId: dayId || undefined,
            }
          : place,
      ),
      dayItems: syncDayItemLink(previous.dayItems, 'place', placeId, dayId),
    }))
    setEditingPlaceId(null)
  }

  function setPlaceStatus(placeId: string, status: PlaceStatus) {
    commit((previous) => ({
      ...previous,
      places: previous.places.map((place) =>
        place.id === placeId ? { ...place, status } : place,
      ),
    }))
  }

  return (
    <section className="view-stack" aria-labelledby="places-title">
      <SectionHeading
        eyebrow="POI"
        title="Места"
        aside={`${state.places.length} ${pluralRu(state.places.length, ['точка', 'точки', 'точек'])}`}
      />
      <form className="quick-form" onSubmit={addPlace}>
        <label>
          <span>Название</span>
          <input name="name" placeholder="Чайный рынок" required />
        </label>
        <label>
          <span>Город</span>
          <input name="city" placeholder="Шанхай" required />
        </label>
        <label>
          <span>Категория</span>
          <select name="category" defaultValue="sight">
            <option value="sight">Достопримечательность</option>
            <option value="food">Еда</option>
            <option value="shopping">Шопинг</option>
          </select>
        </label>
        <label>
          <span>День</span>
          <DaySelect days={state.days} />
        </label>
        <label>
          <span>Карта</span>
          <input name="url" placeholder="https://maps..." />
        </label>
        <label>
          <span>Фото</span>
          <input name="photoUrl" placeholder="https://..." />
        </label>
        <label className="wide-field">
          <span>Заметка</span>
          <input name="note" placeholder="Что важно помнить" />
        </label>
        <button className="icon-button primary" type="submit" title="Добавить место">
          <Plus size={20} />
        </button>
      </form>

      <div className="card-grid">
        {state.places.map((place) => (
          <article className="place-card" key={place.id}>
            {place.photoUrl ? (
              <img src={place.photoUrl} alt="" />
            ) : (
              <div className="image-placeholder">
                <ImageIcon size={24} />
              </div>
            )}
            <div className="card-body">
              <div className="title-row">
                <div>
                  <p className="tag icon-tag">
                    {placeIcon(place.category)}
                    <span>{placeCategoryLabel(place.category)}</span>
                  </p>
                  <h3>{place.name}</h3>
                  <p className="muted-text">{place.city}</p>
                </div>
                <EditDeleteActions
                  deleteTitle="Удалить место"
                  onEdit={() => setEditingPlaceId(place.id)}
                  onDelete={() =>
                    commit((previous) => ({
                      ...previous,
                      places: previous.places.filter(
                        (candidate) => candidate.id !== place.id,
                      ),
                      dayItems: previous.dayItems.filter(
                        (item) =>
                          !(item.kind === 'place' && item.refId === place.id),
                      ),
                    }))
                  }
                />
              </div>
              {editingPlaceId === place.id ? (
                <form
                  className="edit-form"
                  onSubmit={(event) => updatePlace(event, place.id)}
                >
                  <label>
                    <span>Название</span>
                    <input name="name" defaultValue={place.name} required />
                  </label>
                  <label>
                    <span>Город</span>
                    <input name="city" defaultValue={place.city} required />
                  </label>
                  <label>
                    <span>Категория</span>
                    <select name="category" defaultValue={place.category}>
                      <option value="sight">Достопримечательность</option>
                      <option value="food">Еда</option>
                      <option value="shopping">Шопинг</option>
                    </select>
                  </label>
                  <label>
                    <span>Статус</span>
                    <select name="status" defaultValue={place.status}>
                      <option value="want">Хочу</option>
                      <option value="done">Были</option>
                    </select>
                  </label>
                  <label>
                    <span>День</span>
                    <DaySelect days={state.days} defaultValue={place.dayId ?? ''} />
                  </label>
                  <label>
                    <span>Карта</span>
                    <input name="url" defaultValue={place.url} />
                  </label>
                  <label className="wide-field">
                    <span>Фото</span>
                    <input name="photoUrl" defaultValue={place.photoUrl} />
                  </label>
                  <label className="wide-field">
                    <span>Заметка</span>
                    <input name="note" defaultValue={place.note} />
                  </label>
                  <SaveCancelActions onCancel={() => setEditingPlaceId(null)} />
                </form>
              ) : null}
              {place.note ? <p>{place.note}</p> : null}
              <div className="card-actions">
                <button
                  className={`chip-button ${place.status === 'want' ? 'active' : ''}`}
                  type="button"
                  onClick={() => setPlaceStatus(place.id, 'want')}
                >
                  Хочу
                </button>
                <button
                  className={`chip-button ${place.status === 'done' ? 'active' : ''}`}
                  type="button"
                  onClick={() => setPlaceStatus(place.id, 'done')}
                >
                  Были
                </button>
                <ExternalLinkButton href={place.url} label="Карта" />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function HotelsView({ state, commit }: { state: TripState; commit: Commit }) {
  const [editingHotelId, setEditingHotelId] = useState<string | null>(null)

  function addHotel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const name = getFormString(data, 'name')
    const city = getFormString(data, 'city')
    if (!name || !city) return
    const dayId = getFormString(data, 'dayId')
    const id = makeId('hotel')

    commit((previous) => ({
      ...previous,
      hotels: [
        ...previous.hotels,
        {
          id,
          name,
          city,
          address: getFormString(data, 'address'),
          checkIn: getFormString(data, 'checkIn'),
          checkOut: getFormString(data, 'checkOut'),
          price: getFormNumber(data, 'price'),
          currency: getFormString(data, 'currency') as Currency,
          url: getFormString(data, 'url'),
          confirmationUrl: getFormString(data, 'confirmationUrl'),
          note: getFormString(data, 'note'),
        },
      ],
      dayItems: dayId
        ? [
            ...previous.dayItems,
            {
              id: makeId('day-item'),
              dayId,
              kind: 'hotel',
              refId: id,
              sortOrder: nextSortOrder(previous.dayItems, dayId),
            },
          ]
        : previous.dayItems,
    }))
    form.reset()
  }

  function updateHotel(event: FormEvent<HTMLFormElement>, hotelId: string) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = getFormString(data, 'name')
    const city = getFormString(data, 'city')
    if (!name || !city) return
    const dayId = getFormString(data, 'dayId')

    commit((previous) => ({
      ...previous,
      hotels: previous.hotels.map((hotel) =>
        hotel.id === hotelId
          ? {
              ...hotel,
              name,
              city,
              address: getFormString(data, 'address'),
              checkIn: getFormString(data, 'checkIn'),
              checkOut: getFormString(data, 'checkOut'),
              price: getFormNumber(data, 'price'),
              currency: getFormString(data, 'currency') as Currency,
              url: getFormString(data, 'url'),
              confirmationUrl: getFormString(data, 'confirmationUrl'),
              note: getFormString(data, 'note'),
            }
          : hotel,
      ),
      dayItems: syncDayItemLink(previous.dayItems, 'hotel', hotelId, dayId),
    }))
    setEditingHotelId(null)
  }

  return (
    <section className="view-stack" aria-labelledby="hotels-title">
      <SectionHeading
        eyebrow="Брони"
        title="Отели"
        aside={`${state.hotels.length} ${pluralRu(state.hotels.length, ['бронь', 'брони', 'броней'])}`}
      />
      <form className="quick-form" onSubmit={addHotel}>
        <label>
          <span>Отель</span>
          <input name="name" placeholder="Название" required />
        </label>
        <label>
          <span>Город</span>
          <input name="city" required />
        </label>
        <label>
          <span>Заезд</span>
          <input name="checkIn" type="date" />
        </label>
        <label>
          <span>Выезд</span>
          <input name="checkOut" type="date" />
        </label>
        <label>
          <span>Цена</span>
          <input name="price" type="number" min="0" step="0.01" />
        </label>
        <label>
          <span>Валюта</span>
          <CurrencySelect />
        </label>
        <label>
          <span>День</span>
          <DaySelect days={state.days} />
        </label>
        <label className="wide-field">
          <span>Адрес</span>
          <input name="address" placeholder="Район, улица" />
        </label>
        <label>
          <span>Бронь</span>
          <input name="url" placeholder="https://..." />
        </label>
        <label>
          <span>Подтверждение</span>
          <input name="confirmationUrl" placeholder="Файл или скрин" />
        </label>
        <label className="wide-field">
          <span>Заметка</span>
          <input name="note" />
        </label>
        <button className="icon-button primary" type="submit" title="Добавить отель">
          <Plus size={20} />
        </button>
      </form>

      <div className="list-stack">
        {state.hotels.map((hotel) => (
          <article className="info-card" key={hotel.id}>
            <div className="info-icon">
              <Building2 size={22} />
            </div>
            <div className="info-content">
              <div className="title-row">
                <div>
                  <h3>{hotel.name}</h3>
                  <p className="muted-text">{hotel.city}</p>
                </div>
                <EditDeleteActions
                  deleteTitle="Удалить отель"
                  onEdit={() => setEditingHotelId(hotel.id)}
                  onDelete={() =>
                    commit((previous) => ({
                      ...previous,
                      hotels: previous.hotels.filter(
                        (candidate) => candidate.id !== hotel.id,
                      ),
                      dayItems: previous.dayItems.filter(
                        (item) =>
                          !(item.kind === 'hotel' && item.refId === hotel.id),
                      ),
                    }))
                  }
                />
              </div>
              {editingHotelId === hotel.id ? (
                <form
                  className="edit-form"
                  onSubmit={(event) => updateHotel(event, hotel.id)}
                >
                  <label>
                    <span>Отель</span>
                    <input name="name" defaultValue={hotel.name} required />
                  </label>
                  <label>
                    <span>Город</span>
                    <input name="city" defaultValue={hotel.city} required />
                  </label>
                  <label>
                    <span>Заезд</span>
                    <input name="checkIn" type="date" defaultValue={hotel.checkIn} />
                  </label>
                  <label>
                    <span>Выезд</span>
                    <input name="checkOut" type="date" defaultValue={hotel.checkOut} />
                  </label>
                  <label>
                    <span>Цена</span>
                    <input
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={hotel.price}
                    />
                  </label>
                  <label>
                    <span>Валюта</span>
                    <CurrencySelect defaultValue={hotel.currency} />
                  </label>
                  <label>
                    <span>День</span>
                    <DaySelect
                      days={state.days}
                      defaultValue={getLinkedDayId(state.dayItems, 'hotel', hotel.id)}
                    />
                  </label>
                  <label className="wide-field">
                    <span>Адрес</span>
                    <input name="address" defaultValue={hotel.address} />
                  </label>
                  <label>
                    <span>Бронь</span>
                    <input name="url" defaultValue={hotel.url} />
                  </label>
                  <label>
                    <span>Подтверждение</span>
                    <input
                      name="confirmationUrl"
                      defaultValue={hotel.confirmationUrl}
                    />
                  </label>
                  <label className="wide-field">
                    <span>Заметка</span>
                    <input name="note" defaultValue={hotel.note} />
                  </label>
                  <SaveCancelActions onCancel={() => setEditingHotelId(null)} />
                </form>
              ) : null}
              <p>
                {formatShortDate(hotel.checkIn)} → {formatShortDate(hotel.checkOut)}
              </p>
              {hotel.address ? <p className="muted-text">{hotel.address}</p> : null}
              <div className="card-actions">
                <span className="money-chip">
                  {formatRawMoney(hotel.price, hotel.currency)}
                </span>
                <ExternalLinkButton href={hotel.url} label="Бронь" />
                <ExternalLinkButton href={hotel.confirmationUrl} label="Файл" />
              </div>
              {hotel.note ? <p>{hotel.note}</p> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function TicketsView({ state, commit }: { state: TripState; commit: Commit }) {
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null)

  function addTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const fromCity = getFormString(data, 'fromCity')
    const toCity = getFormString(data, 'toCity')
    if (!fromCity || !toCity) return
    const dayId = getFormString(data, 'dayId')
    const id = makeId('ticket')

    commit((previous) => ({
      ...previous,
      tickets: [
        ...previous.tickets,
        {
          id,
          kind: getFormString(data, 'kind') as TicketKind,
          fromCity,
          toCity,
          departAt: getFormString(data, 'departAt'),
          arriveAt: getFormString(data, 'arriveAt'),
          refNumber: getFormString(data, 'refNumber'),
          seat: getFormString(data, 'seat'),
          price: getFormNumber(data, 'price'),
          currency: getFormString(data, 'currency') as Currency,
          url: getFormString(data, 'url'),
          fileUrl: getFormString(data, 'fileUrl'),
        },
      ],
      dayItems: dayId
        ? [
            ...previous.dayItems,
            {
              id: makeId('day-item'),
              dayId,
              kind: 'ticket',
              refId: id,
              sortOrder: nextSortOrder(previous.dayItems, dayId),
            },
          ]
        : previous.dayItems,
    }))
    form.reset()
  }

  function updateTicket(event: FormEvent<HTMLFormElement>, ticketId: string) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const fromCity = getFormString(data, 'fromCity')
    const toCity = getFormString(data, 'toCity')
    if (!fromCity || !toCity) return
    const dayId = getFormString(data, 'dayId')

    commit((previous) => ({
      ...previous,
      tickets: previous.tickets.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              kind: getFormString(data, 'kind') as TicketKind,
              fromCity,
              toCity,
              departAt: getFormString(data, 'departAt'),
              arriveAt: getFormString(data, 'arriveAt'),
              refNumber: getFormString(data, 'refNumber'),
              seat: getFormString(data, 'seat'),
              price: getFormNumber(data, 'price'),
              currency: getFormString(data, 'currency') as Currency,
              url: getFormString(data, 'url'),
              fileUrl: getFormString(data, 'fileUrl'),
            }
          : ticket,
      ),
      dayItems: syncDayItemLink(previous.dayItems, 'ticket', ticketId, dayId),
    }))
    setEditingTicketId(null)
  }

  return (
    <section className="view-stack" aria-labelledby="tickets-title">
      <SectionHeading
        eyebrow="Переезды"
        title="Билеты"
        aside={`${state.tickets.length} ${pluralRu(state.tickets.length, ['запись', 'записи', 'записей'])}`}
      />
      <form className="quick-form" onSubmit={addTicket}>
        <label>
          <span>Тип</span>
          <select name="kind" defaultValue="train">
            <option value="flight">Самолёт</option>
            <option value="train">Поезд</option>
            <option value="metro-pass">Метро-пасс</option>
          </select>
        </label>
        <label>
          <span>Откуда</span>
          <input name="fromCity" required />
        </label>
        <label>
          <span>Куда</span>
          <input name="toCity" required />
        </label>
        <label>
          <span>Отправление</span>
          <input name="departAt" type="datetime-local" />
        </label>
        <label>
          <span>Прибытие</span>
          <input name="arriveAt" type="datetime-local" />
        </label>
        <label>
          <span>Номер</span>
          <input name="refNumber" />
        </label>
        <label>
          <span>Места</span>
          <input name="seat" />
        </label>
        <label>
          <span>Цена</span>
          <input name="price" type="number" min="0" step="0.01" />
        </label>
        <label>
          <span>Валюта</span>
          <CurrencySelect />
        </label>
        <label>
          <span>День</span>
          <DaySelect days={state.days} />
        </label>
        <label>
          <span>Ссылка</span>
          <input name="url" placeholder="https://..." />
        </label>
        <label>
          <span>Файл</span>
          <input name="fileUrl" placeholder="Файл или скрин" />
        </label>
        <button className="icon-button primary" type="submit" title="Добавить билет">
          <Plus size={20} />
        </button>
      </form>

      <div className="list-stack">
        {state.tickets.map((ticket) => (
          <article className="info-card" key={ticket.id}>
            <div className="info-icon">{ticketIcon(ticket.kind)}</div>
            <div className="info-content">
              <div className="title-row">
                <div>
                  <h3>
                    {ticket.fromCity} → {ticket.toCity}
                  </h3>
                  <p className="muted-text">{ticketKindLabel(ticket.kind)}</p>
                </div>
                <EditDeleteActions
                  deleteTitle="Удалить билет"
                  onEdit={() => setEditingTicketId(ticket.id)}
                  onDelete={() =>
                    commit((previous) => ({
                      ...previous,
                      tickets: previous.tickets.filter(
                        (candidate) => candidate.id !== ticket.id,
                      ),
                      dayItems: previous.dayItems.filter(
                        (item) =>
                          !(item.kind === 'ticket' && item.refId === ticket.id),
                      ),
                    }))
                  }
                />
              </div>
              {editingTicketId === ticket.id ? (
                <form
                  className="edit-form"
                  onSubmit={(event) => updateTicket(event, ticket.id)}
                >
                  <label>
                    <span>Тип</span>
                    <select name="kind" defaultValue={ticket.kind}>
                      <option value="flight">Самолёт</option>
                      <option value="train">Поезд</option>
                      <option value="metro-pass">Метро-пасс</option>
                    </select>
                  </label>
                  <label>
                    <span>Откуда</span>
                    <input name="fromCity" defaultValue={ticket.fromCity} required />
                  </label>
                  <label>
                    <span>Куда</span>
                    <input name="toCity" defaultValue={ticket.toCity} required />
                  </label>
                  <label>
                    <span>Отправление</span>
                    <input
                      name="departAt"
                      type="datetime-local"
                      defaultValue={ticket.departAt}
                    />
                  </label>
                  <label>
                    <span>Прибытие</span>
                    <input
                      name="arriveAt"
                      type="datetime-local"
                      defaultValue={ticket.arriveAt}
                    />
                  </label>
                  <label>
                    <span>Номер</span>
                    <input name="refNumber" defaultValue={ticket.refNumber} />
                  </label>
                  <label>
                    <span>Места</span>
                    <input name="seat" defaultValue={ticket.seat} />
                  </label>
                  <label>
                    <span>Цена</span>
                    <input
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={ticket.price}
                    />
                  </label>
                  <label>
                    <span>Валюта</span>
                    <CurrencySelect defaultValue={ticket.currency} />
                  </label>
                  <label>
                    <span>День</span>
                    <DaySelect
                      days={state.days}
                      defaultValue={getLinkedDayId(
                        state.dayItems,
                        'ticket',
                        ticket.id,
                      )}
                    />
                  </label>
                  <label>
                    <span>Ссылка</span>
                    <input name="url" defaultValue={ticket.url} />
                  </label>
                  <label>
                    <span>Файл</span>
                    <input name="fileUrl" defaultValue={ticket.fileUrl} />
                  </label>
                  <SaveCancelActions onCancel={() => setEditingTicketId(null)} />
                </form>
              ) : null}
              <p>
                {formatDateTime(ticket.departAt)} → {formatDateTime(ticket.arriveAt)}
              </p>
              <p className="muted-text">
                {[ticket.refNumber, ticket.seat].filter(Boolean).join(' · ')}
              </p>
              <div className="card-actions">
                <span className="money-chip">
                  {formatRawMoney(ticket.price, ticket.currency)}
                </span>
                <ExternalLinkButton href={ticket.url} label="Ссылка" />
                <ExternalLinkButton href={ticket.fileUrl} label="Файл" />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ExpensesView({
  state,
  commit,
  currentTravelerId,
}: {
  state: TripState
  commit: Commit
  currentTravelerId: TravelerId
}) {
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const balances = useMemo(
    () =>
      calculateBalances(
        state.travelers,
        state.expenses,
        state.expenseShares,
        state.settings.cnyToRubRate,
      ),
    [
      state.travelers,
      state.expenses,
      state.expenseShares,
      state.settings.cnyToRubRate,
    ],
  )
  const settlements = useMemo(() => calculateSettlements(balances), [balances])
  const displayCurrency = state.settings.displayCurrency

  function setDisplayCurrency(currency: Currency) {
    commit((previous) => ({
      ...previous,
      settings: { ...previous.settings, displayCurrency: currency },
    }))
  }

  function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const amount = getFormNumber(data, 'amount')
    if (!amount) return
    const id = makeId('expense')
    const selectedShares = travelerIds.filter(
      (travelerId) => data.get(`share-${travelerId}`) === 'on',
    )
    const shares = selectedShares.length ? selectedShares : travelerIds

    commit((previous) => ({
      ...previous,
      expenses: [
        {
          id,
          payerId: getFormString(data, 'payerId') as TravelerId,
          amount,
          currency: getFormString(data, 'currency') as Currency,
          category: getFormString(data, 'category') || 'Общее',
          description: getFormString(data, 'description') || 'Трата',
          spentAt: getFormString(data, 'spentAt') || todayDate(),
          createdAt: new Date().toISOString(),
        },
        ...previous.expenses,
      ],
      expenseShares: [
        ...shares.map((travelerId) => ({
          expenseId: id,
          travelerId,
        })),
        ...previous.expenseShares,
      ],
    }))
    form.reset()
  }

  function updateExpense(event: FormEvent<HTMLFormElement>, expenseId: string) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const amount = getFormNumber(data, 'amount')
    if (!amount) return
    const selectedShares = travelerIds.filter(
      (travelerId) => data.get(`share-${travelerId}`) === 'on',
    )
    const shares = selectedShares.length ? selectedShares : travelerIds

    commit((previous) => ({
      ...previous,
      expenses: previous.expenses.map((expense) =>
        expense.id === expenseId
          ? {
              ...expense,
              payerId: getFormString(data, 'payerId') as TravelerId,
              amount,
              currency: getFormString(data, 'currency') as Currency,
              category: getFormString(data, 'category') || 'Общее',
              description: getFormString(data, 'description') || 'Трата',
              spentAt: getFormString(data, 'spentAt') || todayDate(),
            }
          : expense,
      ),
      expenseShares: [
        ...previous.expenseShares.filter((share) => share.expenseId !== expenseId),
        ...shares.map((travelerId) => ({
          expenseId,
          travelerId,
        })),
      ],
    }))
    setEditingExpenseId(null)
  }

  return (
    <section className="view-stack" aria-labelledby="expenses-title">
      <SectionHeading
        eyebrow="Splitwise"
        title="Расходы"
        aside={formatTripMoney(
          state.expenses.reduce(
            (sum, expense) =>
              sum +
              toCny(
                expense.amount,
                expense.currency,
                state.settings.cnyToRubRate,
              ),
            0,
          ),
          displayCurrency,
          state.settings.cnyToRubRate,
        )}
      />

      <div className="segmented-row" role="group" aria-label="Валюта балансов">
        <button
          type="button"
          className={displayCurrency === 'CNY' ? 'active' : ''}
          onClick={() => setDisplayCurrency('CNY')}
        >
          CNY
        </button>
        <button
          type="button"
          className={displayCurrency === 'RUB' ? 'active' : ''}
          onClick={() => setDisplayCurrency('RUB')}
        >
          RUB
        </button>
      </div>

      <div className="balance-grid">
        {balances.map((balance) => {
          const traveler = getTraveler(state.travelers, balance.travelerId)
          return (
            <article className="balance-card" key={balance.travelerId}>
              <span
                className="traveler-dot"
                style={{ backgroundColor: traveler.color }}
              />
              <p>{traveler.name}</p>
              <strong
                className={
                  balance.balanceCny >= 0 ? 'positive-money' : 'negative-money'
                }
              >
                {formatTripMoney(
                  balance.balanceCny,
                  displayCurrency,
                  state.settings.cnyToRubRate,
                )}
              </strong>
            </article>
          )
        })}
      </div>

      <div className="settlement-list">
        {settlements.length ? (
          settlements.map((settlement) => (
            <div className="settlement-row" key={`${settlement.fromId}-${settlement.toId}`}>
              <span>{getTraveler(state.travelers, settlement.fromId).name}</span>
              <span>→</span>
              <span>{getTraveler(state.travelers, settlement.toId).name}</span>
              <strong>
                {formatTripMoney(
                  settlement.amountCny,
                  displayCurrency,
                  state.settings.cnyToRubRate,
                )}
              </strong>
            </div>
          ))
        ) : (
          <p className="empty-text">Балансы уже ровные</p>
        )}
      </div>

      <form className="quick-form" onSubmit={addExpense}>
        <label>
          <span>Кто платил</span>
          <select name="payerId" defaultValue={currentTravelerId}>
            {state.travelers.map((traveler) => (
              <option key={traveler.id} value={traveler.id}>
                {traveler.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Сумма</span>
          <input name="amount" type="number" min="0" step="0.01" required />
        </label>
        <label>
          <span>Валюта</span>
          <CurrencySelect />
        </label>
        <label>
          <span>Категория</span>
          <input name="category" placeholder="Еда" />
        </label>
        <label>
          <span>Дата</span>
          <input name="spentAt" type="date" defaultValue={todayDate()} />
        </label>
        <label className="wide-field">
          <span>Комментарий</span>
          <input name="description" placeholder="Ужин, билеты, такси" />
        </label>
        <fieldset className="wide-field checkbox-row">
          <legend>В доле</legend>
          {state.travelers.map((traveler) => (
            <label key={traveler.id}>
              <input name={`share-${traveler.id}`} type="checkbox" defaultChecked />
              <span>{traveler.name}</span>
            </label>
          ))}
        </fieldset>
        <button className="icon-button primary" type="submit" title="Добавить трату">
          <CircleDollarSign size={20} />
        </button>
      </form>

      <div className="list-stack">
        {state.expenses.map((expense) => {
          const payer = getTraveler(state.travelers, expense.payerId)
          const shares = state.expenseShares.filter(
            (share) => share.expenseId === expense.id,
          )
          return (
            <article className="info-card" key={expense.id}>
              <div className="info-icon">
                <ReceiptText size={22} />
              </div>
              <div className="info-content">
                <div className="title-row">
                  <div>
                    <h3>{expense.description}</h3>
                    <p className="muted-text">
                      {expense.category} · {formatShortDate(expense.spentAt)}
                    </p>
                  </div>
                  <EditDeleteActions
                    deleteTitle="Удалить трату"
                    onEdit={() => setEditingExpenseId(expense.id)}
                    onDelete={() =>
                      commit((previous) => ({
                        ...previous,
                        expenses: previous.expenses.filter(
                          (candidate) => candidate.id !== expense.id,
                        ),
                        expenseShares: previous.expenseShares.filter(
                          (share) => share.expenseId !== expense.id,
                        ),
                      }))
                    }
                  />
                </div>
                {editingExpenseId === expense.id ? (
                  <form
                    className="edit-form"
                    onSubmit={(event) => updateExpense(event, expense.id)}
                  >
                    <label>
                      <span>Кто платил</span>
                      <select name="payerId" defaultValue={expense.payerId}>
                        {state.travelers.map((traveler) => (
                          <option key={traveler.id} value={traveler.id}>
                            {traveler.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Сумма</span>
                      <input
                        name="amount"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={expense.amount}
                        required
                      />
                    </label>
                    <label>
                      <span>Валюта</span>
                      <CurrencySelect defaultValue={expense.currency} />
                    </label>
                    <label>
                      <span>Категория</span>
                      <input name="category" defaultValue={expense.category} />
                    </label>
                    <label>
                      <span>Дата</span>
                      <input name="spentAt" type="date" defaultValue={expense.spentAt} />
                    </label>
                    <label className="wide-field">
                      <span>Комментарий</span>
                      <input name="description" defaultValue={expense.description} />
                    </label>
                    <fieldset className="wide-field checkbox-row">
                      <legend>В доле</legend>
                      {state.travelers.map((traveler) => (
                        <label key={traveler.id}>
                          <input
                            name={`share-${traveler.id}`}
                            type="checkbox"
                            defaultChecked={shares.some(
                              (share) => share.travelerId === traveler.id,
                            )}
                          />
                          <span>{traveler.name}</span>
                        </label>
                      ))}
                    </fieldset>
                    <SaveCancelActions onCancel={() => setEditingExpenseId(null)} />
                  </form>
                ) : null}
                <p>
                  <strong>{formatRawMoney(expense.amount, expense.currency)}</strong>{' '}
                  оплатил {payer.name}
                </p>
                <p className="muted-text">
                  В доле: {shares.map((share) => getTraveler(state.travelers, share.travelerId).name).join(', ')}
                </p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function NotesView({ state, commit }: { state: TripState; commit: Commit }) {
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null)
  const [editingChecklistItemId, setEditingChecklistItemId] = useState<
    string | null
  >(null)

  function addChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const title = getFormString(data, 'title')
    if (!title) return

    commit((previous) => ({
      ...previous,
      checklists: [
        ...previous.checklists,
        {
          id: makeId('checklist'),
          title,
          kind: getFormString(data, 'kind') as Checklist['kind'],
        },
      ],
    }))
    form.reset()
  }

  function addChecklistItem(event: FormEvent<HTMLFormElement>, checklist: Checklist) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const text = getFormString(data, 'text')
    if (!text) return

    commit((previous) => ({
      ...previous,
      checklistItems: [
        ...previous.checklistItems,
        {
          id: makeId('check-item'),
          checklistId: checklist.id,
          text,
          done: false,
          sortOrder: nextChecklistOrder(previous.checklistItems, checklist.id),
        },
      ],
    }))
    form.reset()
  }

  function updateChecklist(event: FormEvent<HTMLFormElement>, checklistId: string) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const title = getFormString(data, 'title')
    if (!title) return

    commit((previous) => ({
      ...previous,
      checklists: previous.checklists.map((checklist) =>
        checklist.id === checklistId
          ? {
              ...checklist,
              title,
              kind: getFormString(data, 'kind') as Checklist['kind'],
            }
          : checklist,
      ),
    }))
    setEditingChecklistId(null)
  }

  function updateChecklistItem(
    event: FormEvent<HTMLFormElement>,
    itemId: string,
  ) {
    event.preventDefault()
    const text = getFormString(new FormData(event.currentTarget), 'text')
    if (!text) return

    commit((previous) => ({
      ...previous,
      checklistItems: previous.checklistItems.map((item) =>
        item.id === itemId ? { ...item, text } : item,
      ),
    }))
    setEditingChecklistItemId(null)
  }

  return (
    <section className="view-stack" aria-labelledby="notes-title">
      <SectionHeading
        eyebrow="Общее"
        title="Заметки"
        aside={`${state.checklistItems.filter((item) => !item.done).length} открыто`}
      />
      <form className="quick-form" onSubmit={addChecklist}>
        <label>
          <span>Список</span>
          <input name="title" placeholder="Аптечка" required />
        </label>
        <label>
          <span>Тип</span>
          <select name="kind" defaultValue="notes">
            <option value="notes">Заметки</option>
            <option value="packing">Что взять</option>
            <option value="visa">Визы</option>
            <option value="phrases">Фразы</option>
          </select>
        </label>
        <button className="icon-button primary" type="submit" title="Добавить список">
          <Plus size={20} />
        </button>
      </form>

      <div className="checklist-grid">
        {state.checklists.map((checklist) => {
          const items = state.checklistItems
            .filter((item) => item.checklistId === checklist.id)
            .sort((left, right) => left.sortOrder - right.sortOrder)

          return (
            <article className="checklist-card" key={checklist.id}>
              <div className="title-row">
                <div>
                  <p className="tag">{checklistKindLabel(checklist.kind)}</p>
                  <h3>{checklist.title}</h3>
                </div>
                <EditDeleteActions
                  deleteTitle="Удалить список"
                  onEdit={() => setEditingChecklistId(checklist.id)}
                  onDelete={() =>
                    commit((previous) => ({
                      ...previous,
                      checklists: previous.checklists.filter(
                        (candidate) => candidate.id !== checklist.id,
                      ),
                      checklistItems: previous.checklistItems.filter(
                        (item) => item.checklistId !== checklist.id,
                      ),
                    }))
                  }
                />
              </div>
              {editingChecklistId === checklist.id ? (
                <form
                  className="edit-form"
                  onSubmit={(event) => updateChecklist(event, checklist.id)}
                >
                  <label>
                    <span>Название</span>
                    <input name="title" defaultValue={checklist.title} required />
                  </label>
                  <label>
                    <span>Тип</span>
                    <select name="kind" defaultValue={checklist.kind}>
                      <option value="notes">Заметки</option>
                      <option value="packing">Что взять</option>
                      <option value="visa">Визы</option>
                      <option value="phrases">Фразы</option>
                    </select>
                  </label>
                  <SaveCancelActions onCancel={() => setEditingChecklistId(null)} />
                </form>
              ) : null}
              <div className="checklist-items">
                {items.map((item) =>
                  editingChecklistItemId === item.id ? (
                    <form
                      className="check-item check-item-edit"
                      key={item.id}
                      onSubmit={(event) => updateChecklistItem(event, item.id)}
                    >
                      <input name="text" defaultValue={item.text} autoFocus />
                      <div className="action-cluster compact">
                        <button
                          className="icon-button tiny quiet"
                          type="button"
                          title="Отмена"
                          onClick={() => setEditingChecklistItemId(null)}
                        >
                          <X size={15} />
                        </button>
                        <button
                          className="icon-button tiny primary"
                          type="submit"
                          title="Сохранить"
                        >
                          <Save size={15} />
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="check-item" key={item.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={(event) =>
                            commit((previous) => ({
                              ...previous,
                              checklistItems: previous.checklistItems.map(
                                (candidate) =>
                                  candidate.id === item.id
                                    ? { ...candidate, done: event.target.checked }
                                    : candidate,
                              ),
                            }))
                          }
                        />
                        <span>{item.text}</span>
                      </label>
                      <div className="action-cluster compact">
                        <button
                          className="icon-button tiny quiet"
                          type="button"
                          title="Редактировать пункт"
                          onClick={() => setEditingChecklistItemId(item.id)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-button tiny quiet"
                          type="button"
                          title="Удалить пункт"
                          onClick={() =>
                            commit((previous) => ({
                              ...previous,
                              checklistItems: previous.checklistItems.filter(
                                (candidate) => candidate.id !== item.id,
                              ),
                            }))
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
              <form
                className="inline-note-form"
                onSubmit={(event) => addChecklistItem(event, checklist)}
              >
                <input name="text" placeholder="Новый пункт" />
                <button className="icon-button" type="submit" title="Добавить пункт">
                  <Plus size={18} />
                </button>
              </form>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function SettingsView({
  state,
  commit,
  currentTravelerId,
  onTravelerChange,
  onStateReplace,
  onLock,
}: {
  state: TripState
  commit: Commit
  currentTravelerId: TravelerId
  onTravelerChange: (travelerId: TravelerId) => void
  onStateReplace: (state: TripState) => void
  onLock: () => void
}) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')

  function saveTravelerNames(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    commit((previous) => ({
      ...previous,
      travelers: previous.travelers.map((traveler) => ({
        ...traveler,
        name: getFormString(data, traveler.id) || traveler.name,
      })),
      settings: {
        ...previous.settings,
        cnyToRubRate:
          getFormNumber(data, 'cnyToRubRate') || previous.settings.cnyToRubRate,
        rateUpdatedAt: new Date().toISOString(),
      },
    }))
  }

  async function handleRefreshRate() {
    setIsRefreshing(true)
    setRefreshError('')
    try {
      const next = await refreshRate()
      onStateReplace(next)
    } catch {
      setRefreshError('Курс не обновился')
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <section className="view-stack" aria-labelledby="settings-title">
      <SectionHeading
        eyebrow="PIN и PWA"
        title="Настройки"
        aside={`1 CNY = ${state.settings.cnyToRubRate.toFixed(2)} RUB`}
      />

      <div className="settings-block">
        <h3>Я сейчас</h3>
        <div className="traveler-switcher">
          {state.travelers.map((traveler) => (
            <button
              key={traveler.id}
              type="button"
              className={currentTravelerId === traveler.id ? 'active' : ''}
              onClick={() => onTravelerChange(traveler.id)}
            >
              <span
                className="traveler-dot"
                style={{ backgroundColor: traveler.color }}
              />
              <span>{traveler.name}</span>
            </button>
          ))}
        </div>
      </div>

      <form className="settings-block form-stack" onSubmit={saveTravelerNames}>
        <h3>Путешественники и курс</h3>
        {state.travelers.map((traveler) => (
          <label key={traveler.id}>
            <span>{traveler.name}</span>
            <input name={traveler.id} defaultValue={traveler.name} />
          </label>
        ))}
        <label>
          <span>CNY → RUB</span>
          <input
            name="cnyToRubRate"
            type="number"
            min="0"
            step="0.0001"
            defaultValue={state.settings.cnyToRubRate}
          />
        </label>
        <div className="button-row">
          <button className="secondary-button" type="submit">
            <Check size={18} />
            <span>Сохранить</span>
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={isRefreshing}
            onClick={handleRefreshRate}
          >
            <RefreshCw className={isRefreshing ? 'spin' : ''} size={18} />
            <span>Обновить курс</span>
          </button>
        </div>
        {refreshError ? <p className="form-error">{refreshError}</p> : null}
        <p className="muted-text">
          Обновлено: {formatDateTime(state.settings.rateUpdatedAt)}
        </p>
      </form>

      <div className="settings-block">
        <h3>На экран iPhone</h3>
        <p className="muted-text">
          Safari → Share → Add to Home Screen. Иконка и manifest уже лежат в
          public.
        </p>
      </div>

      <button className="danger-button" type="button" onClick={onLock}>
        <LockKeyhole size={18} />
        <span>Заблокировать</span>
      </button>
    </section>
  )
}

function DayItemRow({
  item,
  state,
  onRemove,
  onSaveNote,
}: {
  item: DayItem
  state: TripState
  onRemove: () => void
  onSaveNote?: (note: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const entity = getDayItemEntity(item, state)

  function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const note = getFormString(new FormData(event.currentTarget), 'note')
    if (!note) return
    onSaveNote?.(note)
    setIsEditing(false)
  }

  if (item.kind === 'note' && isEditing) {
    return (
      <form className="day-item-row day-item-edit" onSubmit={saveNote}>
        <div className="day-item-kind">{dayItemIcon(item.kind)}</div>
        <input name="note" defaultValue={item.note ?? ''} autoFocus />
        <div className="action-cluster compact">
          <button
            className="icon-button tiny quiet"
            type="button"
            title="Отмена"
            onClick={() => setIsEditing(false)}
          >
            <X size={15} />
          </button>
          <button className="icon-button tiny primary" type="submit" title="Сохранить">
            <Save size={15} />
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="day-item-row">
      <div className="day-item-kind">{dayItemIcon(item.kind)}</div>
      <div>
        <strong>{entity.title}</strong>
        {entity.subtitle ? <p>{entity.subtitle}</p> : null}
      </div>
      <div className="action-cluster compact">
        {item.kind === 'note' ? (
          <button
            className="icon-button tiny quiet"
            type="button"
            title="Редактировать заметку"
            onClick={() => setIsEditing(true)}
          >
            <Pencil size={15} />
          </button>
        ) : null}
        <button
          className="icon-button tiny quiet"
          type="button"
          title="Убрать из дня"
          onClick={onRemove}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string
  title: string
  aside?: string
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {aside ? <span>{aside}</span> : null}
    </div>
  )
}

function EditDeleteActions({
  onEdit,
  onDelete,
  deleteTitle,
}: {
  onEdit: () => void
  onDelete: () => void
  deleteTitle: string
}) {
  return (
    <div className="action-cluster">
      <button
        className="icon-button quiet"
        type="button"
        title="Редактировать"
        onClick={onEdit}
      >
        <Pencil size={18} />
      </button>
      <button
        className="icon-button quiet"
        type="button"
        title={deleteTitle}
        onClick={onDelete}
      >
        <Trash2 size={18} />
      </button>
    </div>
  )
}

function SaveCancelActions({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="edit-actions">
      <button className="secondary-button" type="button" onClick={onCancel}>
        <X size={18} />
        <span>Отмена</span>
      </button>
      <button className="primary-button" type="submit">
        <Save size={18} />
        <span>Сохранить</span>
      </button>
    </div>
  )
}

function DaySelect({
  days,
  defaultValue = '',
}: {
  days: Day[]
  defaultValue?: string
}) {
  return (
    <select name="dayId" defaultValue={defaultValue}>
      <option value="">Не привязывать</option>
      {[...days]
        .sort((left, right) => left.date.localeCompare(right.date))
        .map((day) => (
          <option key={day.id} value={day.id}>
            {formatShortDate(day.date)} · {day.city}
          </option>
        ))}
    </select>
  )
}

function CurrencySelect({ defaultValue = 'CNY' }: { defaultValue?: Currency }) {
  return (
    <select name="currency" defaultValue={defaultValue}>
      <option value="CNY">CNY</option>
      <option value="RUB">RUB</option>
    </select>
  )
}

function ExternalLinkButton({ href, label }: { href: string; label: string }) {
  if (!href) return null
  return (
    <a className="link-chip" href={href} target="_blank" rel="noreferrer">
      <ExternalLink size={14} />
      <span>{label}</span>
    </a>
  )
}

function useLocalStorageState<T extends string>(
  key: string,
  fallback: T,
  guard: (value: string) => value is T,
) {
  const [value, setValue] = useState<T>(fallback)

  useEffect(() => {
    const stored = window.localStorage.getItem(key)
    if (stored && guard(stored)) setValue(stored)
  }, [guard, key])

  useEffect(() => {
    window.localStorage.setItem(key, String(value))
  }, [key, value])

  return [value, setValue] as const
}

function getDayItemEntity(item: DayItem, state: TripState) {
  if (item.kind === 'place') {
    const place = state.places.find((candidate) => candidate.id === item.refId)
    return {
      title: place?.name ?? 'Место',
      subtitle: place ? `${place.city} · ${placeCategoryLabel(place.category)}` : '',
    }
  }

  if (item.kind === 'hotel') {
    const hotel = state.hotels.find((candidate) => candidate.id === item.refId)
    return {
      title: hotel?.name ?? 'Отель',
      subtitle: hotel ? `${hotel.city} · ${formatShortDate(hotel.checkIn)}` : '',
    }
  }

  if (item.kind === 'ticket') {
    const ticket = state.tickets.find((candidate) => candidate.id === item.refId)
    return {
      title: ticket ? `${ticket.fromCity} → ${ticket.toCity}` : 'Билет',
      subtitle: ticket ? formatDateTime(ticket.departAt) : '',
    }
  }

  return {
    title: item.title ?? 'Заметка',
    subtitle: item.note ?? '',
  }
}

function getTraveler(travelers: Traveler[], travelerId: TravelerId) {
  return (
    travelers.find((traveler) => traveler.id === travelerId) ??
    travelers[0] ?? { id: travelerId, name: travelerId, color: '#64748b', sortOrder: 0 }
  )
}

function getFormString(data: FormData, name: string) {
  const value = data.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function getFormNumber(data: FormData, name: string) {
  const value = Number(getFormString(data, name))
  return Number.isFinite(value) ? value : 0
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nextSortOrder(items: DayItem[], dayId: string) {
  const dayItems = items.filter((item) => item.dayId === dayId)
  return dayItems.length
    ? Math.max(...dayItems.map((item) => item.sortOrder)) + 10
    : 10
}

function nextChecklistOrder(items: TripState['checklistItems'], checklistId: string) {
  const checklistItems = items.filter((item) => item.checklistId === checklistId)
  return checklistItems.length
    ? Math.max(...checklistItems.map((item) => item.sortOrder)) + 10
    : 10
}

function getLinkedDayId(
  items: DayItem[],
  kind: Exclude<DayItemKind, 'note'>,
  refId: string,
) {
  return (
    items.find((item) => item.kind === kind && item.refId === refId)?.dayId ?? ''
  )
}

function syncDayItemLink(
  items: DayItem[],
  kind: Exclude<DayItemKind, 'note'>,
  refId: string,
  dayId: string,
) {
  const existing = items.find((item) => item.kind === kind && item.refId === refId)
  const filtered = items.filter(
    (item) => !(item.kind === kind && item.refId === refId),
  )

  if (!dayId) return filtered

  return [
    ...filtered,
    {
      id: existing?.id ?? makeId('day-item'),
      dayId,
      kind,
      refId,
      sortOrder:
        existing?.dayId === dayId
          ? existing.sortOrder
          : nextSortOrder(filtered, dayId),
    },
  ]
}

function isTabId(value: string): value is TabId {
  return tabs.some((tab) => tab.id === value)
}

function isTravelerId(value: string): value is TravelerId {
  return travelerIds.includes(value as TravelerId)
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function formatRawMoney(amount: number, currency: Currency) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'CNY' ? 2 : 0,
  }).format(amount || 0)
}

function formatShortDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
}

function formatDateTime(value: string) {
  if (!value) return '—'
  const normalized = value.includes('T') ? value : `${value}T12:00`
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(normalized))
}

function formatDayNumber(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit' }).format(
    new Date(`${value}T12:00:00`),
  )
}

function formatMonth(value: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('ru-RU', { month: 'short' }).format(
    new Date(`${value}T12:00:00`),
  )
}

function formatWeekday(value: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${value}T12:00:00`))
}

function placeCategoryLabel(category: PlaceCategory) {
  const labels: Record<PlaceCategory, string> = {
    sight: 'Достопримечательность',
    food: 'Еда',
    shopping: 'Шопинг',
  }
  return labels[category]
}

function ticketKindLabel(kind: TicketKind) {
  const labels: Record<TicketKind, string> = {
    flight: 'Самолёт',
    train: 'Поезд',
    'metro-pass': 'Метро-пасс',
  }
  return labels[kind]
}

function checklistKindLabel(kind: Checklist['kind']) {
  const labels: Record<Checklist['kind'], string> = {
    notes: 'Заметки',
    packing: 'Что взять',
    visa: 'Визы',
    phrases: 'Фразы',
  }
  return labels[kind]
}

function ticketIcon(kind: TicketKind) {
  if (kind === 'flight') return <Plane size={22} />
  if (kind === 'train') return <Train size={22} />
  return <Ticket size={22} />
}

function dayItemIcon(kind: DayItemKind) {
  const iconMap: Record<DayItemKind, ReactNode> = {
    place: <MapPin size={17} />,
    hotel: <Building2 size={17} />,
    ticket: <Ticket size={17} />,
    note: <NotebookPen size={17} />,
  }
  return iconMap[kind]
}

function placeIcon(category: PlaceCategory) {
  const iconMap: Record<PlaceCategory, ReactNode> = {
    sight: <Landmark size={18} />,
    food: <Utensils size={18} />,
    shopping: <ShoppingBag size={18} />,
  }
  return iconMap[category]
}

function pluralRu(count: number, forms: [string, string, string]) {
  const mod10 = Math.abs(count) % 10
  const mod100 = Math.abs(count) % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}
