import { useState } from 'react'
import { Languages, Plus, Volume2 } from 'lucide-react'

import { createChecklist, createChecklistItem, deleteChecklistItem } from '../../server/functions'
import type { Checklist } from '../../types/trip'
import { Button } from '../../components/ui/button'
import type { FeatureProps } from '../trip/types'
import {
  Badge,
  DeleteButton,
  EntityModal,
  Field,
  Input,
  PageHeader,
  SimpleCard,
  SubmitRow,
  formGridClass,
  getFormString,
} from '../trip/shared'

const phraseLibrary = [
  ['你好', 'Nǐ hǎo', 'Здравствуйте'],
  ['谢谢', 'Xiè xie', 'Спасибо'],
  ['这个多少钱？', 'Zhège duōshǎo qián?', 'Сколько это стоит?'],
  ['不要辣', 'Bù yào là', 'Не остро, пожалуйста'],
  ['三个人', 'Sān gè rén', 'Три человека'],
  ['洗手间在哪里？', 'Xǐshǒujiān zài nǎlǐ?', 'Где туалет?'],
  ['可以刷卡吗？', 'Kěyǐ shuākǎ ma?', 'Можно оплатить картой?'],
  ['请说慢一点', 'Qǐng shuō màn yīdiǎn', 'Говорите помедленнее'],
] as const

export function PhrasesView({ state, mutate }: Pick<FeatureProps, 'state' | 'mutate'>) {
  const [isAdding, setIsAdding] = useState(false)
  const phraseChecklist = state.checklists.find((checklist) => checklist.kind === 'phrases')
  const customPhrases = phraseChecklist
    ? state.checklistItems.filter((item) => item.checklistId === phraseChecklist.id)
    : []

  async function ensurePhraseChecklist(): Promise<Checklist | null> {
    if (phraseChecklist) return phraseChecklist
    const result = await mutate(
      'Раздел фраз создан',
      createChecklist({ data: { title: 'Фразы', kind: 'phrases' } }),
      (current, checklist) => ({
        ...current,
        checklists: [...current.checklists, checklist],
      }),
    )
    return result as Checklist | null
  }

  async function addPhrase(payload: { zh: string; pinyin: string; ru: string }) {
    const checklist = await ensurePhraseChecklist()
    if (!checklist) return

    await mutate(
      'Фраза добавлена',
      createChecklistItem({
        data: {
          checklistId: checklist.id,
          text: formatPhrase(payload),
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
        eyebrow="Китайский"
        title="Быстрые фразы"
        aside={<Badge>{phraseLibrary.length + customPhrases.length}</Badge>}
        action={
          <Button type="button" size="icon-lg" onClick={() => setIsAdding(true)}>
            <Plus />
          </Button>
        }
      />
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        {phraseLibrary.map(([zh, pinyin, ru]) => (
          <PhraseCard key={zh} zh={zh} pinyin={pinyin} ru={ru} />
        ))}
        {customPhrases.map((item) => {
          const phrase = parsePhrase(item.text)
          return (
            <PhraseCard
              key={item.id}
              zh={phrase.zh}
              pinyin={phrase.pinyin}
              ru={phrase.ru}
              onDelete={() =>
                void mutate(
                  'Фраза удалена',
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
          )
        })}
      </div>
      <EntityModal open={isAdding} title="Добавить фразу" onOpenChange={setIsAdding}>
        <PhraseForm
          onCancel={() => setIsAdding(false)}
          onSubmit={(payload) => void addPhrase(payload)}
        />
      </EntityModal>
    </section>
  )
}

function PhraseCard({
  zh,
  pinyin,
  ru,
  onDelete,
}: {
  zh: string
  pinyin: string
  ru: string
  onDelete?: () => void
}) {
  return (
    <SimpleCard
      title={zh}
      subtitle={
        <>
          <span className="block font-semibold text-teal-700 dark:text-teal-300">{pinyin}</span>
          <span>{ru}</span>
        </>
      }
      icon={<Languages className="size-5" />}
      actions={
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon" type="button" onClick={() => speak(zh)}>
            <Volume2 />
          </Button>
          {onDelete ? <DeleteButton title="Удалить фразу" onConfirm={onDelete} /> : null}
        </div>
      }
    />
  )
}

function PhraseForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (payload: { zh: string; pinyin: string; ru: string }) => void
  onCancel: () => void
}) {
  return (
    <form
      className={formGridClass()}
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        onSubmit({
          zh: getFormString(data, 'zh'),
          pinyin: getFormString(data, 'pinyin'),
          ru: getFormString(data, 'ru'),
        })
      }}
    >
      <Field label="Китайский">
        <Input name="zh" required />
      </Field>
      <Field label="Пиньинь">
        <Input name="pinyin" />
      </Field>
      <Field className="md:col-span-2" label="Перевод">
        <Input name="ru" required />
      </Field>
      <div className="md:col-span-2">
        <SubmitRow onCancel={onCancel} />
      </div>
    </form>
  )
}

function formatPhrase(value: { zh: string; pinyin: string; ru: string }) {
  return `${value.zh.trim()} | ${value.pinyin.trim()} | ${value.ru.trim()}`
}

function parsePhrase(text: string) {
  const [zh = '', pinyin = '', ru = ''] = text.split(' | ')
  return { zh, pinyin, ru }
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}
