import { useState } from 'preact/hooks'
import { agoDay, dayNum, diffDays, fmtDay } from '../lib/dates'
import { other, type Task, type UserId } from '../lib/types'
import { colorOf, me, nameOf, store, todayStr, useList, users, verb } from '../state'
import { ICheck } from '../ui/icons'
import { Empty, Field, Seg, Sheet, Toggle, toast } from '../ui/kit'

type Filter = 'all' | UserId | 'free'

export function TaskList({ creating, onCreated }: { creating: boolean; onCreated: () => void }) {
  const tasks = useList('tasks')
  const i = me()
  const p = other(i)
  const u = users()
  const t = todayStr()
  const [filter, setFilter] = useState<Filter>('all')
  const [edit, setEdit] = useState<Partial<Task> | null>(null)
  const [showDone, setShowDone] = useState(false)

  const open = tasks.filter((x) => !x.done)
  const count = (f: Filter) => open.filter((x) => match(x, f)).length
  const shown = open.filter((x) => match(x, filter)).sort(byDue)
  const working = shown.filter((x) => x.assignee)
  const free = shown.filter((x) => !x.assignee)
  const done = tasks
    .filter((x) => x.done && Date.now() - (x.doneAt ?? 0) < 45 * 86400000)
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))

  const chip = (f: Filter, label: string) => (
    <button class={`chip ${filter === f ? 'on' : ''}`} style={filter === f ? { background: f === 'all' || f === 'free' ? 'var(--text)' : colorOf(f), color: f === 'all' || f === 'free' ? 'var(--on-text)' : undefined } : undefined} onClick={() => setFilter(f)}>
      {label}
    </button>
  )

  return (
    <>
      <div class="chips" style={{ flexWrap: 'wrap' }}>
        {chip('all', `Все · ${count('all')}`)}
        {chip(i, `Мои · ${count(i)}`)}
        {chip(p, `${u[p].name} · ${count(p)}`)}
        {chip('free', `Свободные · ${count('free')}`)}
      </div>

      {shown.length === 0 && <Empty icon="✅">{filter === 'free' ? 'Свободных задач нет.' : 'Задач нет. Поставь свободную — её возьмёт тот, у кого есть время.'}</Empty>}

      {working.length > 0 && (
        <>
          <div class="section-title" style={{ marginTop: 8 }}>
            <span class="caps">В работе</span>
          </div>
          {working.map((x) => (
            <TaskRow key={x.id} x={x} today={t} onOpen={() => setEdit(x)} />
          ))}
        </>
      )}
      {free.length > 0 && (
        <>
          <div class="section-title">
            <span class="caps">Свободные</span>
          </div>
          {free.map((x) => (
            <TaskRow key={x.id} x={x} today={t} onOpen={() => setEdit(x)} />
          ))}
        </>
      )}
      {done.length > 0 && (
        <>
          <div class="section-title">
            <button class="caps tap" onClick={() => setShowDone(!showDone)}>
              Готово · {done.length} {showDone ? '▾' : '▸'}
            </button>
          </div>
          {showDone && done.map((x) => <TaskRow key={x.id} x={x} today={t} onOpen={() => setEdit(x)} />)}
        </>
      )}

      {(edit || creating) && (
        <TaskForm
          init={edit ?? {}}
          onClose={() => {
            setEdit(null)
            onCreated()
          }}
        />
      )}
    </>
  )
}

function match(x: Task, f: Filter) {
  if (f === 'all') return true
  if (f === 'free') return !x.assignee
  return x.assignee === f
}

function byDue(a: Task, b: Task) {
  if (a.due && b.due) return a.due.localeCompare(b.due)
  if (a.due) return -1
  if (b.due) return 1
  return b.createdAt - a.createdAt
}

function dueText(x: Task, today: string) {
  if (!x.due) return 'без срока'
  const d = diffDays(today, x.due)
  if (d < 0 && !x.done) return `просрочено · было до ${fmtDay(x.due)}`
  if (d === 0) return 'до сегодня'
  if (d === 1) return 'до завтра'
  return `до ${fmtDay(x.due)}`
}

export function take(x: Task) {
  const i = me()
  store().put('tasks', { ...x, assignee: i, takenAt: Date.now() })
  if (x.by !== i) store().notify({ to: x.by, title: `${nameOf(i)} ${verb(i, 'взял', 'взяла')} задачу`, body: x.title, tag: `task:${x.id}`, url: '#tasks' })
}

export function toggleDone(x: Task) {
  const i = me()
  if (x.done) {
    store().put('tasks', { ...x, done: false, doneAt: undefined, doneBy: undefined })
    return
  }
  store().put('tasks', { ...x, done: true, doneAt: Date.now(), doneBy: i, assignee: x.assignee ?? i })
  if (x.by !== i) store().notify({ to: x.by, title: `${nameOf(i)} ${verb(i, 'сделал', 'сделала')} ✅`, body: x.title, tag: `task:${x.id}`, url: '#tasks' })
}

function TaskRow({ x, today, onOpen }: { x: Task; today: string; onOpen: () => void }) {
  const i = me()
  const who = x.done ? x.doneBy : x.assignee
  const c = who ? colorOf(who) : 'var(--dim)'
  const overdue = !x.done && x.due && dayNum(x.due) < dayNum(today)
  let sub: string
  if (x.done) sub = `${x.doneBy === i ? `ты ${verb(i, 'сделал', 'сделала')}` : `${nameOf(x.doneBy ?? x.by)} ${verb(x.doneBy ?? x.by, 'сделал', 'сделала')}`} ${x.doneAt ? agoDay(x.doneAt, today) : ''}`
  else if (x.assignee) sub = `${x.assignee === i ? `ты ${verb(i, 'взял', 'взяла')}` : `${nameOf(x.assignee)} ${verb(x.assignee, 'взял', 'взяла')}`} ${x.takenAt ? agoDay(x.takenAt, today) : ''} · ${dueText(x, today)}`
  else sub = `${x.by === i ? `ты ${verb(i, 'поставил', 'поставила')}` : `${verb(x.by, 'поставил', 'поставила')} ${nameOf(x.by)}`} · ${dueText(x, today)}`
  return (
    <div class={`task ${x.done ? 'done' : ''}`} style={{ borderLeftColor: x.assignee || x.done ? c : 'transparent' }}>
      <button class="check tap" style={{ borderColor: c, background: x.done ? c : 'transparent', color: '#fff' }} onClick={() => toggleDone(x)} aria-label={x.done ? 'Вернуть' : 'Готово'}>
        {x.done && <ICheck size={16} />}
      </button>
      <button class="grow tap" style={{ textAlign: 'left', minWidth: 0 }} onClick={onOpen}>
        <div class="t">{x.title}</div>
        <div class="s" style={overdue ? { color: 'var(--orange)' } : undefined}>
          {sub}
        </div>
      </button>
      {!x.assignee && !x.done && (
        <button class="take tap" onClick={() => take(x)}>
          Беру
        </button>
      )}
    </div>
  )
}

function TaskForm({ init, onClose }: { init: Partial<Task>; onClose: () => void }) {
  const u = users()
  const i = me()
  const [title, setTitle] = useState(init.title ?? '')
  const [note, setNote] = useState(init.note ?? '')
  const [hasDue, setHasDue] = useState(!!init.due)
  const [due, setDue] = useState(init.due ?? todayStr())
  const [who, setWho] = useState<UserId | 'free'>(init.assignee ?? 'free')

  const save = () => {
    if (!title.trim()) return toast('Что нужно сделать?')
    const assignee = who === 'free' ? undefined : who
    const rec = store().put('tasks', {
      ...init,
      title: title.trim(),
      note: note.trim() || undefined,
      due: hasDue ? due : undefined,
      assignee,
      takenAt: assignee && assignee !== init.assignee ? Date.now() : init.takenAt,
      done: init.done ?? false,
    })
    if (!init.id) {
      const body = `${rec.title}${rec.due ? ` · до ${fmtDay(rec.due)}` : ''}`
      if (!assignee) store().notify({ to: other(i), title: `${nameOf(i)} ${verb(i, 'поставил', 'поставила')} свободную задачу`, body, tag: `task:${rec.id}`, url: '#tasks' })
      else if (assignee !== i) store().notify({ to: assignee, title: `${nameOf(i)} ${verb(i, 'попросил', 'попросила')}`, body, tag: `task:${rec.id}`, url: '#tasks' })
    }
    onClose()
  }
  const del = () => {
    if (!init.id || !confirm('Удалить задачу?')) return
    store().remove('tasks', init.id)
    onClose()
  }

  return (
    <Sheet title={init.id ? 'Задача' : 'Новая задача'} onClose={onClose}>
      <Field label="Что сделать">
        <input value={title} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="Записаться к стоматологу" autoFocus={!init.id} />
      </Field>
      <Field label="Кто делает" group>
        <Seg
          sm
          options={[
            ['free', 'Свободная'],
            [i, 'Я'],
            [other(i), u[other(i)].name],
          ]}
          value={who}
          onChange={setWho}
        />
      </Field>
      <Toggle label="Есть срок" value={hasDue} onChange={setHasDue} />
      {hasDue && (
        <Field label="До">
          <input type="date" value={due} onInput={(e) => setDue(e.currentTarget.value)} />
        </Field>
      )}
      <Field label="Заметка">
        <textarea value={note} onInput={(e) => setNote(e.currentTarget.value)} placeholder="Телефон, адрес, детали…" />
      </Field>
      <div class="btns">
        {init.id && (
          <button class="btn danger" onClick={del}>
            Удалить
          </button>
        )}
        <button class="btn" onClick={save}>
          Сохранить
        </button>
      </div>
      {init.id && !init.done && (
        <button class="btn ghost" style={{ marginTop: 10 }} onClick={() => (toggleDone(init as Task), onClose())}>
          ✅ Готово
        </button>
      )}
    </Sheet>
  )
}
