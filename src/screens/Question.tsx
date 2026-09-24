import { useState } from 'preact/hooks'
import { CATEGORIES } from '../data/questions'
import { addDays, dayNum, days, fmtDay } from '../lib/dates'
import { questionFor } from '../lib/qday'
import { other, type Answer, type UserId } from '../lib/types'
import { colorOf, me, meta, nameOf, store, todayStr, useList, verb } from '../state'
import { ILock } from '../ui/icons'
import { Duo, Glow, Sheet, toast } from '../ui/kit'

function qOf(date: string) {
  const m = meta()
  return questionFor(date, m?.qSeed ?? 1, m?.qStart ?? date)
}

function useDay(date: string) {
  const answers = useList('answers')
  const i = me()
  const p = other(i)
  const find = (u: UserId) => answers.find((a) => a.date === date && a.user === u)
  const mine = find(i)
  const theirs = find(p)
  const q = mine?.q ? { q: mine.q, cat: mine.cat ?? '' } : theirs?.q ? { q: theirs.q, cat: theirs.cat ?? '' } : qOf(date)
  return { mine, theirs, q, i, p }
}

function submit(date: string, text: string, q: { q: string; cat: string }, hadTheirs: boolean, isEdit: boolean) {
  const i = me()
  store().put('answers', { id: `${date}:${i}`, date, user: i, text: text.trim(), q: q.q, cat: q.cat })
  if (!isEdit) {
    store().notify({
      to: other(i),
      title: hadTheirs ? 'Ответы открыты 💬' : 'Вопрос дня',
      body: hadTheirs ? `${nameOf(i)} ${verb(i, 'ответил', 'ответила')} — смотри, что получилось` : `${nameOf(i)} ${verb(i, 'ответил', 'ответила')}. Твоя очередь — ответ откроется, когда ответишь.`,
      tag: `q:${date}`,
      url: '#question',
    })
  }
}

export function QuestionScreen({ openSettings }: { openSettings: () => void }) {
  const t = todayStr()
  const { mine, theirs, q, p } = useDay(t)
  const answers = useList('answers')
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const [openDay, setOpenDay] = useState<string | null>(null)

  const both = (d: string) => answers.filter((a) => a.date === d).length >= 2
  let streak = 0
  for (let d = both(t) ? t : addDays(t, -1); both(d); d = addDays(d, -1)) streak++

  const past = new Set<string>()
  for (let k = 1; k <= 7; k++) past.add(addDays(t, -k))
  for (const a of answers) if (dayNum(a.date) < dayNum(t)) past.add(a.date)
  const archive = [...past].sort((a, b) => dayNum(b) - dayNum(a))

  const send = () => {
    if (!text.trim()) return toast('Напиши хоть пару слов')
    submit(t, text, q, !!theirs, !!mine)
    setText('')
    setEditing(false)
  }

  return (
    <div class="screen">
      <Glow color="rgba(60, 50, 140, 0.35)" />
      <div class="head">
        <div>
          <div class="caps">Вопрос дня · {fmtDay(t)}</div>
          <h1>Вопрос</h1>
        </div>
        <div class="actions">
          <Duo size={34} onClick={openSettings} />
        </div>
      </div>

      <div class="q-card">
        <span class="pill">{CATEGORIES[q.cat] ?? 'вопрос'}</span>
        <div class="q">{q.q}</div>
      </div>

      <div class="stack" style={{ marginTop: 14 }}>
        {(!mine || editing) && (
          <>
            <textarea class="input" style={{ minHeight: 130, lineHeight: 1.45 }} value={text} onInput={(e) => setText(e.currentTarget.value)} placeholder="Твой ответ… Партнёр увидит его, только когда ответит сам." />
            <button class="btn" onClick={send}>
              {mine ? 'Сохранить' : 'Ответить'}
            </button>
            {editing && (
              <button class="btn ghost" onClick={() => setEditing(false)}>
                Отмена
              </button>
            )}
            {!mine && (
              <div class="muted" style={{ fontSize: 14, textAlign: 'center' }}>
                {theirs ? `🔒 ${nameOf(p)} уже ${verb(p, 'ответил', 'ответила')} — откроется после твоего ответа` : `${nameOf(p)} ещё не ${verb(p, 'ответил', 'ответила')}`}
              </div>
            )}
          </>
        )}
        {mine && !editing && <AnswerCard a={mine} onEdit={!theirs ? () => (setText(mine.text), setEditing(true)) : undefined} />}
        {mine && !editing && (theirs ? <AnswerCard a={theirs} /> : <Locked u={p} />)}
      </div>

      {streak > 0 && (
        <div class="card streak" style={{ marginTop: 14 }}>
          <span style={{ fontSize: 26 }}>🔥</span>
          <div>
            <b>{days(streak)} подряд</b>
            <div class="muted" style={{ fontSize: 14 }}>
              отвечаете оба
            </div>
          </div>
        </div>
      )}

      <div class="section-title">
        <span class="caps">Архив</span>
        <span class="caps">{answers.filter((a) => a.user === me()).length} ответов</span>
      </div>
      <div class="list">
        {archive.map((d) => (
          <ArchiveItem key={d} date={d} onClick={() => setOpenDay(d)} />
        ))}
      </div>
      {openDay && <DaySheet date={openDay} onClose={() => setOpenDay(null)} />}
    </div>
  )
}

function AnswerCard({ a, onEdit }: { a: Answer; onEdit?: () => void }) {
  return (
    <div class="answer" style={{ borderColor: colorOf(a.user) }}>
      <div class="row between">
        <div class="who" style={{ color: colorOf(a.user) }}>
          {nameOf(a.user)}
        </div>
        {onEdit && (
          <button class="caps tap" onClick={onEdit}>
            изменить
          </button>
        )}
      </div>
      {a.text}
    </div>
  )
}

function Locked({ u }: { u: UserId }) {
  return (
    <div class="locked">
      <ILock size={22} />
      <span>Ждём ответ {nameOf(u)}. Откроется, когда ответите оба.</span>
    </div>
  )
}

function ArchiveItem({ date, onClick }: { date: string; onClick: () => void }) {
  const { mine, theirs, q, p } = useDay(date)
  const status = mine && theirs ? '💬 оба ответили' : mine ? `ждём ${nameOf(p)}` : theirs ? `🔒 ${nameOf(p)} ${verb(p, 'ответил', 'ответила')}` : 'без ответов'
  return (
    <button class="arch-item tap" onClick={onClick}>
      <div class="row between">
        <span class="caps">{fmtDay(date)}</span>
        <span class="mono muted" style={{ fontSize: 12 }}>
          {status}
        </span>
      </div>
      <div class="q">{q.q}</div>
    </button>
  )
}

function DaySheet({ date, onClose }: { date: string; onClose: () => void }) {
  const { mine, theirs, q, p } = useDay(date)
  const [text, setText] = useState('')
  return (
    <Sheet title={fmtDay(date)} onClose={onClose}>
      <div class="q-card" style={{ marginTop: 6 }}>
        <span class="pill">{CATEGORIES[q.cat] ?? 'вопрос'}</span>
        <div class="q" style={{ fontSize: 21 }}>
          {q.q}
        </div>
      </div>
      <div class="stack" style={{ marginTop: 14 }}>
        {mine ? (
          <AnswerCard a={mine} />
        ) : (
          <>
            <textarea class="input" style={{ minHeight: 110 }} value={text} onInput={(e) => setText(e.currentTarget.value)} placeholder="Ответить задним числом…" />
            <button
              class="btn"
              onClick={() => {
                if (!text.trim()) return toast('Напиши ответ')
                submit(date, text, q, !!theirs, false)
                setText('')
              }}
            >
              Ответить
            </button>
          </>
        )}
        {mine && theirs && <AnswerCard a={theirs} />}
        {mine && !theirs && <Locked u={p} />}
        {!mine && theirs && (
          <div class="locked">
            <ILock size={22} />
            <span>
              {nameOf(p)} уже {verb(p, 'ответил', 'ответила')}. Ответь — и откроется.
            </span>
          </div>
        )}
      </div>
    </Sheet>
  )
}
