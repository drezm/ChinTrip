import { useState, type ReactNode } from 'react'
import {
  Bed,
  FileText,
  Languages,
  ListChecks,
  Settings,
  Ticket as TicketIcon,
} from 'lucide-react'

import type { FeatureProps } from '../trip/types'
import { PageHeader } from '../trip/shared'
import { DocumentsView } from './DocumentsView'
import { HotelsView, TicketsView } from './LodgingTicketsView'
import { NotesView } from './NotesView'
import { PhrasesView } from './PhrasesView'
import { SettingsView } from './SettingsView'

type MoreSection = 'documents' | 'phrases' | 'hotels' | 'tickets' | 'notes' | 'settings'

const moreSections: Array<{ id: MoreSection; label: string; icon: ReactNode }> = [
  { id: 'documents', label: 'Документы', icon: <FileText /> },
  { id: 'phrases', label: 'Фразы', icon: <Languages /> },
  { id: 'hotels', label: 'Отели', icon: <Bed /> },
  { id: 'tickets', label: 'Билеты', icon: <TicketIcon /> },
  { id: 'notes', label: 'Заметки', icon: <ListChecks /> },
  { id: 'settings', label: 'Настройки', icon: <Settings /> },
]

export function MoreView({
  state,
  currentTravelerId,
  onTravelerChange,
  onLock,
  mutate,
}: FeatureProps & {
  onTravelerChange: (travelerId: string) => void
  onLock: () => void
}) {
  const [section, setSection] = useState<MoreSection>('documents')

  return (
    <section className="grid gap-4">
      <PageHeader eyebrow="Ещё" title="Дополнительно" />
      <div className="flex snap-x gap-2 overflow-x-auto pb-1">
        {moreSections.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={section === item.id}
            className={`flex h-11 min-w-fit snap-start items-center gap-2 rounded-2xl px-3 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring ${
              section === item.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
            onClick={() => setSection(item.id)}
          >
            <span className="[&_svg]:size-4">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {section === 'documents' ? <DocumentsView state={state} mutate={mutate} /> : null}
      {section === 'phrases' ? <PhrasesView state={state} mutate={mutate} /> : null}
      {section === 'hotels' ? <HotelsView state={state} mutate={mutate} /> : null}
      {section === 'tickets' ? <TicketsView state={state} mutate={mutate} /> : null}
      {section === 'notes' ? <NotesView state={state} mutate={mutate} /> : null}
      {section === 'settings' ? (
        <SettingsView
          state={state}
          mutate={mutate}
          currentTravelerId={currentTravelerId}
          onTravelerChange={onTravelerChange}
          onLock={onLock}
        />
      ) : null}
    </section>
  )
}
