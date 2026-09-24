import { addDays, dayNum, days, diffDays, onYear, parts, years } from './dates'
import type { CalEvent, Person, UserId } from './types'

export interface Occurrence {
  key: string
  date: string
  end: string
  title: string
  kind: CalEvent['kind'] | 'birthday'
  who: UserId | 'both'
  subtitle: string
  event?: CalEvent
  person?: Person
}

export const KIND_LABEL: Record<Occurrence['kind'], string> = {
  event: 'событие',
  trip: 'поездка',
  anniversary: 'годовщина',
  holiday: 'праздник',
  birthday: 'день рождения',
}

const overlaps = (s: string, e: string, from: string, to: string) => dayNum(s) <= dayNum(to) && dayNum(e) >= dayNum(from)

/** Все события и дни рождения, пересекающие [from, to]. */
export function occurrences(events: CalEvent[], people: Person[], from: string, to: string): Occurrence[] {
  const out: Occurrence[] = []
  const y0 = parts(from).y
  const y1 = parts(to).y
  for (const ev of events) {
    const end = ev.end && dayNum(ev.end) >= dayNum(ev.start) ? ev.end : ev.start
    const len = diffDays(ev.start, end)
    const repeat = ev.yearly || ev.kind === 'anniversary'
    if (!repeat) {
      if (overlaps(ev.start, end, from, to)) out.push(mk(ev, ev.start, end, 0))
      continue
    }
    const sp = parts(ev.start)
    for (let y = y0 - 1; y <= y1; y++) {
      if (y < sp.y) continue
      const s = onYear(sp.m, sp.d, y)
      const e = len ? addDays(s, len) : s
      if (overlaps(s, e, from, to)) out.push(mk(ev, s, e, y - sp.y))
    }
  }
  for (const p of people) {
    for (let y = y0; y <= y1; y++) {
      const s = onYear(p.month, p.day, y)
      if (!overlaps(s, s, from, to)) continue
      const age = p.year ? y - p.year : undefined
      out.push({
        key: `p:${p.id}:${y}`,
        date: s,
        end: s,
        title: p.name,
        kind: 'birthday',
        who: p.whose,
        subtitle: [age !== undefined && age > 0 ? years(age) : null, 'день рождения'].filter(Boolean).join(' · '),
        person: p,
      })
    }
  }
  return out.sort((a, b) => dayNum(a.date) - dayNum(b.date) || a.title.localeCompare(b.title))
}

function mk(ev: CalEvent, s: string, e: string, n: number): Occurrence {
  const len = diffDays(s, e) + 1
  const bits: string[] = []
  if (ev.kind === 'anniversary' && n > 0) bits.push(years(n))
  bits.push(KIND_LABEL[ev.kind])
  if (len > 1) bits.push(days(len))
  if (ev.time) bits.push(ev.time)
  return { key: `e:${ev.id}:${s}`, date: s, end: e, title: ev.title, kind: ev.kind, who: ev.by, subtitle: bits.join(' · '), event: ev }
}

export interface Bar {
  occ: Occurrence
  startCol: number
  endCol: number
  lane: number
  capStart: boolean
  capEnd: boolean
}

/** Полосы многодневных событий на неделю (7 дат). */
export function weekBars(week: string[], occs: Occurrence[]): Bar[] {
  const ws = dayNum(week[0])
  const we = dayNum(week[6])
  const multi = occs.filter((o) => o.date !== o.end && dayNum(o.date) <= we && dayNum(o.end) >= ws)
  multi.sort((a, b) => dayNum(a.date) - dayNum(b.date) || dayNum(b.end) - dayNum(a.end))
  const lanes: number[] = []
  const bars: Bar[] = []
  for (const o of multi) {
    const sc = Math.max(0, dayNum(o.date) - ws)
    const ec = Math.min(6, dayNum(o.end) - ws)
    let lane = lanes.findIndex((endCol) => endCol < sc)
    if (lane < 0) {
      lane = lanes.length
      lanes.push(ec)
    } else lanes[lane] = ec
    bars.push({ occ: o, startCol: sc, endCol: ec, lane, capStart: dayNum(o.date) >= ws, capEnd: dayNum(o.end) <= we })
  }
  return bars
}
