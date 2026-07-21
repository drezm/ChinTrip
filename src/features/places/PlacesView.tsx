import { useState, type FormEvent, type ReactNode } from 'react'
import { Landmark, MapPin, Plus, ShoppingBag, Utensils } from 'lucide-react'

import {
  changePlaceStatus,
  createPlace,
  createPlaceSection,
  deletePlace,
  deletePlaceSection,
  updatePlace,
  updatePlaceSection,
} from '../../server/functions'
import type { Place } from '../../types/trip'
import type { FeatureProps } from '../trip/types'
import {
  Badge,
  Card,
  CardContent,
  DaySelect,
  DeleteButton,
  EntityActions,
  EntityModal,
  Field,
  Input,
  OpenLinkButton,
  PageHeader,
  PhotoGallery,
  SelectField,
  StatusBadge,
  SubmitRow,
  Textarea,
  formDataWithFileValue,
  formGridClass,
  getFormString,
  getPlaceSections,
  placeMapUrl,
  placeSectionLabel,
} from '../trip/shared'
import { Button } from '../../components/ui/button'

export function PlacesView({ state, mutate }: FeatureProps) {
  const [activeSection, setActiveSection] = useState('all')
  const [isCreating, setIsCreating] = useState(false)
  const [editingPlace, setEditingPlace] = useState<Place | null>(null)
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const sections = getPlaceSections(state)
  const visiblePlaces =
    activeSection === 'all'
      ? state.places
      : state.places.filter((place) => place.category === activeSection)

  return (
    <section className="grid gap-4">
      <PageHeader
        eyebrow="Места"
        title="Подборки"
        aside={<Badge>{visiblePlaces.length}/{state.places.length}</Badge>}
        action={
          <Button type="button" size="icon-lg" onClick={() => setIsCreating(true)}>
            <Plus />
          </Button>
        }
      />

      <Card>
        <CardContent className="grid gap-3 pt-4">
          <div className="flex snap-x gap-2 overflow-x-auto pb-1">
            <SectionChip
              active={activeSection === 'all'}
              title="Все"
              count={state.places.length}
              onClick={() => setActiveSection('all')}
            />
            {sections.map((section) => (
              <SectionChip
                key={section.id}
                active={activeSection === section.id}
                title={section.title}
                count={state.places.filter((place) => place.category === section.id).length}
                icon={sectionIcon(section.id)}
                onClick={() => setActiveSection(section.id)}
                onEdit={() => setEditingSection(section.id)}
                onDelete={() =>
                  void mutate(
                    'Раздел удалён',
                    deletePlaceSection({ data: { id: section.id } }),
                    (current, result) => ({
                      ...current,
                      placeSections: current.placeSections.filter(
                        (item) => item.id !== result.id,
                      ),
                      places: current.places.map((place) =>
                        place.category === result.id
                          ? { ...place, category: result.fallbackId }
                          : place,
                      ),
                    }),
                  )
                }
              />
            ))}
            <CreateSectionButton
              onCreate={(title) =>
                void mutate(
                  'Раздел добавлен',
                  createPlaceSection({ data: { title } }),
                  (current, section) => ({
                    ...current,
                    placeSections: [...current.placeSections, section],
                  }),
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visiblePlaces.map((place) => (
          <Card key={place.id} className="overflow-hidden">
            <PhotoGallery value={place.photoUrl} />
            <CardContent className="grid gap-3 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Badge className="mb-2">
                    {sectionIcon(place.category)}
                    {placeSectionLabel(place.category, sections)}
                  </Badge>
                  <h3 className="truncate text-lg font-semibold">{place.name}</h3>
                  <p className="text-sm text-muted-foreground">{place.city}</p>
                </div>
                <EntityActions
                  deleteTitle="Удалить место"
                  onEdit={() => setEditingPlace(place)}
                  onDelete={() =>
                    void mutate(
                      'Место удалено',
                      deletePlace({ data: { id: place.id } }),
                      (current) => ({
                        ...current,
                        places: current.places.filter(
                          (candidate) => candidate.id !== place.id,
                        ),
                        dayItems: current.dayItems.filter(
                          (item) => !(item.kind === 'place' && item.refId === place.id),
                        ),
                      }),
                    )
                  }
                />
              </div>
              {place.note ? <p className="text-sm leading-6">{place.note}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={place.status === 'want' ? 'default' : 'secondary'}
                  type="button"
                  onClick={() =>
                    void mutate(
                      place.status === 'want' ? 'Уже в плане' : 'Статус обновлён',
                      changePlaceStatus({ data: { id: place.id, status: 'want' } }),
                      (current, updated) => ({
                        ...current,
                        places: current.places.map((candidate) =>
                          candidate.id === updated.id ? updated : candidate,
                        ),
                      }),
                      (current) => ({
                        ...current,
                        places: current.places.map((candidate) =>
                          candidate.id === place.id
                            ? { ...candidate, status: 'want' }
                            : candidate,
                        ),
                      }),
                    )
                  }
                >
                  Хочу
                </Button>
                <Button
                  variant={place.status === 'done' ? 'default' : 'secondary'}
                  type="button"
                  onClick={() =>
                    void mutate(
                      'Статус обновлён',
                      changePlaceStatus({ data: { id: place.id, status: 'done' } }),
                      (current, updated) => ({
                        ...current,
                        places: current.places.map((candidate) =>
                          candidate.id === updated.id ? updated : candidate,
                        ),
                      }),
                      (current) => ({
                        ...current,
                        places: current.places.map((candidate) =>
                          candidate.id === place.id
                            ? { ...candidate, status: 'done' }
                            : candidate,
                        ),
                      }),
                    )
                  }
                >
                  Были
                </Button>
                <OpenLinkButton href={place.url || placeMapUrl(place)} label="Карта" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <EntityModal
        open={isCreating}
        title="Добавить место"
        description="Можно загрузить несколько фото из галереи или добавить ссылки."
        onOpenChange={setIsCreating}
      >
        <PlaceForm
          state={state}
          sections={sections}
          onCancel={() => setIsCreating(false)}
          onSubmit={(payload) =>
            void mutate(
              'Место добавлено',
              createPlace({ data: payload }),
              (current, place) => ({
                ...current,
                places: [place, ...current.places],
              }),
            ).then(() => setIsCreating(false))
          }
        />
      </EntityModal>

      <EntityModal
        open={Boolean(editingPlace)}
        title="Редактировать место"
        onOpenChange={(open) => !open && setEditingPlace(null)}
      >
        {editingPlace ? (
          <PlaceForm
            place={editingPlace}
            state={state}
            sections={sections}
            onCancel={() => setEditingPlace(null)}
            onSubmit={(payload) =>
              void mutate(
                'Место сохранено',
                updatePlace({ data: { id: editingPlace.id, ...payload } }),
                (current, place) => ({
                  ...current,
                  places: current.places.map((candidate) =>
                    candidate.id === place.id ? place : candidate,
                  ),
                }),
              ).then(() => setEditingPlace(null))
            }
          />
        ) : null}
      </EntityModal>

      <EntityModal
        open={Boolean(editingSection)}
        title="Переименовать раздел"
        onOpenChange={(open) => !open && setEditingSection(null)}
      >
        {editingSection ? (
          <SectionForm
            title={sections.find((section) => section.id === editingSection)?.title ?? ''}
            onCancel={() => setEditingSection(null)}
            onSubmit={(title) =>
              void mutate(
                'Раздел сохранён',
                updatePlaceSection({ data: { id: editingSection, title } }),
                (current, section) => ({
                  ...current,
                  placeSections: current.placeSections.map((candidate) =>
                    candidate.id === section.id ? section : candidate,
                  ),
                }),
              ).then(() => setEditingSection(null))
            }
          />
        ) : null}
      </EntityModal>
    </section>
  )
}

function PlaceForm({
  place,
  state,
  sections,
  onSubmit,
  onCancel,
}: {
  place?: Place
  state: FeatureProps['state']
  sections: ReturnType<typeof getPlaceSections>
  onSubmit: (payload: {
    name: string
    city: string
    category: string
    url: string
    note: string
    photoUrl: string
    status: 'want' | 'done'
    dayId?: string
  }) => void
  onCancel: () => void
}) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const photoUrl = await formDataWithFileValue(
      form,
      'photoFile',
      'photoUrl',
      place?.photoUrl,
    )
    onSubmit({
      name: getFormString(data, 'name'),
      city: getFormString(data, 'city'),
      category: getFormString(data, 'category'),
      url: getFormString(data, 'url'),
      note: getFormString(data, 'note'),
      photoUrl,
      status: (getFormString(data, 'status') || 'want') as 'want' | 'done',
      dayId: getFormString(data, 'dayId') || undefined,
    })
  }

  return (
    <form className={formGridClass()} onSubmit={handleSubmit}>
      <Field label="Название">
        <Input name="name" defaultValue={place?.name} placeholder="Чайный рынок" required />
      </Field>
      <Field label="Город">
        <Input name="city" defaultValue={place?.city} placeholder="Гуанчжоу" required />
      </Field>
      <Field label="Раздел">
        <SelectField name="category" defaultValue={place?.category ?? sections[0]?.id}>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.title}
            </option>
          ))}
        </SelectField>
      </Field>
      <Field label="Статус">
        <SelectField name="status" defaultValue={place?.status ?? 'want'}>
          <option value="want">Хочу</option>
          <option value="done">Были</option>
        </SelectField>
      </Field>
      <Field label="День">
        <DaySelect days={state.days} defaultValue={place?.dayId ?? ''} />
      </Field>
      <Field label="Карта">
        <Input name="url" defaultValue={place?.url} placeholder="https://maps..." />
      </Field>
      <Field className="md:col-span-2" label="Фото из галереи">
        <Input name="photoFile" type="file" accept="image/*" multiple />
      </Field>
      <Field className="md:col-span-2" label="Ссылки на фото">
        <Textarea
          name="photoUrl"
          defaultValue={place?.photoUrl}
          placeholder="https://... по одной ссылке на строку"
        />
      </Field>
      <Field className="md:col-span-2" label="Заметка">
        <Textarea name="note" defaultValue={place?.note} />
      </Field>
      <div className="md:col-span-2">
        <SubmitRow onCancel={onCancel} />
      </div>
    </form>
  )
}

function SectionChip({
  active,
  title,
  count,
  icon,
  onClick,
  onEdit,
  onDelete,
}: {
  active: boolean
  title: string
  count: number
  icon?: ReactNode
  onClick: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  return (
    <div
      className={`flex min-w-fit snap-start items-center gap-1 rounded-2xl border p-1 ${
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/60'
      }`}
    >
      <button
        className="flex h-9 items-center gap-2 rounded-xl px-2 text-sm font-medium"
        type="button"
        onClick={onClick}
      >
        {icon}
        {title}
        <span className="rounded-full bg-background/70 px-2 py-0.5 text-xs text-foreground">
          {count}
        </span>
      </button>
      {onEdit ? (
        <Button variant="ghost" size="icon-sm" type="button" onClick={onEdit}>
          <Plus className="rotate-45" />
        </Button>
      ) : null}
      {onDelete ? (
        <DeleteButton
          className={active ? 'text-primary-foreground hover:bg-white/10' : ''}
          title="Удалить раздел"
          onConfirm={onDelete}
        />
      ) : null}
    </div>
  )
}

function CreateSectionButton({ onCreate }: { onCreate: (title: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        className="min-w-12 snap-start"
        variant="outline"
        size="icon-lg"
        type="button"
        onClick={() => setOpen(true)}
      >
        <Plus />
      </Button>
      <EntityModal
        open={open}
        title="Новый раздел"
        onOpenChange={setOpen}
      >
        <SectionForm
          onCancel={() => setOpen(false)}
          onSubmit={(title) => {
            onCreate(title)
            setOpen(false)
          }}
        />
      </EntityModal>
    </>
  )
}

function SectionForm({
  title,
  onSubmit,
  onCancel,
}: {
  title?: string
  onSubmit: (title: string) => void
  onCancel: () => void
}) {
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        const value = getFormString(new FormData(event.currentTarget), 'title')
        if (!value) return
        onSubmit(value)
      }}
    >
      <Field label="Название">
        <Input name="title" defaultValue={title} placeholder="Еда, шопинг, дети" required />
      </Field>
      <SubmitRow onCancel={onCancel} />
    </form>
  )
}

function sectionIcon(sectionId: string) {
  if (sectionId.includes('food') || sectionId.includes('еда')) return <Utensils className="size-4" />
  if (sectionId.includes('shop') || sectionId.includes('шоп')) return <ShoppingBag className="size-4" />
  if (sectionId.includes('sight')) return <Landmark className="size-4" />
  return <MapPin className="size-4" />
}
