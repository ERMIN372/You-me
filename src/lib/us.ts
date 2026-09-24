// Чистая логика для экрана «Мы»: вместе N дней, годовщины, итоги года, статусы капсул.
import { diffDays, nextOccurrence, parts } from './dates'
import type { Answer, CalEvent, Capsule, CapsuleRead, Plan, Task, UserId, Wish } from './types'

export interface Together {
  days: number
  /** Дата ближайшей годовщины (сегодня — если сегодня). */
  next: string
  inDays: number
  /** Какая по счёту это будет годовщина. */
  n: number
  /** Полных лет вместе на сегодня. */
  years: number
}

export function together(start: string, today: string): Together | null {
  if (!start || diffDays(start, today) < 0) return null
  const { m, d, y } = parts(start)
  const next = nextOccurrence(m, d, today)
  const n = parts(next).y - y
  const inDays = diffDays(today, next)
  return { days: diffDays(start, today), next, inDays, n, years: inDays === 0 ? n : n - 1 }
}

export interface YearStats {
  gifted: Wish[]
  trips: CalEvent[]
  plansClosed: Plan[]
  photos: number
  answeredBoth: number
  tasksDone: number
  letters: number
  events: number
}

const yearOf = (ts?: number) => (ts ? new Date(ts).getFullYear() : NaN)

export function yearStats(
  y: number,
  d: { wishes: Wish[]; events: CalEvent[]; plans: Plan[]; tasks: Task[]; capsules: Capsule[]; answers: Answer[] },
): YearStats {
  const photos = new Set<string>()
  for (const w of d.wishes) if (w.photo?.startsWith(`img/${y}-`)) photos.add(w.photo)
  for (const c of d.capsules) if (c.photo?.startsWith(`img/${y}-`)) photos.add(c.photo)
  const byDate = new Map<string, Set<UserId>>()
  for (const a of d.answers) {
    if (!a.date.startsWith(`${y}-`)) continue
    const s = byDate.get(a.date) ?? new Set()
    s.add(a.user)
    byDate.set(a.date, s)
  }
  return {
    gifted: d.wishes.filter((w) => w.gifted && yearOf(w.giftedAt ?? w.updatedAt) === y),
    trips: d.events.filter((e) => e.kind === 'trip' && e.start.startsWith(`${y}-`)).sort((a, b) => a.start.localeCompare(b.start)),
    plansClosed: d.plans.filter((p) => p.archived && yearOf(p.archivedAt ?? p.updatedAt) === y),
    photos: photos.size,
    answeredBoth: [...byDate.values()].filter((s) => s.size >= 2).length,
    tasksDone: d.tasks.filter((t) => t.done && yearOf(t.doneAt) === y).length,
    letters: d.capsules.filter((c) => yearOf(c.createdAt) === y).length,
    events: d.events.filter((e) => e.start.startsWith(`${y}-`)).length,
  }
}

export type CapsuleState =
  /** Письмо мне (или нам), ещё закрыто — текст не показываем. */
  | 'locked'
  /** Моё письмо, ещё не открылось — можно править. */
  | 'mine'
  /** Открылось. */
  | 'open'

export function capsuleState(c: Capsule, me: UserId, today: string): CapsuleState {
  if (diffDays(today, c.openAt) <= 0) return 'open'
  return c.by === me ? 'mine' : 'locked'
}

/** Кто должен прочитать письмо (адресаты, кроме автора). */
export function readers(c: Capsule): UserId[] {
  return c.to === 'both' ? ['a', 'b'] : [c.to]
}

export function readState(c: Capsule, reads: CapsuleRead[]): { readBy: UserId[]; all: boolean } {
  const readBy = reads.filter((r) => r.capsuleId === c.id).map((r) => r.user)
  const need = readers(c)
  return { readBy, all: need.every((u) => readBy.includes(u)) }
}

/** Непрочитанное открывшееся письмо для меня. */
export function unreadForMe(capsules: Capsule[], reads: CapsuleRead[], me: UserId, today: string) {
  return capsules.filter((c) => c.by !== me && readers(c).includes(me) && capsuleState(c, me, today) === 'open' && !reads.some((r) => r.capsuleId === c.id && r.user === me))
}

/** Ближайшее закрытое письмо мне от партнёра. */
export function nextLockedForMe(capsules: Capsule[], me: UserId, today: string) {
  return capsules
    .filter((c) => c.by !== me && readers(c).includes(me) && capsuleState(c, me, today) === 'locked')
    .sort((a, b) => a.openAt.localeCompare(b.openAt))[0]
}
