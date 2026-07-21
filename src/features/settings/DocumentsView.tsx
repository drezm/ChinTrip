import { useState, type FormEvent } from 'react'
import { FileText, Plus } from 'lucide-react'

import {
  createChecklist,
  createChecklistItem,
  deleteChecklistItem,
  updateChecklistItem,
  updateHotel,
  updateTicket,
} from '../../server/functions'
import type { Checklist, ChecklistItem, Hotel, Ticket } from '../../types/trip'
import { Button } from '../../components/ui/button'
import type { FeatureProps } from '../trip/types'
import {
  Badge,
  Card,
  CardContent,
  DeleteButton,
  DocumentPreview,
  EntityModal,
  Field,
  Input,
  PageHeader,
  SubmitRow,
  formDataWithFileValue,
  formGridClass,
  formatDateTime,
  getFormString,
} from '../trip/shared'

export function DocumentsView({
  state,
  mutate,
}: Pick<FeatureProps, 'state' | 'mutate'>) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingDoc, setEditingDoc] = useState<
    | { type: 'hotel'; entity: Hotel }
    | { type: 'ticket'; entity: Ticket }
    | { type: 'item'; entity: ChecklistItem }
    | null
  >(null)
  const visaChecklist = state.checklists.find((checklist) => checklist.kind === 'visa')
  const docs = visaChecklist
    ? state.checklistItems.filter((item) => item.checklistId === visaChecklist.id)
    : []

  async function ensureVisaChecklist(): Promise<Checklist | null> {
    if (visaChecklist) return visaChecklist
    const result = await mutate(
      'Раздел документов создан',
      createChecklist({ data: { title: 'Документы', kind: 'visa' } }),
      (current, checklist) => ({
        ...current,
        checklists: [...current.checklists, checklist],
      }),
    )
    return result as Checklist | null
  }

  async function addDocument(payload: { title: string; value: string }) {
    const checklist = await ensureVisaChecklist()
    if (!checklist) return

    await mutate(
      'Документ добавлен',
      createChecklistItem({
        data: {
          checklistId: checklist.id,
          text: formatDocumentText(payload.title, payload.value),
        },
      }),
      (current, item) => ({
        ...current,
        checklistItems: [...current.checklistItems, item],
      }),
    )
    setIsAdding(false)
  }

  return (
    <section className="grid w-full min-w-0 max-w-full gap-4 overflow-x-clip">
      <PageHeader
        eyebrow="QR и файлы"
        title="Документы"
        aside={<Badge>{state.hotels.length + state.tickets.length + docs.length}</Badge>}
        action={
          <Button type="button" size="icon-lg" onClick={() => setIsAdding(true)}>
            <Plus />
          </Button>
        }
      />
      <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {state.hotels.map((hotel) => (
          <DocumentCard
            key={`hotel-${hotel.id}`}
            title={hotel.name}
            meta={`Отель · ${hotel.city}`}
            value={hotel.confirmationUrl || hotel.url}
            onEdit={() => setEditingDoc({ type: 'hotel', entity: hotel })}
          />
        ))}
        {state.tickets.map((ticket) => (
          <DocumentCard
            key={`ticket-${ticket.id}`}
            title={`${ticket.fromCity} - ${ticket.toCity}`}
            meta={`Билет · ${formatDateTime(ticket.departAt)}`}
            value={ticket.fileUrl || ticket.url}
            onEdit={() => setEditingDoc({ type: 'ticket', entity: ticket })}
          />
        ))}
        {docs.map((item) => (
          <DocumentCard
            key={item.id}
            title={documentTitle(item.text)}
            meta={documentMeta(item.text)}
            value={documentValue(item.text)}
            onEdit={() => setEditingDoc({ type: 'item', entity: item })}
            onDelete={() =>
              void mutate(
                'Документ удалён',
                deleteChecklistItem({ data: { id: item.id } }),
                (current) => ({
                  ...current,
                  checklistItems: current.checklistItems.filter(
                    (candidate) => candidate.id !== item.id,
                  ),
                }),
              )
            }
          />
        ))}
      </div>

      <EntityModal open={isAdding} title="Добавить документ" onOpenChange={setIsAdding}>
        <DocumentForm
          onCancel={() => setIsAdding(false)}
          onSubmit={(payload) => void addDocument(payload)}
        />
      </EntityModal>

      <EntityModal
        open={Boolean(editingDoc)}
        title="Документ"
        onOpenChange={(open) => !open && setEditingDoc(null)}
      >
        {editingDoc ? (
          <DocumentForm
            title={
              editingDoc.type === 'item'
                ? documentTitle(editingDoc.entity.text)
                : editingDoc.type === 'hotel'
                  ? editingDoc.entity.name
                  : `${editingDoc.entity.fromCity} - ${editingDoc.entity.toCity}`
            }
            value={
              editingDoc.type === 'item'
                ? documentValue(editingDoc.entity.text)
                : editingDoc.type === 'hotel'
                  ? editingDoc.entity.confirmationUrl
                  : editingDoc.entity.fileUrl
            }
            onCancel={() => setEditingDoc(null)}
            onSubmit={(payload) => {
              if (editingDoc.type === 'hotel') {
                void mutate(
                  'Документ сохранён',
                  updateHotel({
                    data: {
                      id: editingDoc.entity.id,
                      confirmationUrl: payload.value,
                    },
                  }),
                  (current, hotel) => ({
                    ...current,
                    hotels: current.hotels.map((candidate) =>
                      candidate.id === hotel.id ? hotel : candidate,
                    ),
                  }),
                ).then(() => setEditingDoc(null))
              } else if (editingDoc.type === 'ticket') {
                void mutate(
                  'Документ сохранён',
                  updateTicket({
                    data: {
                      id: editingDoc.entity.id,
                      fileUrl: payload.value,
                    },
                  }),
                  (current, ticket) => ({
                    ...current,
                    tickets: current.tickets.map((candidate) =>
                      candidate.id === ticket.id ? ticket : candidate,
                    ),
                  }),
                ).then(() => setEditingDoc(null))
              } else {
                void mutate(
                  'Документ сохранён',
                  updateChecklistItem({
                    data: {
                      id: editingDoc.entity.id,
                      text: formatDocumentText(payload.title, payload.value),
                    },
                  }),
                  (current, item) => ({
                    ...current,
                    checklistItems: current.checklistItems.map((candidate) =>
                      candidate.id === item.id ? item : candidate,
                    ),
                  }),
                ).then(() => setEditingDoc(null))
              }
            }}
          />
        ) : null}
      </EntityModal>
    </section>
  )
}

function DocumentCard({
  title,
  meta,
  value,
  onEdit,
  onDelete,
}: {
  title: string
  meta: string
  value: string
  onEdit: () => void
  onDelete?: () => void
}) {
  return (
    <Card className="overflow-hidden">
      <DocumentPreview value={value} />
      <CardContent className="grid gap-3 pt-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 break-words text-base font-semibold leading-5">
              {title}
            </h3>
            <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">
              {meta}
            </p>
          </div>
          <div className="flex shrink-0">
            <Button variant="ghost" size="icon" type="button" onClick={onEdit}>
              <FileText />
            </Button>
            {onDelete ? <DeleteButton title="Удалить документ" onConfirm={onDelete} /> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DocumentForm({
  title = '',
  value = '',
  onSubmit,
  onCancel,
}: {
  title?: string
  value?: string
  onSubmit: (payload: { title: string; value: string }) => void
  onCancel: () => void
}) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const nextValue = await formDataWithFileValue(form, 'file', 'value')
    onSubmit({
      title: getFormString(data, 'title'),
      value: nextValue || value,
    })
  }

  return (
    <form className={formGridClass()} onSubmit={handleSubmit}>
      <Field label="Название">
        <Input name="title" defaultValue={title} placeholder="Виза, страховка, QR" required />
      </Field>
      <Field label="Ссылка или пометка">
        <Input
          name="value"
          defaultValue={value.startsWith('data:') ? '' : value}
          placeholder="https://..."
        />
      </Field>
      <Field className="md:col-span-2" label="Файл из галереи / PDF">
        <Input name="file" type="file" accept="image/*,application/pdf" />
      </Field>
      <div className="md:col-span-2">
        <SubmitRow onCancel={onCancel} />
      </div>
    </form>
  )
}

function documentTitle(text: string) {
  return text.split(' | ')[0] || text
}

function documentValue(text: string) {
  return text.split(' | ')[1] || ''
}

function documentMeta(text: string) {
  const value = documentValue(text)
  if (!value) return 'Без файла'
  if (value.startsWith('data:application/pdf')) return 'PDF'
  if (value.startsWith('data:image/')) return 'Фото'
  return value
}

function formatDocumentText(title: string, value: string) {
  return `${title.trim()} | ${value.trim()}`
}
