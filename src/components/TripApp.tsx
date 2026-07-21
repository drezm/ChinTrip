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

import { CurrencyCalculator } from './shared/CurrencyCalculator'
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

  useVisualViewportKeyboard()

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
      if (isStaleServerFunctionError(error)) {
        setSaveStatus('error')
        toast.warning('Обновляю приложение после деплоя...')
        window.setTimeout(() => window.location.reload(), 700)
        return null
      }
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
    <div className="min-h-svh w-full min-w-0 max-w-full overflow-x-clip bg-background text-foreground">
      <Toaster richColors position="top-center" closeButton />
      <div className="mx-auto grid min-h-svh w-full min-w-0 max-w-6xl overflow-x-clip md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-svh border-r border-border bg-sidebar px-3 py-4 text-sidebar-foreground md:grid md:grid-rows-[auto_1fr_auto]">
          <TripIdentity />
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

        <div className="grid min-w-0 max-w-full grid-rows-[auto_1fr] overflow-x-clip">
          <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 pb-3 pt-[calc(12px+env(safe-area-inset-top))] backdrop-blur md:px-6">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <TripIdentity compact />
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadgeMini saveStatus={saveStatus} isOnline={isOnline} />
                <Button variant="outline" size="icon" type="button" onClick={handleThemeToggle}>
                  {state.settings.theme === 'dark' ? <Sun /> : <Moon />}
                </Button>
              </div>
            </div>
          </header>

          <main className="w-full min-w-0 max-w-full overflow-x-clip px-4 py-4 pb-[var(--mobile-bottom-content-padding)] md:px-6 md:pb-8">
            {activeView}
          </main>
        </div>
      </div>

      <nav className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 w-full max-w-full border-t border-border bg-background/95 px-3 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur transition duration-150 md:hidden">
        <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`grid h-12 place-items-center rounded-2xl transition ${
                activeTab === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-label={item.label}
              aria-current={activeTab === item.id ? 'page' : undefined}
            >
              <span className="[&_svg]:size-5" aria-hidden="true">
                {item.icon}
              </span>
              <span className="sr-only">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
      <CurrencyCalculator settings={state.settings} />
    </div>
  )
}

function TripIdentity({
  compact,
}: {
  compact?: boolean
}) {
  return (
    <div className="min-w-0">
      <h1
        className={`truncate font-semibold tracking-tight ${
          compact ? 'text-2xl' : 'text-3xl'
        }`}
      >
        China Trip
      </h1>
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

function isStaleServerFunctionError(error: unknown) {
  if (!(error instanceof Error)) return false
  return /server function info not found/i.test(error.message)
}

function useVisualViewportKeyboard() {
  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    const visualViewport = window.visualViewport
    let frame = 0
    let timer: number | undefined

    function isEditableElement(element: Element | null): element is HTMLElement {
      if (!(element instanceof HTMLElement)) return false
      return element.matches('input, textarea, select, [contenteditable="true"]')
    }

    function findScrollableParent(element: HTMLElement) {
      let parent = element.parentElement
      while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent)
        const canScrollY =
          /(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight
        if (canScrollY) return parent
        parent = parent.parentElement
      }
      return null
    }

    function scrollActiveFieldBy(activeElement: HTMLElement, delta: number) {
      const scrollParent = findScrollableParent(activeElement)
      if (scrollParent) {
        scrollParent.scrollTop += delta
        return
      }
      window.scrollBy({ top: delta, behavior: 'smooth' })
    }

    function ensureActiveFieldVisible(
      activeElement: HTMLElement,
      visibleHeight: number,
      viewportOffsetTop: number,
    ) {
      const rect = activeElement.getBoundingClientRect()
      const topPadding = viewportOffsetTop + 16
      const visibleBottom = viewportOffsetTop + visibleHeight
      const bottomPadding = 24
      if (rect.bottom > visibleBottom - bottomPadding) {
        scrollActiveFieldBy(activeElement, rect.bottom - visibleBottom + bottomPadding)
      } else if (rect.top < topPadding) {
        scrollActiveFieldBy(activeElement, rect.top - topPadding)
      }
    }

    function updateViewportState() {
      if (frame) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const viewportHeight = visualViewport?.height ?? window.innerHeight
        const viewportOffsetTop = visualViewport?.offsetTop ?? 0
        const keyboardInset = Math.max(
          0,
          window.innerHeight - viewportHeight - viewportOffsetTop,
        )
        const activeElement = document.activeElement
        const keyboardOpen = isEditableElement(activeElement) && keyboardInset > 80

        root.style.setProperty('--visual-viewport-height', `${Math.round(viewportHeight)}px`)
        root.style.setProperty(
          '--keyboard-inset',
          `${Math.round(keyboardOpen ? keyboardInset : 0)}px`,
        )
        body.classList.toggle('keyboard-open', keyboardOpen)

        if (keyboardOpen) ensureActiveFieldVisible(activeElement, viewportHeight, viewportOffsetTop)
      })
    }

    function scheduleViewportUpdate(delay = 80) {
      updateViewportState()
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(updateViewportState, delay)
    }

    const handleViewportChange = () => scheduleViewportUpdate()
    const handleFocusOut = () => scheduleViewportUpdate(180)

    updateViewportState()
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('orientationchange', handleViewportChange)
    window.addEventListener('focusin', handleViewportChange)
    window.addEventListener('focusout', handleFocusOut)
    visualViewport?.addEventListener('resize', handleViewportChange)
    visualViewport?.addEventListener('scroll', handleViewportChange)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      if (timer) window.clearTimeout(timer)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('orientationchange', handleViewportChange)
      window.removeEventListener('focusin', handleViewportChange)
      window.removeEventListener('focusout', handleFocusOut)
      visualViewport?.removeEventListener('resize', handleViewportChange)
      visualViewport?.removeEventListener('scroll', handleViewportChange)
      body.classList.remove('keyboard-open')
      root.style.removeProperty('--keyboard-inset')
      root.style.removeProperty('--visual-viewport-height')
    }
  }, [])
}
