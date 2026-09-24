import { useState } from 'preact/hooks'
import { CATEGORIES } from '../data/questions'
import { occurrences } from '../lib/calendar'
import { addDays, days, diffDays, fmtDay, fmtDayLong, ordinalGen, parts, plural, today as todayIn } from '../lib/dates'
import { questionFor } from '../lib/qday'
import { other } from '../lib/types'
import { nextLockedForMe, together, unreadForMe, yearStats } from '../lib/us'
import { colorOf, genOf, me, meta, nameOf, store, todayStr, useList, users, verb } from '../state'
import { IChevL, IChevR, IMail, ITasks } from '../ui/icons'
import { Duo, Field, Glow, Sheet, toast } from '../ui/kit'
import { UpItem } from './Calendar'

export type Go = (tab: 'calendar' | 'wishes' | 'plans' | 'tasks' | 'shopping' | 'cards' | 'question' | 'capsules') => void

export function UsScreen({ go, openSettings }: { go: Go; openSettings: () => void }) {
  const u = users()
  const i = me()
  const p = other(i)
  const t = todayStr()
  const m = meta()
  const events = useList('events')
  const people = useList('people')
  const wishes = useList('wishes')
  const plans = useList('plans')
  const tasks = useList('tasks')
  const capsules = useList('capsules')
  const reads = useList('reads')
  const answers = useList('answers')
  const [togetherOpen, setTogetherOpen] = useState(false)
  const [yearOpen, setYearOpen] = useState(false)

  const tg = m?.together ? together(m.together, t) : null
  const y = parts(t).y
  const ys = yearStats(y, { wishes, events, plans, tasks, capsules, answers })

  const q = questionFor(t, m?.qSeed ?? 1, m?.qStart ?? t)
  const mineA = answers.find((a) => a.date === t && a.user === i)
  const theirA = answers.find((a) => a.date === t && a.user === p)
  const qStatus = mineA && theirA ? '💬 оба ответили — посмотреть' : mineA ? `🔒 ждём ответа ${genOf(p)}` : theirA ? `🔒 ${nameOf(p)} ${verb(p, 'ответил', 'ответила')} — твоя очередь` : 'ответь первым'

  const soon = occurrences(events, people, t, addDays(t, 60))
    .filter((o) => diffDays(t, o.end) >= 0)
    .slice(0, 3)
  const unread = unreadForMe(capsules, reads, i, t)[0]
  const locked = nextLockedForMe(capsules, i, t)
  const freeTasks = tasks.filter((x) => !x.done && !x.assignee)
  const myTasks = tasks.filter((x) => !x.done && x.assignee === i)

  return (
    <div class="screen">
      <Glow color="rgba(90, 40, 110, 0.4)" />
      <div class="head">
        <div>
          <div class="caps">
            {u.a.name} и {u.b.name}
          </div>
          <h1>Мы</h1>
        </div>
        <div class="actions">
          <Duo size={40} onClick={openSettings} />
        </div>
      </div>

      <button class="us-count tap" onClick={() => setTogetherOpen(true)}>
        {tg ? (
          <>
            <div>
              <b>{tg.days.toLocaleString('ru-RU').replace(/ /g, ' ')}</b>
              <span>{plural(tg.days, 'день', 'дня', 'дней')} вместе</span>
            </div>
            <i class="sep" />
            <div>
              <b style={{ color: colorOf(p) }}>{tg.inDays === 0 ? '🎉' : tg.inDays}</b>
              <span>{tg.inDays === 0 ? `сегодня ${tg.n}-я годовщина!` : `${plural(tg.inDays, 'день', 'дня', 'дней')} до ${ordinalGen(tg.n)} годовщины`}</span>
            </div>
          </>
        ) : (
          <>
            <div>
              <b>💞</b>
              <span>Когда вы вместе?</span>
            </div>
            <i class="sep" />
            <div>
              <b style={{ color: colorOf(p), fontSize: 20, marginTop: 10 }}>Указать</b>
              <span>посчитаем дни и годовщины</span>
            </div>
          </>
        )}
      </button>

      <div class="card" style={{ marginTop: 12 }}>
        <div class="row between">
          <span class="caps">Наш {y}-й</span>
          <button class="link tap" style={{ color: 'var(--a)', fontWeight: 650 }} onClick={() => setYearOpen(true)}>
            Смотреть ›
          </button>
        </div>
        <div class="ystats">
          <Stat n={ys.gifted.length} label={`${plural(ys.gifted.length, 'хотелка', 'хотелки', 'хотелок')} исполнено`} />
          <Stat n={ys.trips.length} label={`${plural(ys.trips.length, 'поездка', 'поездки', 'поездок')} вдвоём`} />
          <Stat n={ys.plansClosed.length} label={`${plural(ys.plansClosed.length, 'план', 'плана', 'планов')} закрыто`} />
          <Stat n={ys.photos} label={`${plural(ys.photos, 'фото', 'фото', 'фото')} добавлено`} />
        </div>
      </div>

      <button class="q-mini tap" style={{ marginTop: 12 }} onClick={() => go('question')}>
        <div class="row between">
          <span class="caps">Вопрос дня</span>
          <span class="pill">{CATEGORIES[q.cat] ?? 'вопрос'}</span>
        </div>
        <div class="q">{mineA?.q ?? theirA?.q ?? q.q}</div>
        <div class="st" style={theirA && !mineA ? { color: colorOf(p) } : undefined}>
          {qStatus}
        </div>
      </button>

      <div class="section-title">
        <span class="caps">Скоро</span>
        <button class="link tap" onClick={() => go('calendar')}>
          Календарь
        </button>
      </div>
      <div class="list">
        {unread && (
          <button class="row-link accent tap" style={{ borderLeftColor: colorOf(unread.by) }} onClick={() => go('capsules')}>
            <IMail size={26} style={{ color: colorOf(unread.by) }} />
            <div class="grow">
              <div class="t">Письмо открылось!</div>
              <div class="s">«{unread.title}» · от {genOf(unread.by)}</div>
            </div>
            <IChevR size={18} />
          </button>
        )}
        {!unread && locked && (
          <button class="row-link accent tap" style={{ borderLeftColor: colorOf(locked.by) }} onClick={() => go('capsules')}>
            <IMail size={26} style={{ color: colorOf(locked.by) }} />
            <div class="grow">
              <div class="t">Тебя ждёт письмо</div>
              <div class="s">
                {fmtDay(locked.openAt)} · от {genOf(locked.by)}
              </div>
            </div>
            <IChevR size={18} />
          </button>
        )}
        {soon.map((o) => (
          <UpItem key={o.key} o={o} today={t} onClick={() => go('calendar')} />
        ))}
        {soon.length === 0 && !unread && !locked && <div class="muted" style={{ padding: '6px 4px' }}>В ближайшие два месяца ничего не запланировано.</div>}
        {(freeTasks.length > 0 || myTasks.length > 0) && (
          <button class="row-link tap" onClick={() => go('tasks')}>
            <ITasks size={26} style={{ color: 'var(--muted)' }} />
            <div class="grow">
              <div class="t">Задачи</div>
              <div class="s">
                {[myTasks.length ? `твоих ${myTasks.length}` : '', freeTasks.length ? `${freeTasks.length} ${plural(freeTasks.length, 'свободная', 'свободные', 'свободных')}` : ''].filter(Boolean).join(' · ')}
              </div>
            </div>
            <IChevR size={18} />
          </button>
        )}
        <button class="row-link tap" onClick={() => go('capsules')}>
          <IMail size={26} style={{ color: 'var(--muted)' }} />
          <div class="grow">
            <div class="t">Капсулы времени</div>
            <div class="s">письма, которые откроются потом</div>
          </div>
          <IChevR size={18} />
        </button>
      </div>

      {togetherOpen && <TogetherSheet onClose={() => setTogetherOpen(false)} />}
      {yearOpen && <YearSheet onClose={() => setYearOpen(false)} />}
    </div>
  )
}

const Stat = ({ n, label }: { n: number; label: string }) => (
  <div>
    <b>{n}</b>
    <span>{label}</span>
  </div>
)

export function TogetherSheet({ onClose }: { onClose: () => void }) {
  const m = meta()
  const [date, setDate] = useState(m?.together ?? '')
  const t = todayStr()
  const tg = date ? together(date, t) : null
  const save = () => {
    if (!m) return onClose()
    if (date && diffDays(date, t) < 0) return toast('Дата не может быть в будущем')
    store().put('config', { ...m, together: date || undefined })
    onClose()
  }
  return (
    <Sheet title="Мы вместе с…" onClose={onClose}>
      <Field label="Дата начала отношений">
        <input type="date" value={date} max={t} onInput={(e) => setDate(e.currentTarget.value)} />
      </Field>
      {tg && (
        <p class="muted" style={{ lineHeight: 1.5 }}>
          Вместе {days(tg.days)}. {tg.inDays === 0 ? `Сегодня ${tg.n}-я годовщина 🎉` : `${ordinalGen(tg.n)[0].toUpperCase()}${ordinalGen(tg.n).slice(1)} годовщина — ${fmtDayLong(tg.next).toLowerCase()}, через ${days(tg.inDays)}.`}
        </p>
      )}
      <p class="muted" style={{ fontSize: 13 }}>
        В день годовщины и на круглые даты (каждые 100 дней) придёт уведомление, если они включены.
      </p>
      <div class="btns">
        <button class="btn" onClick={save}>
          Сохранить
        </button>
      </div>
    </Sheet>
  )
}

function YearSheet({ onClose }: { onClose: () => void }) {
  const t = todayStr()
  const [y, setY] = useState(parts(t).y)
  const d = {
    wishes: useList('wishes'),
    events: useList('events'),
    plans: useList('plans'),
    tasks: useList('tasks'),
    capsules: useList('capsules'),
    answers: useList('answers'),
  }
  const s = yearStats(y, d)
  const cell = (n: number, one: string, few: string, many: string, tail: string) => (
    <div>
      <b>{n}</b>
      <span>
        {plural(n, one, few, many)} {tail}
      </span>
    </div>
  )
  return (
    <Sheet
      title={`Наш ${y}-й`}
      onClose={onClose}
      right={
        <span class="row" style={{ gap: 4 }}>
          <button class="icon-btn sm" onClick={() => setY(y - 1)} aria-label="Прошлый год">
            <IChevL size={18} />
          </button>
          <button class="icon-btn sm" onClick={() => setY(y + 1)} disabled={y >= parts(todayIn()).y} aria-label="Следующий год">
            <IChevR size={18} />
          </button>
        </span>
      }
    >
      <div class="ystats big" style={{ marginTop: 10 }}>
        {cell(s.gifted.length, 'хотелка', 'хотелки', 'хотелок', 'исполнено')}
        {cell(s.trips.length, 'поездка', 'поездки', 'поездок', 'вдвоём')}
        {cell(s.plansClosed.length, 'план', 'плана', 'планов', 'закрыто')}
        {cell(s.photos, 'фото', 'фото', 'фото', 'добавлено')}
        {cell(s.answeredBoth, 'вопрос', 'вопроса', 'вопросов', 'отвечено вдвоём')}
        {cell(s.tasksDone, 'задача', 'задачи', 'задач', 'сделано')}
        {cell(s.letters, 'письмо', 'письма', 'писем', 'в будущее')}
        {cell(s.events, 'событие', 'события', 'событий', 'в календаре')}
      </div>
      {s.trips.length > 0 && (
        <>
          <div class="caps" style={{ margin: '22px 2px 8px' }}>
            Поездки
          </div>
          <div class="card" style={{ padding: '6px 16px' }}>
            {s.trips.map((e) => (
              <div key={e.id} class="exp" style={{ gridTemplateColumns: '1fr auto' }}>
                <span>✈️ {e.title}</span>
                <span class="mono muted" style={{ fontSize: 13 }}>
                  {fmtDay(e.start)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {s.gifted.length > 0 && (
        <>
          <div class="caps" style={{ margin: '22px 2px 8px' }}>
            Исполненные хотелки
          </div>
          <div class="card" style={{ padding: '6px 16px' }}>
            {s.gifted.map((w) => (
              <div key={w.id} class="exp" style={{ gridTemplateColumns: '10px 1fr' }}>
                <i class="dot" style={{ background: colorOf(w.owner) }} />
                <span>🎁 {w.title}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {s.plansClosed.length > 0 && (
        <>
          <div class="caps" style={{ margin: '22px 2px 8px' }}>
            Закрытые планы
          </div>
          <div class="card" style={{ padding: '6px 16px' }}>
            {s.plansClosed.map((p) => (
              <div key={p.id} class="exp" style={{ gridTemplateColumns: '1fr' }}>
                <span>✔︎ {p.title}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}
