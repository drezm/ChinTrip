import { useState } from 'react'
import { Plus } from 'lucide-react'

import {
  createChecklist,
  createChecklistItem,
  deleteChecklist,
  deleteChecklistItem,
  toggleChecklistItem,
  updateChecklist,
} from '../../server/functions'
import type { Checklist } from '../../types/trip'
import { Button } from '../../components/ui/button'
import type { FeatureProps } from '../trip/types'
import {
  Badge,
  Card,
  CardContent,
  DeleteButton,
  EntityActions,
  EntityModal,
  Field,
  Input,
  PageHeader,
  SelectField,
  SubmitRow,
  TextInputForm,
  formGridClass,
  getFormString,
} from '../trip/shared'

export function NotesView({ state, mutate }: Pick<FeatureProps, 'state' | 'mutate'>) {
  const [creatingChecklist, setCreatingChecklist] = useState(false)

  return (
    <section className="grid w-full min-w-0 max-w-full gap-4 overflow-x-clip">
      <PageHeader
        eyebrow="Заметки"
        title="Чек-листы"
        aside={<Badge>{state.checklistItems.filter((item) => !item.done).length} открыто</Badge>}
        action={
          <Button type="button" size="icon-lg" onClick={() => setCreatingChecklist(true)}>
            <Plus />
          </Button>
        }
      />
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        {state.checklists.map((checklist) => (
          <ChecklistCard key={checklist.id} checklist={checklist} state={state} mutate={mutate} />
        ))}
      </div>
      <EntityModal open={creatingChecklist} title="Новый список" onOpenChange={setCreatingChecklist}>
        <ChecklistForm
          onCancel={() => setCreatingChecklist(false)}
          onSubmit={(payload) =>
            void mutate(
              'Список добавлен',
              createChecklist({ data: payload }),
              (current, checklist) => ({
                ...current,
                checklists: [...current.checklists, checklist],
              }),
            ).then(() => setCreatingChecklist(false))
          }
        />
      </EntityModal>
    </section>
  )
}

function ChecklistCard({
  checklist,
  state,
  mutate,
}: {
  checklist: Checklist
  state: FeatureProps['state']
  mutate: FeatureProps['mutate']
}) {
  const [editing, setEditing] = useState(false)
  const items = state.checklistItems
    .filter((item) => item.checklistId === checklist.id)
    .sort((left, right) => left.sortOrder - right.sortOrder)

  return (
    <Card>
      <CardContent className="grid gap-3 pt-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Badge>{checklist.kind}</Badge>
            <h3 className="mt-2 line-clamp-2 break-words text-lg font-semibold leading-6 [overflow-wrap:anywhere]">
              {checklist.title}
            </h3>
          </div>
          <EntityActions
            deleteTitle="Удалить список"
            onEdit={() => setEditing(true)}
            onDelete={() =>
              void mutate(
                'Список удалён',
                deleteChecklist({ data: { id: checklist.id } }),
                (current) => ({
                  ...current,
                  checklists: current.checklists.filter(
                    (candidate) => candidate.id !== checklist.id,
                  ),
                  checklistItems: current.checklistItems.filter(
                    (item) => item.checklistId !== checklist.id,
                  ),
                }),
              )
            }
          />
        </div>
        <div className="grid gap-2">
          {items.map((item) => (
            <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-muted/60 p-2" key={item.id}>
              <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <input
                  className="size-4 shrink-0 accent-primary"
                  type="checkbox"
                  checked={item.done}
                  onChange={(event) =>
                    void mutate(
                      'Пункт обновлён',
                      toggleChecklistItem({ data: { id: item.id, done: event.target.checked } }),
                      (current, updated) => ({
                        ...current,
                        checklistItems: current.checklistItems.map((candidate) =>
                          candidate.id === updated.id ? updated : candidate,
                        ),
                      }),
                    )
                  }
                />
                <span
                  className={`min-w-0 break-words [overflow-wrap:anywhere] ${
                    item.done ? 'line-through text-muted-foreground' : ''
                  }`}
                >
                  {item.text}
                </span>
              </label>
              <DeleteButton
                title="Удалить пункт"
                onConfirm={() =>
                  void mutate(
                    'Пункт удалён',
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
            </div>
          ))}
        </div>
        <TextInputForm
          placeholder="Новый пункт"
          buttonLabel="Добавить пункт"
          onSubmit={(text) =>
            void mutate(
              'Пункт добавлен',
              createChecklistItem({ data: { checklistId: checklist.id, text } }),
              (current, item) => ({
                ...current,
                checklistItems: [...current.checklistItems, item],
              }),
            )
          }
        />
      </CardContent>
      <EntityModal open={editing} title="Редактировать список" onOpenChange={setEditing}>
        <ChecklistForm
          checklist={checklist}
          onCancel={() => setEditing(false)}
          onSubmit={(payload) =>
            void mutate(
              'Список сохранён',
              updateChecklist({ data: { id: checklist.id, ...payload } }),
              (current, updated) => ({
                ...current,
                checklists: current.checklists.map((candidate) =>
                  candidate.id === updated.id ? updated : candidate,
                ),
              }),
            ).then(() => setEditing(false))
          }
        />
      </EntityModal>
    </Card>
  )
}

function ChecklistForm({
  checklist,
  onSubmit,
  onCancel,
}: {
  checklist?: Checklist
  onSubmit: (payload: { title: string; kind: Checklist['kind'] }) => void
  onCancel: () => void
}) {
  return (
    <form
      className={formGridClass()}
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        onSubmit({
          title: getFormString(data, 'title'),
          kind: getFormString(data, 'kind') as Checklist['kind'],
        })
      }}
    >
      <Field label="Название">
        <Input name="title" defaultValue={checklist?.title} required />
      </Field>
      <Field label="Тип">
        <SelectField name="kind" defaultValue={checklist?.kind ?? 'notes'}>
          <option value="notes">Заметки</option>
          <option value="packing">Что взять</option>
          <option value="visa">Документы</option>
          <option value="phrases">Фразы</option>
        </SelectField>
      </Field>
      <div className="md:col-span-2">
        <SubmitRow onCancel={onCancel} />
      </div>
    </form>
  )
}
