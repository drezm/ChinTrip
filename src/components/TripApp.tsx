import {
  Building2,
  Calculator,
  CalendarDays,
  CalendarPlus,
  Check,
  CircleDollarSign,
  Clock,
  ExternalLink,
  FileText,
  ImageIcon,
  KeyRound,
  Landmark,
  Languages,
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
  QrCode,
  Save,
  Settings,
  ShoppingBag,
  Ticket,
  Train,
  Trash2,
  UserRound,
  Utensils,
  Volume2,
  WalletCards,
  Wifi,
  WifiOff,
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
  | 'today'
  | 'route'
  | 'places'
  | 'expenses'
  | 'more'

type MoreSectionId =
  | 'documents'
  | 'phrases'
  | 'hotels'
  | 'tickets'
  | 'notes'
  | 'settings'

type Commit = (updater: (state: TripState) => TripState) => void

interface TripAppProps {
  initialState: TripState
}

const tabs: Array<{ id: TabId; label: string; icon: ReactNode }> = [
  { id: 'today', label: 'Сегодня', icon: <CalendarDays size={20} /> },
  { id: 'route', label: 'Маршрут', icon: <Map size={20} /> },
  { id: 'places', label: 'Места', icon: <MapPin size={20} /> },
  { id: 'expenses', label: 'Деньги', icon: <ReceiptText size={20} /> },
  { id: 'more', label: 'Ещё', icon: <Settings size={20} /> },
]

const travelerIds: TravelerId[] = ['traveler-a', 'traveler-b', 'traveler-c']

const moreSections: Array<{ id: MoreSectionId; label: string; icon: ReactNode }> = [
  { id: 'documents', label: 'Документы', icon: <QrCode size={18} /> },
  { id: 'phrases', label: 'Фразы', icon: <Languages size={18} /> },
  { id: 'hotels', label: 'Отели', icon: <Building2 size={18} /> },
  { id: 'tickets', label: 'Билеты', icon: <Ticket size={18} /> },
  { id: 'notes', label: 'Заметки', icon: <ListChecks size={18} /> },
  { id: 'settings', label: 'Настройки', icon: <Settings size={18} /> },
]

const phraseLibrary = [
  {
    id: 'hello',
    zh: '你好',
    pinyin: 'Nǐ hǎo',
    ru: 'Здравствуйте',
  },
  {
    id: 'thanks',
    zh: '谢谢',
    pinyin: 'Xiè xie',
    ru: 'Спасибо',
  },
  {
    id: 'how-much',
    zh: '这个多少钱？',
    pinyin: 'Zhège duōshǎo qián?',
    ru: 'Сколько это стоит?',
  },
  {
    id: 'no-spicy',
    zh: '不要辣',
    pinyin: 'Bù yào là',
    ru: 'Не остро, пожалуйста',
  },
  {
    id: 'three-people',
    zh: '三个人',
    pinyin: 'Sān gè rén',
    ru: 'Три человека',
  },
  {
    id: 'toilet',
    zh: '洗手间在哪里？',
    pinyin: 'Xǐshǒujiān zài nǎlǐ?',
    ru: 'Где туалет?',
  },
  {
    id: 'card',
    zh: '可以刷卡吗？',
    pinyin: 'Kěyǐ shuākǎ ma?',
    ru: 'Можно оплатить картой?',
  },
  {
    id: 'taxi',
    zh: '请帮我叫车',
    pinyin: 'Qǐng bāng wǒ jiào chē',
    ru: 'Помогите вызвать такси',
  },
  {
    id: 'slowly',
    zh: '请说慢一点',
    pinyin: 'Qǐng shuō màn yīdiǎn',
    ru: 'Говорите помедленнее',
  },
  {
    id: 'station',
    zh: '火车站怎么走？',
    pinyin: 'Huǒchēzhàn zěnme zǒu?',
    ru: 'Как пройти к вокзалу?',
  },
]

export function TripApp({ initialState }: TripAppProps) {
  const router = useRouter()
  const [state, setState] = useState(initialState)
  const [activeTab, setActiveTab] = useLocalStorageState<TabId>(
    'china-trip.active-tab',
    'today',
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
  const pendingSave = useRef<TripState | null>(null)
  const isSaving = useRef(false)
  const isOnline = useOnlineStatus()
  const rateRefreshAttempted = useRef(false)

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

  async function flushSaveQueue() {
    if (isSaving.current) return
    isSaving.current = true
    setSaveStatus('saving')

    try {
      while (pendingSave.current) {
        const next = pendingSave.current
        pendingSave.current = null
        const saved = await saveTripState({ data: next })

        if (!pendingSave.current) {
          setState(saved)
          setSaveStatus('saved')
        }
      }
    } catch {
      if (!pendingSave.current) setSaveStatus('error')
    } finally {
      isSaving.current = false
      if (pendingSave.current) void flushSaveQueue()
    }
  }

  function queueSave(next: TripState) {
    pendingSave.current = next
    setSaveStatus('saving')
    void flushSaveQueue()
  }

  const commit: Commit = (updater) => {
    setState((previous) => {
      const next = updater(previous)
      queueSave(next)
      return next
    })
  }

  useEffect(() => {
    if (!isOnline || rateRefreshAttempted.current) return
    if (isRateFresh(state.settings.rateUpdatedAt)) return

    rateRefreshAttempted.current = true
    void refreshRate()
      .then((next) => {
        setState((previous) => ({ ...previous, settings: next.settings }))
      })
      .catch(() => {
        rateRefreshAttempted.current = false
      })
  }, [isOnline, state.settings.rateUpdatedAt])

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
        <div className={`network-pill ${isOnline ? 'online' : 'offline'}`}>
          {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
          <span>{isOnline ? 'Онлайн' : 'Офлайн'}</span>
        </div>
      </section>

      <section className="overview-grid" aria-label="Краткая сводка">
        <article className="overview-card">
          <CalendarDays size={18} />
          <div>
            <span>Ближайший день</span>
            <strong>
              {nextDay ? `${formatShortDate(nextDay.date)} · ${nextDay.city}` : '—'}
            </strong>
          </div>
        </article>
        <article className="overview-card">
          <Building2 size={18} />
          <div>
            <span>База</span>
            <strong>
              {nextHotel
                ? `${nextHotel.city} · ${formatShortDate(nextHotel.checkIn)}`
                : '—'}
            </strong>
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
        {activeTab === 'today' ? (
          <TodayView state={state} commit={commit} />
        ) : null}
        {activeTab === 'route' ? (
          <RouteView state={state} commit={commit} />
        ) : null}
        {activeTab === 'places' ? (
          <PlacesView state={state} commit={commit} />
        ) : null}
        {activeTab === 'expenses' ? (
          <ExpensesView
            state={state}
            commit={commit}
            currentTravelerId={currentTravelerId}
          />
        ) : null}
        {activeTab === 'more' ? (
          <MoreView
            state={state}
            commit={commit}
            currentTravelerId={currentTravelerId}
            onTravelerChange={setCurrentTravelerId}
            onStateReplace={(next) => {
              setState(next)
              queueSave(next)
            }}
            onLock={handleLock}
          />
        ) : null}
      </main>

      <CurrencyCalculator
        rate={state.settings.cnyToRubRate}
        rateUpdatedAt={state.settings.rateUpdatedAt}
      />

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

function TodayView({
  state,
  commit,
}: {
  state: TripState
  commit: Commit
}) {
  const sortedDays = [...state.days].sort((left, right) =>
    left.date.localeCompare(right.date),
  )
  const today = todayDate()
  const currentTime = useMinuteClock()
  const dayIndex = sortedDays.findIndex((day) => day.date >= today)
  const activeDay =
    sortedDays.find((day) => day.date === today) ??
    (dayIndex >= 0 ? sortedDays[dayIndex] : sortedDays[sortedDays.length - 1])
  const dayItems = activeDay
    ? state.dayItems
        .filter((item) => item.dayId === activeDay.id)
        .sort((left, right) => left.sortOrder - right.sortOrder)
    : []
  const openChecklistItems = state.checklistItems
    .filter((item) => !item.done)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, 5)

  function toggleChecklistItem(itemId: string, done: boolean) {
    commit((previous) => ({
      ...previous,
      checklistItems: previous.checklistItems.map((item) =>
        item.id === itemId ? { ...item, done } : item,
      ),
    }))
  }

  return (
    <section className="view-stack" aria-labelledby="today-title">
      <SectionHeading
        eyebrow={activeDay?.date === today ? 'Сегодня' : 'Ближайший день'}
        title={activeDay ? activeDay.city : 'План'}
        aside={activeDay ? formatWeekday(activeDay.date) : undefined}
      />

      <TimeZoneStrip now={currentTime} />

      <div className="today-grid">
        <article className="hub-card">
          <div className="title-row">
            <div>
              <p className="eyebrow">План</p>
              <h3>На день</h3>
            </div>
            <MapPin size={20} />
          </div>
          <div className="compact-list">
            {dayItems.length ? (
              dayItems.map((item) => (
                <CompactDayItem key={item.id} item={item} state={state} />
              ))
            ) : (
              <p className="empty-text">Пока нет привязанных мест и заметок</p>
            )}
          </div>
        </article>

        <article className="hub-card">
          <div className="title-row">
            <div>
              <p className="eyebrow">Чеклист</p>
              <h3>Не забыть</h3>
            </div>
            <ListChecks size={20} />
          </div>
          <div className="checklist-items compact-checklist">
            {openChecklistItems.length ? (
              openChecklistItems.map((item) => (
                <label className="check-item" key={item.id}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={(event) =>
                      toggleChecklistItem(item.id, event.target.checked)
                    }
                  />
                  <span>{item.text}</span>
                </label>
              ))
            ) : (
              <p className="empty-text">Все открытые пункты закрыты</p>
            )}
          </div>
        </article>

      </div>
    </section>
  )
}

function MoreView({
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
  const [activeSection, setActiveSection] =
    useLocalStorageState<MoreSectionId>(
      'china-trip.more-section',
      'documents',
      isMoreSectionId,
    )

  return (
    <section className="view-stack" aria-labelledby="more-title">
      <div className="more-switcher" aria-label="Дополнительно">
        {moreSections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={activeSection === section.id ? 'active' : ''}
            aria-pressed={activeSection === section.id}
            onClick={() => setActiveSection(section.id)}
          >
            {section.icon}
            <span>{section.label}</span>
          </button>
        ))}
      </div>

      {activeSection === 'documents' ? (
        <DocumentsView state={state} commit={commit} />
      ) : null}
      {activeSection === 'phrases' ? (
        <PhrasesView state={state} commit={commit} />
      ) : null}
      {activeSection === 'hotels' ? (
        <HotelsView state={state} commit={commit} />
      ) : null}
      {activeSection === 'tickets' ? (
        <TicketsView state={state} commit={commit} />
      ) : null}
      {activeSection === 'notes' ? (
        <NotesView state={state} commit={commit} />
      ) : null}
      {activeSection === 'settings' ? (
        <SettingsView
          state={state}
          commit={commit}
          currentTravelerId={currentTravelerId}
          onTravelerChange={onTravelerChange}
          onStateReplace={onStateReplace}
          onLock={onLock}
        />
      ) : null}
    </section>
  )
}

function RouteView({ state, commit }: { state: TripState; commit: Commit }) {
  const [editingDayId, setEditingDayId] = useState<string | null>(null)
  const [detailItem, setDetailItem] = useState<DayItem | null>(null)
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

      <RouteMapPanel state={state} />

      <CreateDetails title="Добавить день" icon={<CalendarPlus size={18} />}>
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
      </CreateDetails>

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
                        onOpenDetails={
                          item.kind === 'place' || item.kind === 'hotel'
                            ? () => setDetailItem(item)
                            : undefined
                        }
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
      {detailItem ? (
        <RouteItemDetailModal
          item={detailItem}
          state={state}
          onClose={() => setDetailItem(null)}
        />
      ) : null}
    </section>
  )
}

function PlacesView({ state, commit }: { state: TripState; commit: Commit }) {
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null)
  const [activeSectionId, setActiveSectionId] = useLocalStorageState(
    'china-trip.place-section',
    'all',
    isPlaceSectionFilter,
  )
  const [isAddingSection, setIsAddingSection] = useState(false)
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const placeSections = getPlaceSections(state)
  const visiblePlaces =
    activeSectionId === 'all'
      ? state.places
      : state.places.filter((place) => place.category === activeSectionId)

  async function addPlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const name = getFormString(data, 'name')
    const city = getFormString(data, 'city')
    if (!name || !city) return
    const dayId = getFormString(data, 'dayId') || undefined
    const id = makeId('place')
    const category = getFormString(data, 'category') || placeSections[0]?.id || 'sight'
    let photoUrl = ''

    try {
      photoUrl = await getPlacePhotosValue(data, '')
    } catch (error) {
      window.alert(getErrorMessage(error))
      return
    }

    commit((previous) => ({
      ...previous,
      places: [
        {
          id,
          name,
          city,
          category,
          url: getFormString(data, 'url'),
          note: getFormString(data, 'note'),
          photoUrl,
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

  async function updatePlace(event: FormEvent<HTMLFormElement>, placeId: string) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = getFormString(data, 'name')
    const city = getFormString(data, 'city')
    if (!name || !city) return
    const dayId = getFormString(data, 'dayId')
    const currentPlace = state.places.find((place) => place.id === placeId)
    let photoUrl = currentPlace?.photoUrl ?? ''

    try {
      photoUrl = await getPlacePhotosValue(data, photoUrl)
    } catch (error) {
      window.alert(getErrorMessage(error))
      return
    }

    commit((previous) => ({
      ...previous,
      places: previous.places.map((place) =>
        place.id === placeId
          ? {
              ...place,
              name,
              city,
              category: getFormString(data, 'category') || place.category,
              url: getFormString(data, 'url'),
              note: getFormString(data, 'note'),
              photoUrl,
              status: getFormString(data, 'status') as PlaceStatus,
              dayId: dayId || undefined,
            }
          : place,
      ),
      dayItems: syncDayItemLink(previous.dayItems, 'place', placeId, dayId),
    }))
    setEditingPlaceId(null)
  }

  function addPlaceSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const title = getFormString(new FormData(form), 'title')
    if (!title) return
    const id = makePlaceSectionId(title, placeSections)

    commit((previous) => {
      const existingSections = getPlaceSections(previous)

      return {
        ...previous,
        placeSections: [
          ...previous.placeSections,
          {
            id,
            title,
            sortOrder: nextPlaceSectionOrder(existingSections),
          },
        ],
      }
    })
    setActiveSectionId(id)
    setIsAddingSection(false)
    form.reset()
  }

  function updatePlaceSection(event: FormEvent<HTMLFormElement>, sectionId: string) {
    event.preventDefault()
    const title = getFormString(new FormData(event.currentTarget), 'title')
    if (!title) return

    commit((previous) => ({
      ...previous,
      placeSections: getPlaceSections(previous).map((section) =>
        section.id === sectionId ? { ...section, title } : section,
      ),
    }))
    setEditingSectionId(null)
  }

  function removePlaceSection(sectionId: string) {
    const fallbackSection =
      placeSections.find((section) => section.id !== sectionId) ?? placeSections[0]
    if (!fallbackSection || fallbackSection.id === sectionId) return

    commit((previous) => ({
      ...previous,
      placeSections: previous.placeSections.filter(
        (section) => section.id !== sectionId,
      ),
      places: previous.places.map((place) =>
        place.category === sectionId
          ? { ...place, category: fallbackSection.id }
          : place,
      ),
    }))
    if (activeSectionId === sectionId) setActiveSectionId(fallbackSection.id)
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
        aside={`${visiblePlaces.length}/${state.places.length} ${pluralRu(state.places.length, ['точка', 'точки', 'точек'])}`}
      />
      <article className="place-sections-panel">
        <div className="place-section-list" aria-label="Разделы мест">
          <button
            className={`place-section-chip ${activeSectionId === 'all' ? 'active' : ''}`}
            type="button"
            onClick={() => setActiveSectionId('all')}
          >
            <strong>Все</strong>
            <span>{state.places.length}</span>
          </button>
          {placeSections.map((section) => {
            const count = state.places.filter(
              (place) => place.category === section.id,
            ).length
            const isActive = activeSectionId === section.id

            return (
              <div
                className={`place-section-chip managed ${isActive ? 'active' : ''}`}
                key={section.id}
              >
                {editingSectionId === section.id ? (
                  <form
                    className="section-edit-form"
                    onSubmit={(event) => updatePlaceSection(event, section.id)}
                  >
                    <input name="title" defaultValue={section.title} autoFocus />
                    <button type="submit" title="Сохранить">
                      <Save size={14} />
                    </button>
                    <button
                      type="button"
                      title="Отмена"
                      onClick={() => setEditingSectionId(null)}
                    >
                      <X size={14} />
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      className="section-select-button"
                      type="button"
                      onClick={() => setActiveSectionId(section.id)}
                    >
                      {placeIcon(section.id)}
                      <strong>{section.title}</strong>
                      <span>{count}</span>
                    </button>
                    <button
                      className="section-action-button"
                      type="button"
                      title="Переименовать раздел"
                      onClick={() => setEditingSectionId(section.id)}
                    >
                      <Pencil size={14} />
                    </button>
                    <ConfirmDeleteButton
                      buttonClassName="section-action-button"
                      title="Удалить раздел"
                      disabled={placeSections.length <= 1}
                      onConfirm={() => removePlaceSection(section.id)}
                    >
                      <Trash2 size={14} />
                    </ConfirmDeleteButton>
                  </>
                )}
              </div>
            )
          })}
          {isAddingSection ? (
            <form className="place-section-create" onSubmit={addPlaceSection}>
              <input
                name="title"
                placeholder="Новый раздел"
                autoFocus
                aria-label="Название нового раздела"
              />
              <button type="submit" title="Сохранить раздел">
                <Save size={15} />
              </button>
              <button
                type="button"
                title="Отмена"
                onClick={() => setIsAddingSection(false)}
              >
                <X size={15} />
              </button>
            </form>
          ) : (
            <button
              className="place-section-add"
              type="button"
              title="Создать раздел"
              onClick={() => setIsAddingSection(true)}
            >
              <Plus size={18} />
            </button>
          )}
        </div>
      </article>

      <CreateDetails title="Добавить место" icon={<Plus size={18} />}>
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
            <PlaceSectionSelect sections={placeSections} />
          </label>
          <label>
            <span>День</span>
            <DaySelect days={state.days} />
          </label>
          <label>
            <span>Карта</span>
            <input name="url" placeholder="https://maps..." />
          </label>
          <label className="wide-field">
            <span>Фото из галереи</span>
            <input name="photoFile" type="file" accept="image/*" multiple />
          </label>
          <label className="wide-field">
            <span>Ссылки на фото</span>
            <textarea
              name="photoUrl"
              placeholder="https://... по одной ссылке на строку"
            />
          </label>
          <label className="wide-field">
            <span>Заметка</span>
            <input name="note" placeholder="Что важно помнить" />
          </label>
          <button className="icon-button primary" type="submit" title="Добавить место">
            <Plus size={20} />
          </button>
        </form>
      </CreateDetails>

      <div className="card-grid">
        {visiblePlaces.map((place) => (
          <article className="place-card" key={place.id}>
            <PlaceGallery photos={parsePlacePhotos(place.photoUrl)} />
            <div className="card-body">
              <div className="title-row">
                <div>
                  <p className="tag icon-tag">
                    {placeIcon(place.category)}
                    <span>{placeCategoryLabel(place.category, placeSections)}</span>
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
                  className="edit-form place-edit-form"
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
                    <PlaceSectionSelect
                      sections={placeSections}
                      defaultValue={place.category}
                    />
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
                    <span>Фото из галереи</span>
                    <input name="photoFile" type="file" accept="image/*" multiple />
                  </label>
                  <label className="wide-field">
                    <span>Ссылки на фото</span>
                    <textarea
                      name="photoUrl"
                      defaultValue={editablePlacePhotoText(place.photoUrl)}
                      placeholder={placePhotoInputPlaceholder(place.photoUrl)}
                    />
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
                <MapLinkButton place={place} />
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
      <CreateDetails title="Добавить отель" icon={<Plus size={18} />}>
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
      </CreateDetails>

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
                <DocumentOpenButton value={hotel.confirmationUrl} label="Файл" />
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
      <CreateDetails title="Добавить билет" icon={<Plus size={18} />}>
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
      </CreateDetails>

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
                <DocumentOpenButton value={ticket.fileUrl} label="Файл" />
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

      <CreateDetails title="Добавить трату" icon={<CircleDollarSign size={18} />}>
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
            <input name="amount" type="number" min="0.01" step="0.01" required />
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
      </CreateDetails>

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
                        min="0.01"
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
      <CreateDetails title="Добавить список" icon={<Plus size={18} />}>
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
      </CreateDetails>

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
                        <ConfirmDeleteButton
                          buttonClassName="icon-button tiny quiet"
                          title="Удалить пункт"
                          onConfirm={() =>
                            commit((previous) => ({
                              ...previous,
                              checklistItems: previous.checklistItems.filter(
                                (candidate) => candidate.id !== item.id,
                              ),
                            }))
                          }
                        >
                          <Trash2 size={15} />
                        </ConfirmDeleteButton>
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

function DocumentsView({ state, commit }: { state: TripState; commit: Commit }) {
  const [editingDocId, setEditingDocId] = useState<string | null>(null)
  const visaChecklist = state.checklists.find((checklist) => checklist.kind === 'visa')
  const visaItems = visaChecklist
    ? state.checklistItems
        .filter((item) => item.checklistId === visaChecklist.id)
        .sort((left, right) => left.sortOrder - right.sortOrder)
    : []
  const linkedDocs = [
    ...state.hotels.map((hotel) => ({
      id: `hotel-${hotel.id}`,
      source: 'hotel' as const,
      refId: hotel.id,
      title: hotel.name,
      meta: `${hotel.city} · ${formatShortDate(hotel.checkIn)}-${formatShortDate(hotel.checkOut)}`,
      href: hotel.confirmationUrl || hotel.url,
      editValue: hotel.confirmationUrl,
      icon: <Building2 size={22} />,
      label: 'Бронь отеля',
    })),
    ...state.tickets.map((ticket) => ({
      id: `ticket-${ticket.id}`,
      source: 'ticket' as const,
      refId: ticket.id,
      title: `${ticket.fromCity} → ${ticket.toCity}`,
      meta: `${ticketKindLabel(ticket.kind)} · ${formatDateTime(ticket.departAt)}`,
      href: ticket.fileUrl || ticket.url,
      editValue: ticket.fileUrl,
      icon: ticketIcon(ticket.kind),
      label: 'Билет или QR',
    })),
  ]

  async function addVisaDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const title = getFormString(data, 'title')
    if (!title) return
    let documentValue = ''

    try {
      documentValue = await getDocumentFileValue(data, getFormString(data, 'url'))
    } catch (error) {
      window.alert(getErrorMessage(error))
      return
    }

    commit((previous) => {
      const checklist =
        previous.checklists.find((candidate) => candidate.kind === 'visa') ??
        ({
          id: makeId('checklist'),
          title: 'Визы и документы',
          kind: 'visa',
        } satisfies Checklist)
      const hasChecklist = previous.checklists.some(
        (candidate) => candidate.id === checklist.id,
      )

      return {
        ...previous,
        checklists: hasChecklist
          ? previous.checklists
          : [...previous.checklists, checklist],
        checklistItems: [
          ...previous.checklistItems,
          {
            id: makeId('check-item'),
            checklistId: checklist.id,
            text: formatDocumentText(title, documentValue),
            done: false,
            sortOrder: nextChecklistOrder(previous.checklistItems, checklist.id),
          },
        ],
      }
    })
    form.reset()
  }

  async function saveLinkedDocument(
    event: FormEvent<HTMLFormElement>,
    source: 'hotel' | 'ticket',
    refId: string,
    currentValue: string,
  ) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const typedValue = getFormString(data, 'documentUrl')
    const fallback = typedValue || (isEmbeddedFile(currentValue) ? currentValue : '')
    let value = ''

    try {
      value = await getDocumentFileValue(data, fallback)
    } catch (error) {
      window.alert(getErrorMessage(error))
      return
    }

    commit((previous) =>
      source === 'hotel'
        ? {
            ...previous,
            hotels: previous.hotels.map((hotel) =>
              hotel.id === refId
                ? { ...hotel, confirmationUrl: value }
                : hotel,
            ),
          }
        : {
            ...previous,
            tickets: previous.tickets.map((ticket) =>
              ticket.id === refId ? { ...ticket, fileUrl: value } : ticket,
            ),
          },
    )
    setEditingDocId(null)
  }

  async function updateVisaDocument(
    event: FormEvent<HTMLFormElement>,
    itemId: string,
    currentText: string,
  ) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const title = getFormString(data, 'title')
    if (!title) return
    const existingValue = documentValue(currentText)
    const typedValue = getFormString(data, 'url')
    const fallback = typedValue || (isEmbeddedFile(existingValue) ? existingValue : '')
    let value = ''

    try {
      value = await getDocumentFileValue(data, fallback)
    } catch (error) {
      window.alert(getErrorMessage(error))
      return
    }

    commit((previous) => ({
      ...previous,
      checklistItems: previous.checklistItems.map((item) =>
        item.id === itemId
          ? { ...item, text: formatDocumentText(title, value) }
          : item,
      ),
    }))
    setEditingDocId(null)
  }

  return (
    <section className="view-stack" aria-labelledby="documents-title">
      <SectionHeading
        eyebrow="QR и фото"
        title="Документы"
        aside={`${linkedDocs.length + visaItems.length} ${pluralRu(linkedDocs.length + visaItems.length, ['запись', 'записи', 'записей'])}`}
      />

      <CreateDetails title="Добавить документ" icon={<QrCode size={18} />}>
        <form className="quick-form" onSubmit={addVisaDocument}>
          <label>
            <span>Название</span>
            <input name="title" placeholder="Виза, страховка, QR" required />
          </label>
          <label>
            <span>Ссылка/пометка</span>
            <input name="url" placeholder="Фото, файл или где лежит" />
          </label>
          <label className="wide-field">
            <span>Файл или фото</span>
            <input name="documentFile" type="file" accept="image/*,application/pdf" />
          </label>
          <button className="icon-button primary" type="submit" title="Добавить">
            <Plus size={20} />
          </button>
        </form>
      </CreateDetails>

      <div className="document-grid">
        {linkedDocs.map((doc) => (
          <article className="document-card" key={doc.id}>
            <div className={`document-preview ${doc.href ? 'ready' : ''}`}>
              <DocumentPreview value={doc.href} fallback={<ImageIcon size={34} />} />
            </div>
            <div className="document-body">
              <p className="tag">{doc.label}</p>
              <h3>{doc.title}</h3>
              <p className="muted-text">{doc.meta}</p>
              {editingDocId === doc.id ? (
                <form
                  className="inline-edit-form"
                  onSubmit={(event) =>
                    saveLinkedDocument(event, doc.source, doc.refId, doc.editValue)
                  }
                >
                  <label>
                    <span>Ссылка/пометка</span>
                    <input
                      name="documentUrl"
                      defaultValue={editableDocumentValue(doc.editValue)}
                      placeholder={documentInputPlaceholder(doc.editValue)}
                      autoFocus
                    />
                  </label>
                  <label>
                    <span>Файл или фото</span>
                    <input
                      name="documentFile"
                      type="file"
                      accept="image/*,application/pdf"
                    />
                  </label>
                  <SaveCancelActions onCancel={() => setEditingDocId(null)} />
                </form>
              ) : (
                <div className="card-actions">
                  <button
                    className="chip-button"
                    type="button"
                    onClick={() => setEditingDocId(doc.id)}
                  >
                    <Pencil size={14} />
                    <span>{doc.href ? 'Изменить' : 'Добавить'}</span>
                  </button>
                  <DocumentOpenButton
                    value={doc.href}
                    label={documentOpenLabel(doc.href)}
                  />
                </div>
              )}
            </div>
          </article>
        ))}

        {visaItems.map((item) => {
          const value = documentValue(item.text)

          return (
            <article className="document-card" key={item.id}>
              <div className={`document-preview ${value ? 'ready' : ''}`}>
                <DocumentPreview value={value} fallback={<KeyRound size={34} />} />
              </div>
              <div className="document-body">
                <p className="tag">Документ</p>
                {editingDocId === item.id ? (
                  <form
                    className="inline-edit-form"
                    onSubmit={(event) => updateVisaDocument(event, item.id, item.text)}
                  >
                    <label>
                      <span>Название</span>
                      <input
                        name="title"
                        defaultValue={documentTitle(item.text)}
                        autoFocus
                        required
                      />
                    </label>
                    <label>
                      <span>Ссылка/пометка</span>
                      <input
                        name="url"
                        defaultValue={editableDocumentValue(value)}
                        placeholder={documentInputPlaceholder(value)}
                      />
                    </label>
                    <label>
                      <span>Файл или фото</span>
                      <input
                        name="documentFile"
                        type="file"
                        accept="image/*,application/pdf"
                      />
                    </label>
                    <SaveCancelActions onCancel={() => setEditingDocId(null)} />
                  </form>
                ) : (
                  <>
                    <h3>{documentTitle(item.text)}</h3>
                    <p className="muted-text">{documentMeta(item.text)}</p>
                    <div className="card-actions">
                      <button
                        className="chip-button"
                        type="button"
                        onClick={() => setEditingDocId(item.id)}
                      >
                        <Pencil size={14} />
                        <span>Править</span>
                      </button>
                      <ConfirmDeleteButton
                        buttonClassName="chip-button"
                        title="Удалить документ"
                        onConfirm={() =>
                          commit((previous) => ({
                            ...previous,
                            checklistItems: previous.checklistItems.filter(
                              (candidate) => candidate.id !== item.id,
                            ),
                          }))
                        }
                      >
                        <Trash2 size={14} />
                        <span>Удалить</span>
                      </ConfirmDeleteButton>
                      <DocumentOpenButton
                        value={value}
                        label={documentOpenLabel(value)}
                      />
                    </div>
                  </>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function PhrasesView({ state, commit }: { state: TripState; commit: Commit }) {
  const [editingPhraseId, setEditingPhraseId] = useState<string | null>(null)
  const phraseChecklist = state.checklists.find(
    (checklist) => checklist.kind === 'phrases',
  )
  const savedPhrases = phraseChecklist
    ? state.checklistItems
        .filter((item) => item.checklistId === phraseChecklist.id)
        .sort((left, right) => left.sortOrder - right.sortOrder)
    : []

  function addPhrase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const zh = getFormString(data, 'zh')
    const ru = getFormString(data, 'ru')
    const pinyin = getFormString(data, 'pinyin')
    if (!zh || !ru) return

    commit((previous) => {
      const checklist =
        previous.checklists.find((candidate) => candidate.kind === 'phrases') ??
        ({
          id: makeId('checklist'),
          title: 'Полезные фразы',
          kind: 'phrases',
        } satisfies Checklist)
      const hasChecklist = previous.checklists.some(
        (candidate) => candidate.id === checklist.id,
      )

      return {
        ...previous,
        checklists: hasChecklist
          ? previous.checklists
          : [...previous.checklists, checklist],
        checklistItems: [
          ...previous.checklistItems,
          {
            id: makeId('check-item'),
            checklistId: checklist.id,
            text: formatPhraseText({ zh, pinyin, ru }),
            done: false,
            sortOrder: nextChecklistOrder(previous.checklistItems, checklist.id),
          },
        ],
      }
    })
    form.reset()
  }

  function updatePhrase(event: FormEvent<HTMLFormElement>, itemId: string) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const zh = getFormString(data, 'zh')
    const ru = getFormString(data, 'ru')
    const pinyin = getFormString(data, 'pinyin')
    if (!zh || !ru) return

    commit((previous) => ({
      ...previous,
      checklistItems: previous.checklistItems.map((item) =>
        item.id === itemId
          ? { ...item, text: formatPhraseText({ zh, pinyin, ru }) }
          : item,
      ),
    }))
    setEditingPhraseId(null)
  }

  return (
    <section className="view-stack" aria-labelledby="phrases-title">
      <SectionHeading
        eyebrow="Китайский"
        title="Быстрые фразы"
        aside={`${phraseLibrary.length + savedPhrases.length} фраз`}
      />

      <CreateDetails title="Добавить свою фразу" icon={<Languages size={18} />}>
        <form className="quick-form" onSubmit={addPhrase}>
          <label>
            <span>Китайский</span>
            <input name="zh" placeholder="你好" required />
          </label>
          <label>
            <span>Пиньинь</span>
            <input name="pinyin" placeholder="Nǐ hǎo" />
          </label>
          <label className="wide-field">
            <span>Перевод</span>
            <input name="ru" placeholder="Здравствуйте" required />
          </label>
          <button className="icon-button primary" type="submit" title="Добавить">
            <Plus size={20} />
          </button>
        </form>
      </CreateDetails>

      <div className="phrase-grid">
        {phraseLibrary.map((phrase) => (
          <article className="phrase-card" key={phrase.id}>
            <div className="title-row">
              <div>
                <p className="tag">Быстро</p>
                <h3>{phrase.zh}</h3>
              </div>
              <button
                className="icon-button quiet"
                type="button"
                title="Произнести"
                onClick={() => speakChinese(phrase.zh)}
              >
                <Volume2 size={18} />
              </button>
            </div>
            <p className="phrase-pinyin">{phrase.pinyin}</p>
            <p>{phrase.ru}</p>
          </article>
        ))}
      </div>

      {savedPhrases.length ? (
        <div className="list-stack">
          <SectionHeading eyebrow="Свои" title="Фразы поездки" />
          {savedPhrases.map((item) => {
            const phrase = parsePhraseText(item.text)
            return (
              <article className="phrase-card saved-phrase-card" key={item.id}>
                {editingPhraseId === item.id ? (
                  <form
                    className="edit-form"
                    onSubmit={(event) => updatePhrase(event, item.id)}
                  >
                    <label>
                      <span>Китайский</span>
                      <input name="zh" defaultValue={phrase.zh} required />
                    </label>
                    <label>
                      <span>Пиньинь</span>
                      <input name="pinyin" defaultValue={phrase.pinyin} />
                    </label>
                    <label className="wide-field">
                      <span>Перевод</span>
                      <input name="ru" defaultValue={phrase.ru} required />
                    </label>
                    <SaveCancelActions onCancel={() => setEditingPhraseId(null)} />
                  </form>
                ) : (
                  <>
                    <div className="title-row">
                      <div>
                        <p className="tag">Своя</p>
                        <h3>{phrase.zh}</h3>
                      </div>
                      <button
                        className="icon-button quiet"
                        type="button"
                        title="Произнести"
                        onClick={() => speakChinese(phrase.zh)}
                      >
                        <Volume2 size={18} />
                      </button>
                    </div>
                    <p className="phrase-pinyin">{phrase.pinyin}</p>
                    <p>{phrase.ru}</p>
                    <div className="card-actions">
                      <button
                        className="chip-button"
                        type="button"
                        onClick={() => setEditingPhraseId(item.id)}
                      >
                        <Pencil size={14} />
                        <span>Править</span>
                      </button>
                      <ConfirmDeleteButton
                        buttonClassName="chip-button"
                        title="Удалить фразу"
                        onConfirm={() =>
                          commit((previous) => ({
                            ...previous,
                            checklistItems: previous.checklistItems.filter(
                              (candidate) => candidate.id !== item.id,
                            ),
                          }))
                        }
                      >
                        <Trash2 size={14} />
                        <span>Удалить</span>
                      </ConfirmDeleteButton>
                    </div>
                  </>
                )}
              </article>
            )
          })}
        </div>
      ) : null}
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
            min="0.0001"
            step="0.0001"
            defaultValue={state.settings.cnyToRubRate}
          />
        </label>
        {!isRateFresh(state.settings.rateUpdatedAt) ? (
          <p className="form-warning">
            Курс старше 6 часов. Если интернет недоступен, приложение оставит
            последний сохранённый курс.
          </p>
        ) : null}
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
  onOpenDetails,
}: {
  item: DayItem
  state: TripState
  onRemove: () => void
  onSaveNote?: (note: string) => void
  onOpenDetails?: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const entity = getDayItemEntity(item, state)
  const canOpenDetails = Boolean(onOpenDetails)

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
      {canOpenDetails ? (
        <button
          className="day-item-open"
          type="button"
          onClick={onOpenDetails}
        >
          <div className="day-item-kind">{dayItemIcon(item.kind)}</div>
          <div>
            <strong>{entity.title}</strong>
            {entity.subtitle ? <p>{entity.subtitle}</p> : null}
          </div>
        </button>
      ) : (
        <div className="day-item-open passive">
          <div className="day-item-kind">{dayItemIcon(item.kind)}</div>
          <div>
            <strong>{entity.title}</strong>
            {entity.subtitle ? <p>{entity.subtitle}</p> : null}
          </div>
        </div>
      )}
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
        <ConfirmDeleteButton
          buttonClassName="icon-button tiny quiet"
          title="Убрать из дня"
          onConfirm={onRemove}
        >
          <Trash2 size={15} />
        </ConfirmDeleteButton>
      </div>
    </div>
  )
}

function RouteItemDetailModal({
  item,
  state,
  onClose,
}: {
  item: DayItem
  state: TripState
  onClose: () => void
}) {
  useBodyScrollLock(true)
  useEscapeKey(onClose)

  if (item.kind === 'place') {
    const place = state.places.find((candidate) => candidate.id === item.refId)
    if (!place) return null
    const sections = getPlaceSections(state)
    const day = state.days.find(
      (candidate) => candidate.id === (place.dayId ?? item.dayId),
    )

    return (
      <div
        className="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Карточка места"
      >
        <article className="detail-modal">
          <button
            className="modal-close"
            type="button"
            title="Закрыть"
            onClick={onClose}
          >
            <X size={22} />
          </button>
          <PlaceGallery photos={parsePlacePhotos(place.photoUrl)} />
          <div className="detail-modal-body">
            <p className="tag icon-tag">
              {placeIcon(place.category)}
              <span>{placeCategoryLabel(place.category, sections)}</span>
            </p>
            <h3>{place.name}</h3>
            <p className="muted-text">{place.city}</p>
            <div className="detail-info-list">
              <DetailInfoRow label="Дата" value={day ? formatShortDate(day.date) : ''} />
              <DetailInfoRow label="Город" value={place.city} />
              <DetailInfoRow
                label="Раздел"
                value={placeCategoryLabel(place.category, sections)}
              />
              <DetailInfoRow
                label="Статус"
                value={place.status === 'want' ? 'Хочу' : 'Были'}
              />
              <DetailInfoRow label="Карта/адрес" value={placeMapDisplayValue(place)} />
            </div>
            {place.note ? <p>{place.note}</p> : null}
            <div className="card-actions">
              <span className={`chip-button ${place.status === 'want' ? 'active' : ''}`}>
                {place.status === 'want' ? 'Хочу' : 'Были'}
              </span>
              <MapLinkButton place={place} />
            </div>
          </div>
        </article>
      </div>
    )
  }

  if (item.kind === 'hotel') {
    const hotel = state.hotels.find((candidate) => candidate.id === item.refId)
    if (!hotel) return null
    const day = state.days.find((candidate) => candidate.id === item.dayId)

    return (
      <div
        className="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Карточка отеля"
      >
        <article className="detail-modal">
          <button
            className="modal-close"
            type="button"
            title="Закрыть"
            onClick={onClose}
          >
            <X size={22} />
          </button>
          <div className="detail-modal-body">
            <p className="tag icon-tag">
              <Building2 size={18} />
              <span>Отель</span>
            </p>
            <h3>{hotel.name}</h3>
            <p className="muted-text">{hotel.city}</p>
            <div className="detail-facts">
              <span>{formatShortDate(hotel.checkIn)} → {formatShortDate(hotel.checkOut)}</span>
              <span>{formatRawMoney(hotel.price, hotel.currency)}</span>
            </div>
            <div className="detail-info-list">
              <DetailInfoRow label="Дата в маршруте" value={day ? formatShortDate(day.date) : ''} />
              <DetailInfoRow label="Город" value={hotel.city} />
              <DetailInfoRow label="Адрес" value={hotel.address} />
              <DetailInfoRow label="Заезд" value={formatShortDate(hotel.checkIn)} />
              <DetailInfoRow label="Выезд" value={formatShortDate(hotel.checkOut)} />
              <DetailInfoRow
                label="Стоимость"
                value={formatRawMoney(hotel.price, hotel.currency)}
              />
              <DetailInfoRow label="Бронь" value={hotel.url} />
              <DetailInfoRow label="Подтверждение" value={hotel.confirmationUrl} />
            </div>
            {hotel.address ? <p>{hotel.address}</p> : null}
            {hotel.note ? <p>{hotel.note}</p> : null}
            <div className="card-actions">
              <ExternalLinkButton href={hotel.url} label="Бронь" />
              <DocumentOpenButton value={hotel.confirmationUrl} label="Файл" />
            </div>
          </div>
        </article>
      </div>
    )
  }

  return null
}

function DetailInfoRow({ label, value }: { label: string; value: string }) {
  if (!value || value === '—') return null

  return (
    <div className="detail-info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function RouteMapPanel({ state }: { state: TripState }) {
  const sortedDays = [...state.days].sort((left, right) =>
    left.date.localeCompare(right.date),
  )

  return (
    <article className="route-map-panel">
      <div className="title-row">
        <div>
          <p className="eyebrow">Карта</p>
          <h3>Маршрут по дням</h3>
        </div>
        <Map size={20} />
      </div>
      <div className="route-rail" aria-label="Карта маршрута по дням">
        {sortedDays.map((day, index) => {
          const itemCount = state.dayItems.filter((item) => item.dayId === day.id).length
          const mapUrl = buildDayMapUrl(day, state)

          return (
            <a
              className="route-stop"
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
              key={day.id}
            >
              <span className="route-stop-index">{index + 1}</span>
              <strong>{day.city}</strong>
              <span>{formatShortDate(day.date)}</span>
              <small>{itemCount} в плане</small>
            </a>
          )
        })}
      </div>
    </article>
  )
}

function TimeZoneStrip({ now }: { now: Date }) {
  return (
    <section className="time-zone-strip" aria-label="Дата и время">
      <article className="time-card">
        <CalendarDays size={18} />
        <div>
          <span>Сегодня</span>
          <strong>{formatZonedDate(now, 'Europe/Moscow')}</strong>
        </div>
      </article>
      <article className="time-card">
        <Clock size={18} />
        <div>
          <span>Москва</span>
          <strong>{formatZonedTime(now, 'Europe/Moscow')}</strong>
        </div>
      </article>
      <article className="time-card">
        <Clock size={18} />
        <div>
          <span>Гуанчжоу</span>
          <strong>{formatZonedTime(now, 'Asia/Shanghai')}</strong>
        </div>
      </article>
    </section>
  )
}

function CompactDayItem({ item, state }: { item: DayItem; state: TripState }) {
  const entity = getDayItemEntity(item, state)

  return (
    <div className="compact-day-item">
      <div className="day-item-kind">{dayItemIcon(item.kind)}</div>
      <div>
        <strong>{entity.title}</strong>
        {entity.subtitle ? <p>{entity.subtitle}</p> : null}
      </div>
    </div>
  )
}

function PlaceSectionSelect({
  sections,
  defaultValue,
}: {
  sections: TripState['placeSections']
  defaultValue?: string
}) {
  return (
    <select name="category" defaultValue={defaultValue ?? sections[0]?.id ?? 'sight'}>
      {sections.map((section) => (
        <option key={section.id} value={section.id}>
          {section.title}
        </option>
      ))}
    </select>
  )
}

function CreateDetails({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <details className="create-panel">
      <summary>
        <span className="summary-icon">{icon}</span>
        <span>{title}</span>
        <Plus className="summary-plus" size={18} />
      </summary>
      {children}
    </details>
  )
}

function PlaceGallery({ photos }: { photos: string[] }) {
  const [activePhoto, setActivePhoto] = useState<string | null>(null)
  const visiblePhotos = photos.filter(Boolean)

  if (!visiblePhotos.length) {
    return (
      <div className="image-placeholder">
        <ImageIcon size={24} />
      </div>
    )
  }

  return (
    <div className="place-gallery" aria-label="Фотографии места">
      <div className="place-gallery-track">
        {visiblePhotos.map((photo, index) => (
          <div className="place-gallery-slide" key={`${photo}-${index}`}>
            <button
              className="place-gallery-open"
              type="button"
              aria-label={`Открыть фото ${index + 1}`}
              onClick={() => setActivePhoto(photo)}
            >
              <img src={photo} alt="" loading="lazy" />
            </button>
          </div>
        ))}
      </div>
      {visiblePhotos.length > 1 ? (
        <span className="photo-counter">{visiblePhotos.length} фото</span>
      ) : null}
      {activePhoto ? (
        <PhotoLightbox photo={activePhoto} onClose={() => setActivePhoto(null)} />
      ) : null}
    </div>
  )
}

function PhotoLightbox({
  photo,
  onClose,
}: {
  photo: string
  onClose: () => void
}) {
  useBodyScrollLock(true)
  useEscapeKey(onClose)

  return (
    <div className="media-lightbox" role="dialog" aria-modal="true">
      <button
        className="media-lightbox-close"
        type="button"
        title="Закрыть"
        onClick={onClose}
      >
        <X size={24} />
      </button>
      <img src={photo} alt="" />
    </div>
  )
}

function DocumentPreview({
  value,
  fallback,
}: {
  value: string
  fallback: ReactNode
}) {
  if (!value) return fallback

  let preview: ReactNode

  if (isEmbeddedImage(value)) {
    preview = <img src={value} alt="" />
  } else if (isPdfDocument(value)) {
    preview = (
      <iframe
        className="document-pdf-preview"
        src={value}
        title="Предпросмотр PDF"
      />
    )
  } else if (isEmbeddedFile(value)) {
    preview = (
      <div className="document-file-preview">
        <FileText size={30} />
        <span>{documentFileLabel(value)}</span>
      </div>
    )
  } else {
    preview = <QrCode size={34} />
  }

  return (
    <div className="document-preview-stack">
      {preview}
      <button
        className="document-preview-hitbox"
        type="button"
        aria-label={`Открыть ${documentOpenLabel(value).toLowerCase()}`}
        onClick={() => openDocumentValue(value)}
      />
    </div>
  )
}

function CurrencyCalculator({
  rate,
  rateUpdatedAt,
}: {
  rate: number
  rateUpdatedAt: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [amount, setAmount] = useState('100')
  const [direction, setDirection] = useState<'cny-rub' | 'rub-cny'>('cny-rub')
  useBodyScrollLock(isOpen)
  useEscapeKey(() => setIsOpen(false), isOpen)
  const numericAmount = Number(amount.replace(',', '.'))
  const isValidAmount = Number.isFinite(numericAmount) && numericAmount >= 0
  const result = isValidAmount
    ? direction === 'cny-rub'
      ? numericAmount * rate
      : rate > 0
        ? numericAmount / rate
        : 0
    : 0
  const resultCurrency = direction === 'cny-rub' ? 'RUB' : 'CNY'
  const sourceCurrency = direction === 'cny-rub' ? 'CNY' : 'RUB'

  return (
    <div className={`calculator-widget ${isOpen ? 'open' : ''}`}>
      {isOpen ? (
        <div
          className="calculator-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Конвертер валют"
        >
          <div className="title-row">
            <div>
              <p className="eyebrow">Конвертер</p>
              <h3>Юани / рубли</h3>
            </div>
            <button
              className="icon-button tiny quiet"
              type="button"
              title="Закрыть"
              onClick={() => setIsOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="segmented-row">
            <button
              className={direction === 'cny-rub' ? 'active' : ''}
              type="button"
              onClick={() => setDirection('cny-rub')}
            >
              CNY → RUB
            </button>
            <button
              className={direction === 'rub-cny' ? 'active' : ''}
              type="button"
              onClick={() => setDirection('rub-cny')}
            >
              RUB → CNY
            </button>
          </div>
          <label>
            <span>Сумма, {sourceCurrency}</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <div className="calculator-result">
            <span>Итого</span>
            <strong>
              {isValidAmount
                ? formatRawMoney(result, resultCurrency as Currency)
                : '—'}
            </strong>
          </div>
          <p className="muted-text">
            Курс: 1 CNY = {rate.toFixed(2)} RUB · {rateAgeText(rateUpdatedAt)}
          </p>
          {!isRateFresh(rateUpdatedAt) ? (
            <p className="form-warning">
              Нет свежего курса. Использую последний сохранённый.
            </p>
          ) : null}
        </div>
      ) : null}
      <button
        className="calculator-fab"
        type="button"
        title="Калькулятор валют"
        onClick={() => setIsOpen((value) => !value)}
      >
        <Calculator size={24} />
      </button>
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
      <ConfirmDeleteButton
        buttonClassName="icon-button quiet"
        title={deleteTitle}
        onConfirm={onDelete}
      >
        <Trash2 size={18} />
      </ConfirmDeleteButton>
    </div>
  )
}

function ConfirmDeleteButton({
  buttonClassName,
  title,
  disabled,
  children,
  onConfirm,
}: {
  buttonClassName: string
  title: string
  disabled?: boolean
  children: ReactNode
  onConfirm: () => void
}) {
  const [isConfirming, setIsConfirming] = useState(false)

  return (
    <>
      <button
        className={buttonClassName}
        type="button"
        title={title}
        disabled={disabled}
        onClick={() => setIsConfirming(true)}
      >
        {children}
      </button>
      {isConfirming ? (
        <ConfirmDialog
          title={title}
          description="Действие нельзя отменить после сохранения."
          confirmLabel="Удалить"
          onCancel={() => setIsConfirming(false)}
          onConfirm={() => {
            onConfirm()
            setIsConfirming(false)
          }}
        />
      ) : null}
    </>
  )
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
  useBodyScrollLock(true)
  useEscapeKey(onCancel)

  return (
    <div className="modal-backdrop confirm-backdrop" role="presentation">
      <article
        className="confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <div>
          <p className="eyebrow">Подтверждение</p>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <div className="confirm-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>
            Отмена
          </button>
          <button className="danger-button" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </article>
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
  const normalizedHref = normalizeExternalUrl(href)
  if (!normalizedHref) return null
  return (
    <a className="link-chip" href={normalizedHref} target="_blank" rel="noreferrer">
      <ExternalLink size={14} />
      <span>{label}</span>
    </a>
  )
}

function MapLinkButton({ place }: { place: Place }) {
  return <ExternalLinkButton href={placeMapUrl(place)} label="Карта" />
}

function DocumentOpenButton({
  value,
  label,
}: {
  value: string
  label: string
}) {
  if (!value) return null

  return (
    <button
      className="link-chip"
      type="button"
      onClick={() => openDocumentValue(value)}
    >
      <ExternalLink size={14} />
      <span>{label}</span>
    </button>
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

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(window.navigator.onLine)

    function handleOnline() {
      setIsOnline(true)
    }

    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return

    const previousOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [locked])
}

function useEscapeKey(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onEscape()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, onEscape])
}

function useMinuteClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(intervalId)
  }, [])

  return now
}

function getDayItemEntity(item: DayItem, state: TripState) {
  if (item.kind === 'place') {
    const place = state.places.find((candidate) => candidate.id === item.refId)
    return {
      title: place?.name ?? 'Место',
      subtitle: place
        ? `${place.city} · ${placeCategoryLabel(place.category, state.placeSections)}`
        : '',
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

function buildDayMapUrl(day: Day, state: TripState) {
  const linkedPlace = state.dayItems
    .filter((item) => item.dayId === day.id && item.kind === 'place')
    .map((item) => state.places.find((place) => place.id === item.refId))
    .find((place): place is Place => Boolean(place))
  const dayPlace =
    linkedPlace ?? state.places.find((candidate) => candidate.dayId === day.id)

  if (dayPlace) return placeMapUrl(dayPlace)

  return mapSearchUrl(`${day.city} China`)
}

function placeMapUrl(place: Place) {
  return normalizeExternalUrl(place.url) || mapSearchUrl(`${place.name} ${place.city} China`)
}

function placeMapDisplayValue(place: Place) {
  return normalizeExternalUrl(place.url) || place.url || `${place.name}, ${place.city}`
}

function mapSearchUrl(query: string) {
  return `https://maps.apple.com/?q=${encodeURIComponent(query)}`
}

function normalizeExternalUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const directUrl = trimmed.match(/^https?:\/\/\S+$/i)?.[0]
  const embeddedUrl = trimmed.match(/https?:\/\/\S+/i)?.[0]
  return (directUrl ?? embeddedUrl ?? '').replace(/[),.;]+$/g, '')
}

function documentTitle(text: string) {
  return text.split('—')[0]?.trim() || text
}

function documentMeta(text: string) {
  const value = documentValue(text)
  if (!value) return 'Добавь ссылку или пометку'
  if (isEmbeddedImage(value)) return 'Фото из галереи'
  if (isPdfDocument(value)) return 'PDF-файл'
  if (isEmbeddedFile(value)) return `Файл: ${documentFileLabel(value)}`
  return value
}

function documentValue(text: string) {
  return text.split('—').slice(1).join('—').trim()
}

function formatDocumentText(title: string, value: string) {
  return value ? `${title} — ${value}` : title
}

function isEmbeddedImage(value: string) {
  return value.startsWith('data:image/')
}

function isEmbeddedFile(value: string) {
  return value.startsWith('data:')
}

function isPdfDocument(value: string) {
  const lowerValue = value.toLowerCase()
  return (
    lowerValue.startsWith('data:application/pdf') ||
    lowerValue.endsWith('.pdf') ||
    lowerValue.includes('.pdf?')
  )
}

function documentFileLabel(value: string) {
  const mimeType = value.match(/^data:([^;,]+)/)?.[1]
  if (!mimeType) return 'Файл'
  if (mimeType === 'application/pdf') return 'PDF'
  return mimeType.split('/').pop()?.toUpperCase() ?? 'Файл'
}

function documentOpenLabel(value: string) {
  if (isEmbeddedImage(value)) return 'Фото'
  if (isPdfDocument(value)) return 'PDF'
  if (isEmbeddedFile(value)) return 'Файл'
  return 'Открыть'
}

function openDocumentValue(value: string) {
  if (!value) return

  const documentUrl = documentUrlFromValue(value)
  const targetWindow = window.open('', '_blank')
  if (!targetWindow) {
    if (documentUrl) window.location.href = documentUrl
    return
  }

  targetWindow.opener = null
  targetWindow.document.title = documentOpenLabel(value)

  if (!isEmbeddedFile(value)) {
    if (documentUrl) {
      targetWindow.location.href = documentUrl
      return
    }

    renderDocumentNote(targetWindow, value)
    return
  }

  targetWindow.document.body.style.margin = '0'
  targetWindow.document.body.style.background = '#0f172a'
  targetWindow.document.body.textContent = 'Открываем файл...'

  if (isEmbeddedImage(value)) {
    targetWindow.document.body.textContent = ''
    const image = targetWindow.document.createElement('img')
    image.src = value
    image.alt = ''
    image.style.width = '100%'
    image.style.height = '100vh'
    image.style.objectFit = 'contain'
    targetWindow.document.body.append(image)
    return
  }

  void fetch(value)
    .then((response) => response.blob())
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob)
      targetWindow.document.body.textContent = ''
      const frame = targetWindow.document.createElement('iframe')
      frame.src = objectUrl
      frame.title = documentOpenLabel(value)
      frame.style.width = '100%'
      frame.style.height = '100vh'
      frame.style.border = '0'
      targetWindow.document.body.append(frame)
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 300_000)
    })
    .catch(() => {
      targetWindow.location.href = value
    })
}

function isDocumentUrl(value: string) {
  return Boolean(documentUrlFromValue(value))
}

function documentUrlFromValue(value: string) {
  const trimmed = value.trim()
  if (/^(blob:|file:|\/)/i.test(trimmed)) return trimmed
  return normalizeExternalUrl(trimmed)
}

function renderDocumentNote(targetWindow: Window, value: string) {
  targetWindow.document.body.style.margin = '0'
  targetWindow.document.body.style.background = '#f7f7f5'
  targetWindow.document.body.style.color = '#18181b'
  targetWindow.document.body.style.font =
    '16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  targetWindow.document.body.innerHTML = ''

  const wrapper = targetWindow.document.createElement('main')
  wrapper.style.maxWidth = '720px'
  wrapper.style.margin = '0 auto'
  wrapper.style.padding = '32px 18px'

  const title = targetWindow.document.createElement('h1')
  title.textContent = 'Документ'
  title.style.margin = '0 0 14px'
  title.style.fontSize = '28px'

  const note = targetWindow.document.createElement('p')
  note.textContent = value
  note.style.margin = '0'
  note.style.whiteSpace = 'pre-wrap'
  note.style.lineHeight = '1.5'

  wrapper.append(title, note)
  targetWindow.document.body.append(wrapper)
}

function editableDocumentValue(value: string) {
  return isEmbeddedFile(value) ? '' : value
}

function documentInputPlaceholder(value: string) {
  return isEmbeddedFile(value) ? 'Файл уже загружен' : 'Ссылка на QR/скрин'
}

function formatPhraseText({
  zh,
  pinyin,
  ru,
}: {
  zh: string
  pinyin: string
  ru: string
}) {
  return pinyin ? `${zh} · ${pinyin} — ${ru}` : `${zh} — ${ru}`
}

function parsePhraseText(text: string) {
  const [left, ...rightParts] = text.split('—')
  const [zh, pinyin = ''] = left.split('·').map((part) => part.trim())

  return {
    zh: zh || text,
    pinyin,
    ru: rightParts.join('—').trim() || text,
  }
}

function speakChinese(text: string) {
  if (!('speechSynthesis' in window)) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
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

const maxDocumentFileSize = 4 * 1024 * 1024

async function getPlacePhotosValue(data: FormData, fallback: string) {
  const fallbackPhotos = parsePlacePhotos(fallback)
  const filePhotos = await getImageFileValues(data, 'photoFile')
  const linkedPhotos = parsePhotoLinks(getFormString(data, 'photoUrl'))
  const preservedUploadedPhotos =
    filePhotos.length === 0 ? fallbackPhotos.filter(isEmbeddedImage) : []
  const nextPhotos = [...preservedUploadedPhotos, ...filePhotos, ...linkedPhotos]

  return serializePlacePhotos(nextPhotos.length ? nextPhotos : fallbackPhotos)
}

async function getImageFileValues(data: FormData, name: string) {
  const files = data
    .getAll(name)
    .filter((file): file is File => file instanceof File && file.size > 0)

  return Promise.all(files.map((file) => resizeImageFile(file)))
}

async function getDocumentFileValue(data: FormData, fallback: string) {
  const file = data.get('documentFile')
  if (!(file instanceof File) || file.size === 0) return fallback

  if (file.type.startsWith('image/')) return resizeImageFile(file)

  if (file.size > maxDocumentFileSize) {
    throw new Error('Файл слишком большой. Лучше загрузить PDF до 4 МБ.')
  }

  return readFileAsDataUrl(file)
}

function resizeImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Не удалось прочитать фото'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('Не удалось подготовить фото'))
      image.onload = () => {
        const maxSize = 960
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('Не удалось сжать фото'))
          return
        }

        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.72))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

function parsePlacePhotos(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return []

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (photo): photo is string => typeof photo === 'string' && Boolean(photo.trim()),
        )
      }
    } catch {
      return [trimmed]
    }
  }

  return [trimmed]
}

function serializePlacePhotos(photos: string[]) {
  const uniquePhotos = Array.from(
    new Set(photos.map((photo) => photo.trim()).filter(Boolean)),
  )
  if (uniquePhotos.length <= 1) return uniquePhotos[0] ?? ''
  return JSON.stringify(uniquePhotos)
}

function parsePhotoLinks(value: string) {
  return value
    .split(/\n+/)
    .map((photo) => photo.trim())
    .filter(Boolean)
}

function editablePlacePhotoText(value: string) {
  return parsePlacePhotos(value)
    .filter((photo) => !isEmbeddedImage(photo))
    .join('\n')
}

function placePhotoInputPlaceholder(value: string) {
  const hasUploadedPhotos = parsePlacePhotos(value).some(isEmbeddedImage)
  return hasUploadedPhotos
    ? 'Фото уже загружены. Можно добавить ссылки по одной на строку'
    : 'https://... по одной ссылке на строку'
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Не удалось обработать файл'
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

function getPlaceSections(state: TripState) {
  const sections = [...state.placeSections]
  const knownIds = new Set(sections.map((section) => section.id))
  let nextOrder = nextPlaceSectionOrder(sections)

  for (const place of state.places) {
    if (!place.category || knownIds.has(place.category)) continue
    sections.push({
      id: place.category,
      title: place.category,
      sortOrder: nextOrder,
    })
    knownIds.add(place.category)
    nextOrder += 10
  }

  return sections.sort((left, right) => left.sortOrder - right.sortOrder)
}

function nextPlaceSectionOrder(sections: TripState['placeSections']) {
  return sections.length
    ? Math.max(...sections.map((section) => section.sortOrder)) + 10
    : 10
}

function makePlaceSectionId(
  title: string,
  sections: TripState['placeSections'],
) {
  const base =
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-zа-яё0-9]+/gi, '-')
      .replace(/^-|-$/g, '') || 'section'
  const knownIds = new Set(sections.map((section) => section.id))
  let id = base
  let index = 2

  while (knownIds.has(id)) {
    id = `${base}-${index}`
    index += 1
  }

  return id
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

function isMoreSectionId(value: string): value is MoreSectionId {
  return moreSections.some((section) => section.id === value)
}

function isPlaceSectionFilter(value: string): value is string {
  return Boolean(value)
}

function isTravelerId(value: string): value is TravelerId {
  return travelerIds.includes(value as TravelerId)
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function isRateFresh(value: string) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return false
  return Date.now() - timestamp < 6 * 60 * 60 * 1000
}

function rateAgeText(value: string) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return 'нет даты обновления'

  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000))
  if (minutes < 60) {
    return `${minutes || 1} ${pluralRu(minutes || 1, ['минуту', 'минуты', 'минут'])} назад`
  }

  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `${hours} ${pluralRu(hours, ['час', 'часа', 'часов'])} назад`
  }

  const days = Math.round(hours / 24)
  return `${days} ${pluralRu(days, ['день', 'дня', 'дней'])} назад`
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

function formatZonedDate(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  }).format(value)
}

function formatZonedTime(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(value)
}

function placeCategoryLabel(
  category: PlaceCategory,
  sections: TripState['placeSections'] = [],
) {
  const section = sections.find((candidate) => candidate.id === category)
  if (section) return section.title

  const labels: Record<string, string> = {
    sight: 'Достопримечательность',
    food: 'Еда',
    shopping: 'Шопинг',
  }
  return labels[category] ?? category
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
  const iconMap: Record<string, ReactNode> = {
    sight: <Landmark size={18} />,
    food: <Utensils size={18} />,
    shopping: <ShoppingBag size={18} />,
  }
  return iconMap[category] ?? <MapPin size={18} />
}

function pluralRu(count: number, forms: [string, string, string]) {
  const mod10 = Math.abs(count) % 10
  const mod100 = Math.abs(count) % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}
