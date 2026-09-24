import { useMemo, useRef, useState } from 'preact/hooks'
import { KIND_LABEL, occurrences, weekBars, type Occurrence } from '../lib/calendar'
import { addDays, dayNum, diffDays, fmtDay, fmtDayLong, MONTHS, MONTHS_GEN, MONTHS_SHORT, monthGrid, nextOccurrence, parts, relLabel, WD_SHORT, years } from '../lib/dates'
import { other, type CalEvent, type EventKind, type Person, type UserId } from '../lib/types'
import { colorOf, me, nameOf, store, todayStr, useList, users, verb } from '../state'
import { IChevL, IChevR, IPlus, IUsers } from '../ui/icons'
import { Dot, Duo, Empty, Field, Glow, Seg, Sheet, Toggle, toast } from '../ui/kit'

const TRIP = '#1fb5a8'
const occColor = (o: Occurrence) => (o.kind === 'trip' ? TRIP : colorOf(o.who))

export function CalendarScreen({ openSettings }: { openSettings: () => void }) {
  const events = useList('events')
  const people = useList('people')
  const t = todayStr()
  const [ym, setYm] = useState(() => ({ y: parts(t).y, m: parts(t).m }))
  const [sel, setSel] = useState<string | null>(null)
  const [edit, setEdit] = useState<Partial<CalEvent> | null>(null)
  const [detail, setDetail] = useState<Occurrence | null>(null)
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [person, setPerson] = useState<Partial<Person> | null>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)

  const weeks = useMemo(() => monthGrid(ym.y, ym.m), [ym.y, ym.m])
  const occs = useMemo(() => occurrences(events, people, weeks[0][0], weeks[weeks.length - 1][6]), [events, people, weeks])
  const dotsByDay = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const o of occs) {
      if (o.date !== o.end) continue
      const arr = m.get(o.date) ?? []
      if (arr.length < 3) arr.push(occColor(o))
      m.set(o.date, arr)
    }
    return m
  }, [occs])

  const upcoming = useMemo(() => {
    if (sel) return occurrences(events, people, sel, sel)
    return occurrences(events, people, t, addDays(t, 120))
      .filter((o) => dayNum(o.end) >= dayNum(t))
      .slice(0, 14)
  }, [events, people, sel, t])

  const shift = (d: number) => {
    setSel(null)
    setYm(({ y, m }) => {
      const n = m + d
      return n < 1 ? { y: y - 1, m: 12 } : n > 12 ? { y: y + 1, m: 1 } : { y, m: n }
    })
  }
  const goToday = () => {
    setSel(null)
    setYm({ y: parts(t).y, m: parts(t).m })
  }

  const inMonth = (d: string) => parts(d).m === ym.m

  return (
    <div class="screen">
      <Glow color="rgba(34, 74, 140, 0.35)" />
      <div class="caps" style={{ marginTop: 10 }}>
        {fmtDayLong(t)}
      </div>
      <div class="cal-top">
        <h1 style={{ margin: '6px 0 8px', fontSize: 36, letterSpacing: '-0.02em' }} onClick={goToday}>
          {MONTHS[ym.m - 1]}
          {ym.y !== parts(t).y && <span class="muted"> {ym.y}</span>}
        </h1>
        <div class="cal-nav">
          <button onClick={() => shift(-1)} aria-label="Предыдущий месяц">
            <IChevL size={20} />
          </button>
          <button onClick={() => shift(1)} aria-label="Следующий месяц">
            <IChevR size={20} />
          </button>
          <span style={{ width: 8 }} />
          <Duo size={34} onClick={openSettings} />
        </div>
      </div>

      <div
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const s = touch.current
          touch.current = null
          if (!s) return
          const dx = e.changedTouches[0].clientX - s.x
          const dy = e.changedTouches[0].clientY - s.y
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shift(dx < 0 ? 1 : -1)
        }}
      >
        <div class="cal-wd">
          {WD_SHORT.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        {weeks.map((week) => {
          const bars = weekBars(week, occs)
          return (
            <div class="cal-week" key={week[0]}>
              {week.map((d) => (
                <button
                  key={d}
                  class={`cal-day ${inMonth(d) ? '' : 'out'} ${d === t ? 'today' : ''} ${d === sel ? 'sel' : ''}`}
                  onClick={() => (inMonth(d) ? setSel(sel === d ? null : d) : (setYm({ y: parts(d).y, m: parts(d).m }), setSel(d)))}
                >
                  <span class="num">{parts(d).d}</span>
                  <span class="dots">
                    {(dotsByDay.get(d) ?? []).map((c, i) => (
                      <i key={i} style={{ background: c }} />
                    ))}
                  </span>
                </button>
              ))}
              {bars.map((b) => (
                <i
                  key={b.occ.key}
                  class={`cal-bar ${b.capStart ? '' : 'cont-l'} ${b.capEnd ? '' : 'cont-r'}`}
                  style={{
                    background: occColor(b.occ),
                    left: `calc(${b.startCol} * 100% / 7 + ${b.capStart ? 6 : 0}px)`,
                    width: `calc(${b.endCol - b.startCol + 1} * 100% / 7 - ${(b.capStart ? 6 : 0) + (b.capEnd ? 6 : 0)}px)`,
                    bottom: `${2 + b.lane * 7}px`,
                    opacity: b.lane > 1 ? 0.6 : 1,
                  }}
                />
              ))}
            </div>
          )
        })}
      </div>

      <div class="section-title">
        <span class="caps">{sel ? fmtDay(sel) : 'Ближайшие'}</span>
        <span class="row" style={{ gap: 18 }}>
          <button class="link tap" onClick={() => setPeopleOpen(true)} style={{ color: 'var(--muted)', display: 'inline-flex', gap: 6, alignItems: 'center', fontWeight: 600 }}>
            <IUsers size={18} /> Люди
          </button>
          <button class="link tap" onClick={() => setEdit({ start: sel ?? t, kind: 'event' })}>
            Добавить
          </button>
        </span>
      </div>

      <div class="list">
        {upcoming.length === 0 && (
          <Empty icon="🗓️">
            {sel ? 'В этот день ничего нет.' : 'Пока пусто. Добавьте дни рождения, поездки и важные даты — будет видно, кто добавил.'}
          </Empty>
        )}
        {upcoming.map((o) => (
          <UpItem key={o.key} o={o} today={t} onClick={() => setDetail(o)} />
        ))}
      </div>

      {detail && (
        <OccDetail
          o={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            if (detail.event) setEdit(detail.event)
            if (detail.person) setPerson(detail.person)
            setDetail(null)
          }}
        />
      )}
      {edit && <EventForm init={edit} onClose={() => setEdit(null)} />}
      {peopleOpen && <PeopleSheet onClose={() => setPeopleOpen(false)} onEdit={(p) => setPerson(p)} />}
      {person && <PersonForm init={person} onClose={() => setPerson(null)} />}
    </div>
  )
}

function UpItem({ o, today, onClick }: { o: Occurrence; today: string; onClick: () => void }) {
  const ongoing = dayNum(o.date) < dayNum(today) && dayNum(o.end) >= dayNum(today)
  const d = ongoing ? today : o.date
  const label = ongoing ? 'идёт' : diffDays(today, d) > 6 ? MONTHS_SHORT[parts(d).m - 1] : relLabel(d, today)
  const who = o.kind === 'birthday' ? 'из списка людей' : o.who !== 'both' ? `${verb(o.who, 'добавил', 'добавила')} ${nameOf(o.who)}` : ''
  return (
    <button class="up-item tap" onClick={onClick}>
      <div class="date">
        <b>{parts(d).d}</b>
        <small>{label}</small>
      </div>
      <div class="bar" style={{ background: occColor(o) }} />
      <div style={{ minWidth: 0 }}>
        <div class="t">
          {o.kind === 'birthday' ? '🎂 ' : o.kind === 'trip' ? '✈️ ' : o.kind === 'anniversary' ? '💞 ' : ''}
          {o.title}
        </div>
        <div class="s">{[o.subtitle, who].filter(Boolean).join(' · ')}</div>
      </div>
    </button>
  )
}

function OccDetail({ o, onClose, onEdit }: { o: Occurrence; onClose: () => void; onEdit: () => void }) {
  const range = o.date === o.end ? fmtDayLong(o.date) : `${fmtDay(o.date)} — ${fmtDay(o.end)}`
  const note = o.event?.note ?? o.person?.note
  return (
    <Sheet title={o.title} onClose={onClose}>
      <div class="caps" style={{ marginTop: 4 }}>
        {KIND_LABEL[o.kind]}
      </div>
      <div class="card" style={{ marginTop: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{range}</div>
        <div class="muted mono" style={{ fontSize: 13, marginTop: 6 }}>
          {o.subtitle}
        </div>
        {note && <div style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{note}</div>}
        <div class="row" style={{ marginTop: 14, gap: 8 }}>
          <Dot u={o.who} />
          <span class="muted" style={{ fontSize: 14 }}>
            {o.person ? (o.person.whose === 'both' ? 'общий человек' : `со стороны: ${nameOf(o.person.whose)}`) : o.who !== 'both' ? `${verb(o.who, 'добавил', 'добавила')} ${nameOf(o.who)}` : ''}
          </span>
        </div>
      </div>
      <div class="btns">
        <button class="btn ghost" onClick={onEdit}>
          Изменить
        </button>
      </div>
    </Sheet>
  )
}

const KINDS: [EventKind, string][] = [
  ['event', 'Событие'],
  ['trip', 'Поездка'],
  ['anniversary', 'Годовщина'],
  ['holiday', 'Праздник'],
]

function EventForm({ init, onClose }: { init: Partial<CalEvent>; onClose: () => void }) {
  const [title, setTitle] = useState(init.title ?? '')
  const [kind, setKind] = useState<EventKind>(init.kind ?? 'event')
  const [start, setStart] = useState(init.start ?? todayStr())
  const [multi, setMulti] = useState(!!init.end && init.end !== init.start)
  const [end, setEnd] = useState(init.end ?? init.start ?? todayStr())
  const [time, setTime] = useState(init.time ?? '')
  const [yearly, setYearly] = useState(!!init.yearly)
  const [note, setNote] = useState(init.note ?? '')
  const isMulti = kind === 'trip' || multi

  const save = () => {
    if (!title.trim()) return toast('Как назовём?')
    const e = isMulti && dayNum(end) > dayNum(start) ? end : undefined
    const rec = store().put('events', {
      id: init.id,
      title: title.trim(),
      kind,
      start,
      end: e,
      time: !isMulti && time ? time : undefined,
      yearly: kind === 'anniversary' || (kind !== 'trip' && yearly) || undefined,
      note: note.trim() || undefined,
    })
    if (!init.id) {
      const who = me()
      store().notify({
        to: other(who),
        title: `${nameOf(who)} ${verb(who, 'добавил', 'добавила')} в календарь`,
        body: `${rec.title} — ${fmtDay(start)}${e ? ` – ${fmtDay(e)}` : ''}`,
        tag: `ev:${rec.id}`,
        url: '#calendar',
      })
    }
    onClose()
  }
  const del = () => {
    if (!init.id || !confirm('Удалить событие?')) return
    store().remove('events', init.id)
    onClose()
  }

  return (
    <Sheet title={init.id ? 'Событие' : 'Новое событие'} onClose={onClose}>
      <Field label="Название">
        <input value={title} onInput={(e) => setTitle(e.currentTarget.value)} placeholder={kind === 'trip' ? 'Япония' : 'Ужин у родителей'} autoFocus={!init.id} />
      </Field>
      <div style={{ marginTop: 14 }}>
        <Seg sm options={KINDS} value={kind} onChange={setKind} />
      </div>
      {kind !== 'trip' && <Toggle label="Несколько дней" value={multi} onChange={setMulti} />}
      <div class={isMulti ? 'two' : ''}>
        <Field label={isMulti ? 'С' : 'Дата'}>
          <input
            type="date"
            value={start}
            onInput={(e) => {
              const v = e.currentTarget.value
              setStart(v)
              if (dayNum(end) < dayNum(v)) setEnd(v)
            }}
          />
        </Field>
        {isMulti && (
          <Field label="По">
            <input type="date" value={end} min={start} onInput={(e) => setEnd(e.currentTarget.value)} />
          </Field>
        )}
      </div>
      {!isMulti && kind !== 'anniversary' && (
        <Field label="Время (необязательно)">
          <input type="time" value={time} onInput={(e) => setTime(e.currentTarget.value)} />
        </Field>
      )}
      {(kind === 'event' || kind === 'holiday') && <Toggle label="Повторять каждый год" value={yearly} onChange={setYearly} />}
      {kind === 'anniversary' && <div class="hint muted" style={{ fontSize: 13, margin: '8px 2px 0' }}>Годовщина повторяется каждый год и считает, сколько лет прошло.</div>}
      <Field label="Заметка">
        <textarea value={note} onInput={(e) => setNote(e.currentTarget.value)} placeholder="Адрес, билеты, что взять…" />
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
    </Sheet>
  )
}

function PeopleSheet({ onClose, onEdit }: { onClose: () => void; onEdit: (p: Partial<Person>) => void }) {
  const people = useList('people')
  const t = todayStr()
  const sorted = people
    .map((p) => ({ p, next: nextOccurrence(p.month, p.day, t) }))
    .sort((a, b) => dayNum(a.next) - dayNum(b.next))
  return (
    <Sheet
      title="Люди"
      onClose={onClose}
      right={
        <button class="icon-btn sm" onClick={() => onEdit({})} aria-label="Добавить человека">
          <IPlus size={20} />
        </button>
      }
    >
      <p class="muted" style={{ margin: '4px 2px 14px', fontSize: 14 }}>
        Дни рождения родных и друзей — сами появятся в календаре.
      </p>
      {sorted.length === 0 && <Empty icon="🎂">Добавьте первого человека — маму, лучшего друга, себя.</Empty>}
      <div class="list">
        {sorted.map(({ p, next }) => {
          const inDays = diffDays(t, next)
          const age = p.year ? parts(next).y - p.year : undefined
          return (
            <button key={p.id} class="up-item tap" onClick={() => onEdit(p)}>
              <div class="date">
                <b>{p.day}</b>
                <small>{MONTHS_SHORT[p.month - 1]}</small>
              </div>
              <div class="bar" style={{ background: colorOf(p.whose) }} />
              <div>
                <div class="t">{p.name}</div>
                <div class="s">
                  {[inDays === 0 ? 'сегодня!' : inDays === 1 ? 'завтра' : `через ${inDays} дн.`, age ? `исполнится ${years(age)}` : null].filter(Boolean).join(' · ')}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

function PersonForm({ init, onClose }: { init: Partial<Person>; onClose: () => void }) {
  const u = users()
  const [name, setName] = useState(init.name ?? '')
  const [day, setDay] = useState(init.day ?? 1)
  const [month, setMonth] = useState(init.month ?? 1)
  const [year, setYear] = useState(init.year ? String(init.year) : '')
  const [whose, setWhose] = useState<UserId | 'both'>(init.whose ?? 'both')
  const [note, setNote] = useState(init.note ?? '')

  const save = () => {
    if (!name.trim()) return toast('Как зовут?')
    const y = Number(year)
    store().put('people', {
      id: init.id,
      name: name.trim(),
      day,
      month,
      year: y > 1900 && y <= new Date().getFullYear() ? y : undefined,
      whose,
      note: note.trim() || undefined,
    })
    onClose()
  }
  const del = () => {
    if (!init.id || !confirm(`Удалить ${init.name}?`)) return
    store().remove('people', init.id)
    onClose()
  }
  return (
    <Sheet title={init.id ? init.name : 'Новый человек'} onClose={onClose}>
      <Field label="Имя">
        <input value={name} onInput={(e) => setName(e.currentTarget.value)} placeholder="Мама Софьи" autoFocus={!init.id} />
      </Field>
      <div class="two">
        <Field label="День">
          <select value={day} onChange={(e) => setDay(Number(e.currentTarget.value))}>
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Месяц">
          <select value={month} onChange={(e) => setMonth(Number(e.currentTarget.value))}>
            {MONTHS_GEN.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Год рождения" hint="Необязательно — тогда покажем, сколько исполняется">
        <input inputMode="numeric" value={year} onInput={(e) => setYear(e.currentTarget.value.replace(/\D/g, '').slice(0, 4))} placeholder="1958" />
      </Field>
      <Field label="Чей человек" group>
        <Seg
          sm
          options={[
            ['a', u.a.name],
            ['b', u.b.name],
            ['both', 'Общий'],
          ]}
          value={whose}
          onChange={setWhose}
        />
      </Field>
      <Field label="Заметка / идеи подарков">
        <textarea value={note} onInput={(e) => setNote(e.currentTarget.value)} placeholder="Любит пионы, размер M…" />
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
    </Sheet>
  )
}
