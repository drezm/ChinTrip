import { useRouter } from '@tanstack/react-router'
import {
  CalendarDays,
  CircleDollarSign,
  Loader2,
  Map,
  MapPin,
  Moon,
  Settings,
  Sun,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Toaster, toast } from 'sonner'

import { Button } from './ui/button'
import { Badge } from '../features/trip/shared'
import { TodayView } from '../features/dashboard/TodayView'
import { RouteView } from '../features/itinerary/RouteView'
import { PlacesView } from '../features/places/PlacesView'
import { MoneyView } from '../features/expenses/MoneyView'
import { MoreView } from '../features/settings/MoreView'
import type { SaveStatus } from '../features/trip/types'
import type { TravelerId, TripState } from '../types/trip'
import { lockTrip, updateTripSettings } from '../server/functions'
import { getTravelerName, sortedDays, todayDate } from '../features/trip/shared'

type MainTab = 'today' | 'route' | 'places' | 'money' | 'more'

interface TripAppProps {
  initialState: TripState
}

const navItems: Array<{ id: MainTab; label: string; icon: ReactNode }> = [
  { id: 'today', label: 'Сегодня', icon: <CalendarDays /> },
  { id: 'route', label: 'Маршрут', icon: <Map /> },
  { id: 'places', label: 'Места', icon: <MapPin /> },
  { id: 'money', label: 'Деньги', icon: <CircleDollarSign /> },
  { id: 'more', label: 'Ещё', icon: <Settings /> },
]

export function TripApp({ initialState }: TripAppProps) {
  const router = useRouter()
  const [state, setState] = useState(initialState)
  const [activeTab, setActiveTab] = usePersistedState<MainTab>(
    'china-trip.active-tab.v2',
    'today',
    isMainTab,
  )
  const [currentTravelerId, setCurrentTravelerId] = usePersistedState<TravelerId>(
    'china-trip.current-traveler',
    state.travelers[0]?.id ?? 'traveler-a',
    (value): value is TravelerId => state.travelers.some((traveler) => traveler.id === value),
  )
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [isOnline, setIsOnline] = useState(true)
  const currentTraveler =
    state.travelers.find((traveler) => traveler.id === currentTravelerId) ??
    state.travelers[0]
  const tripDays = sortedDays(state.days)
  const upcomingDay =
    tripDays.find((day) => day.date >= todayDate()) ?? tripDays[tripDays.length - 1]

  useEffect(() => {
    setIsOnline(window.navigator.onLine)
    const online = () => setIsOnline(true)
    const offline = () => {
      setIsOnline(false)
      toast.warning('Нет сети. Показываю последние сохранённые данные.')
    }
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [])

  useEffect(() => {
    applyTheme(state.settings.theme)
  }, [state.settings.theme])

  async function mutate(
    label: string,
    request: Promise<unknown>,
    apply: (state: TripState, result: any) => TripState,
    optimistic?: (state: TripState) => TripState,
  ) {
    const previous = state
    if (optimistic) setState(optimistic)
    setSaveStatus('saving')

    try {
      const result = await request
      setState((current) => apply(current, result))
      setSaveStatus('saved')
      toast.success(label)
      return result
    } catch (error) {
      if (optimistic) setState(previous)
      setSaveStatus('error')
      toast.error(parseErrorMessage(error))
      return null
    }
  }

  async function handleThemeToggle() {
    const nextTheme = state.settings.theme === 'dark' ? 'light' : 'dark'
    await mutate(
      'Тема обновлена',
      updateTripSettings({ data: { theme: nextTheme } }),
      (current, settings) => ({ ...current, settings }),
      (current) => ({ ...current, settings: { ...current.settings, theme: nextTheme } }),
    )
  }

  async function handleLock() {
    await lockTrip()
    await router.navigate({ to: '/unlock' })
  }

  const featureProps = {
    state,
    setState,
    currentTravelerId,
    mutate,
  }

  const activeView = useMemo(() => {
    if (activeTab === 'today') return <TodayView {...featureProps} />
    if (activeTab === 'route') return <RouteView {...featureProps} />
    if (activeTab === 'places') return <PlacesView {...featureProps} />
    if (activeTab === 'money') return <MoneyView {...featureProps} />
    return (
      <MoreView
        {...featureProps}
        currentTravelerId={currentTravelerId}
        onTravelerChange={setCurrentTravelerId}
        onLock={handleLock}
      />
    )
  }, [activeTab, state, currentTravelerId])

  return (
    <div className="min-h-svh bg-background text-foreground">
      <Toaster richColors position="top-center" closeButton />
      <div className="mx-auto grid min-h-svh w-full max-w-6xl md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-svh border-r border-border bg-sidebar px-3 py-4 text-sidebar-foreground md:grid md:grid-rows-[auto_1fr_auto]">
          <TripIdentity upcomingDay={upcomingDay?.city} />
          <nav className="mt-6 grid content-start gap-1" aria-label="Основные разделы">
            {navItems.map((item) => (
              <NavButton
                key={item.id}
                active={activeTab === item.id}
                label={item.label}
                icon={item.icon}
                onClick={() => setActiveTab(item.id)}
              />
            ))}
          </nav>
          <div className="grid gap-2">
            <StatusBar
              isOnline={isOnline}
              saveStatus={saveStatus}
              travelerName={currentTraveler?.name ?? ''}
            />
            <Button variant="outline" type="button" onClick={handleThemeToggle}>
              {state.settings.theme === 'dark' ? <Sun /> : <Moon />}
              Тема
            </Button>
          </div>
        </aside>

        <div className="grid min-w-0 grid-rows-[auto_1fr]">
          <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 pb-3 pt-[calc(12px+env(safe-area-inset-top))] backdrop-blur md:px-6">
            <div className="flex items-start justify-between gap-3">
              <TripIdentity compact upcomingDay={upcomingDay?.city} />
              <div className="flex items-center gap-2">
                <StatusBadgeMini saveStatus={saveStatus} isOnline={isOnline} />
                <Button variant="outline" size="icon" type="button" onClick={handleThemeToggle}>
                  {state.settings.theme === 'dark' ? <Sun /> : <Moon />}
                </Button>
              </div>
            </div>
          </header>

          <main className="min-w-0 px-4 py-4 pb-[calc(92px+env(safe-area-inset-bottom))] md:px-6 md:pb-8">
            {activeView}
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-3 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`grid h-14 place-items-center rounded-2xl text-[11px] font-medium transition ${
                activeTab === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={activeTab === item.id ? 'page' : undefined}
            >
              <span className="[&_svg]:size-5">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

function TripIdentity({
  compact,
  upcomingDay,
}: {
  compact?: boolean
  upcomingDay?: string
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap gap-1.5">
        <Badge className="border-destructive/20 bg-destructive/10 text-destructive">
          8-20 августа
        </Badge>
        <Badge>до 25 авг.</Badge>
      </div>
      <h1
        className={`mt-2 truncate font-semibold tracking-tight ${
          compact ? 'text-2xl' : 'text-3xl'
        }`}
      >
        China Trip
      </h1>
      <p className="mt-1 truncate text-sm font-medium text-muted-foreground">
        Матвей · Артур · Лера · {upcomingDay ?? 'Гуанчжоу'}
      </p>
    </div>
  )
}

function NavButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean
  label: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      className={`flex h-10 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition ${
        active
          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      }`}
      type="button"
      onClick={onClick}
    >
      <span className="[&_svg]:size-4">{icon}</span>
      {label}
    </button>
  )
}

function StatusBar({
  isOnline,
  saveStatus,
  travelerName,
}: {
  isOnline: boolean
  saveStatus: SaveStatus
  travelerName: string
}) {
  return (
    <div className="grid gap-2 rounded-3xl border border-sidebar-border bg-background p-3 text-xs">
      <div className="flex items-center gap-2 text-muted-foreground">
        <UserRound className="size-4" />
        {travelerName}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          {isOnline ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
          {isOnline ? 'Онлайн' : 'Офлайн'}
        </span>
        <span className="flex items-center gap-1.5">
          {saveStatus === 'saving' ? <Loader2 className="size-4 animate-spin" /> : null}
          {saveStatus === 'saved' ? 'Сохранено' : saveStatus === 'saving' ? 'Сохраняю' : 'Ошибка'}
        </span>
      </div>
    </div>
  )
}

function StatusBadgeMini({
  saveStatus,
  isOnline,
}: {
  saveStatus: SaveStatus
  isOnline: boolean
}) {
  return (
    <Badge className="hidden sm:inline-flex">
      {saveStatus === 'saving' ? <Loader2 className="size-3 animate-spin" /> : null}
      {isOnline ? 'онлайн' : 'офлайн'} ·{' '}
      {saveStatus === 'saved' ? 'сохранено' : saveStatus === 'saving' ? 'сохраняю' : 'ошибка'}
    </Badge>
  )
}

function usePersistedState<T extends string>(
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
    window.localStorage.setItem(key, value)
  }, [key, value])

  return [value, setValue] as const
}

function isMainTab(value: string): value is MainTab {
  return ['today', 'route', 'places', 'money', 'more'].includes(value)
}

function applyTheme(theme: TripState['settings']['theme']) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle(
    'dark',
    theme === 'dark' || (theme === 'system' && prefersDark),
  )
}

function parseErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return 'Не получилось сохранить'
  try {
    const parsed = JSON.parse(error.message) as { message?: string }
    return parsed.message ?? 'Не получилось сохранить'
  } catch {
    return error.message || 'Не получилось сохранить'
  }
}
