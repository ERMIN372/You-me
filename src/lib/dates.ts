// Даты храним строками YYYY-MM-DD, считаем в «номерах дней» (UTC) — без сюрпризов с часовыми поясами.

export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
export const WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']
export const WD_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

const pad = (n: number) => String(n).padStart(2, '0')

export function ymd(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`
}

export function parts(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

export function dayNum(s: string) {
  const { y, m, d } = parts(s)
  return Math.round(Date.UTC(y, m - 1, d) / 86400000)
}

export function fromDayNum(n: number) {
  const dt = new Date(n * 86400000)
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

export const addDays = (s: string, n: number) => fromDayNum(dayNum(s) + n)
export const diffDays = (a: string, b: string) => dayNum(b) - dayNum(a)

/** 0 = понедельник … 6 = воскресенье */
export function weekday(s: string) {
  return (((dayNum(s) + 3) % 7) + 7) % 7 // 1970-01-01 — четверг
}

export function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

/** Сегодня в заданном часовом поясе (или в поясе устройства). */
export function today(tz?: string): string {
  const now = new Date()
  if (tz) {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
    } catch {
      /* неизвестный пояс */
    }
  }
  return ymd(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/** Недели месяца (пн–вс), каждая — 7 дат, включая хвосты соседних месяцев. */
export function monthGrid(y: number, m: number): string[][] {
  const first = ymd(y, m, 1)
  const start = addDays(first, -weekday(first))
  const last = ymd(y, m, daysInMonth(y, m))
  const end = addDays(last, 6 - weekday(last))
  const weeks: string[][] = []
  for (let d = start; dayNum(d) <= dayNum(end); d = addDays(d, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)))
  }
  return weeks
}

/** Дата годовщины в конкретном году (29 февраля → 28 в невисокосный). */
export function onYear(month: number, day: number, y: number) {
  const d = month === 2 && day === 29 && !isLeap(y) ? 28 : Math.min(day, daysInMonth(y, month))
  return ymd(y, month, d)
}

/** Ближайшая дата (месяц/день) начиная с from включительно. */
export function nextOccurrence(month: number, day: number, from: string) {
  const { y } = parts(from)
  const t = onYear(month, day, y)
  return dayNum(t) >= dayNum(from) ? t : onYear(month, day, y + 1)
}

export function fmtDay(s: string, withYear = false) {
  const { y, m, d } = parts(s)
  return `${d} ${MONTHS_GEN[m - 1]}${withYear ? ` ${y}` : ''}`
}

export function fmtDayLong(s: string) {
  const w = WEEKDAYS[weekday(s)]
  return `${w[0].toUpperCase()}${w.slice(1)}, ${fmtDay(s)}`
}

export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}

export const years = (n: number) => `${n} ${plural(n, 'год', 'года', 'лет')}`
export const days = (n: number) => `${n} ${plural(n, 'день', 'дня', 'дней')}`

/** «сегодня», «завтра», «через 3 дня», «пн, 12 окт» */
export function relLabel(s: string, now: string) {
  const d = diffDays(now, s)
  if (d === 0) return 'сегодня'
  if (d === 1) return 'завтра'
  if (d === -1) return 'вчера'
  return WD_SHORT[weekday(s)]
}

const ORD_GEN = ['', 'первой', 'второй', 'третьей', 'четвёртой', 'пятой', 'шестой', 'седьмой', 'восьмой', 'девятой', 'десятой', 'одиннадцатой', 'двенадцатой', 'тринадцатой', 'четырнадцатой', 'пятнадцатой', 'шестнадцатой', 'семнадцатой', 'восемнадцатой', 'девятнадцатой', 'двадцатой', 'двадцать первой', 'двадцать второй', 'двадцать третьей', 'двадцать четвёртой', 'двадцать пятой']

/** «до четвёртой годовщины» */
export const ordinalGen = (n: number) => ORD_GEN[n] ?? `${n}-й`

/** «сегодня, вчера, 3 дня назад, 12 авг» по метке времени. */
export function dateOf(ts: number) {
  const dt = new Date(ts)
  return ymd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

export function agoDay(ts: number, now: string) {
  const d = dateOf(ts)
  const n = diffDays(d, now)
  if (n <= 0) return 'сегодня'
  if (n === 1) return 'вчера'
  if (n < 7) return `${days(n)} назад`
  return fmtDay(d)
}
