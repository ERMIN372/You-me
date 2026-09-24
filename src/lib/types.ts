export type UserId = 'a' | 'b'
export const USERS: UserId[] = ['a', 'b']
export const other = (u: UserId): UserId => (u === 'a' ? 'b' : 'a')

/** Базовая запись. Слияние — «последняя правка побеждает» по updatedAt, удаление — надгробие (deleted). */
export interface Rec {
  id: string
  createdAt: number
  updatedAt: number
  by: UserId
  deleted?: boolean
}

export type Collection<T extends Rec = Rec> = Record<string, T>

export interface Profile {
  name: string
  color: string
  /** Для склонения: «добавил» / «добавила». */
  g?: 'm' | 'f'
}

export interface UsersConfig extends Rec {
  a: Profile
  b: Profile
}

export interface MetaConfig extends Rec {
  timezone: string
  qSeed: number
  qStart: string
}

export interface PushConfig extends Rec {
  publicKey: string
  privateKey: string
  subject: string
  installed?: boolean
}

export interface WorkerConfig extends Rec {
  url: string
  key: string
}

export type EventKind = 'event' | 'trip' | 'anniversary' | 'holiday'

export interface CalEvent extends Rec {
  title: string
  kind: EventKind
  start: string // YYYY-MM-DD
  end?: string // YYYY-MM-DD, включительно
  time?: string // HH:MM
  yearly?: boolean
  note?: string
}

export interface Person extends Rec {
  name: string
  day: number
  month: number // 1..12
  year?: number
  whose: UserId | 'both'
  note?: string
}

export interface Wish extends Rec {
  title: string
  owner: UserId
  price?: number
  currency: string
  url?: string
  photo?: string
  priority: 0 | 1 | 2
  note?: string
  gifted?: boolean
}

/** Тайная бронь подарка. id = id хотелки. Владелец хотелки её не видит. */
export interface Reservation extends Rec {
  wishId: string
}

export type PlanKind = 'trip' | 'repair' | 'purchase' | 'celebration' | 'other'

export interface Plan extends Rec {
  title: string
  kind: PlanKind
  budget: number
  currency: string
  note?: string
  archived?: boolean
}

export interface Expense extends Rec {
  planId: string
  amount: number
  paidBy: UserId
  kind: 'spend' | 'save'
  note?: string
  date: string
}

export type BarcodeFormat = 'EAN13' | 'EAN8' | 'UPC' | 'CODE128' | 'CODE39' | 'ITF' | 'QR'

export interface LoyaltyCard extends Rec {
  name: string
  number: string
  format: BarcodeFormat
  color: string
  note?: string
}

export interface ShopItem extends Rec {
  title: string
  done: boolean
  doneBy?: UserId
  doneAt?: number
}

/** id = `${date}:${user}` — у каждого своя запись, конфликтов нет. */
export interface Answer extends Rec {
  date: string
  user: UserId
  text: string
  /** Текст вопроса на момент ответа — архив не поедет, если банк вопросов изменится. */
  q?: string
  cat?: string
}

export interface Device extends Rec {
  user: UserId
  sub: PushSubscriptionJSON
  ua?: string
}

/** Записи конфига (users, meta, push, worker) — разные формы в одной коллекции. */
export type ConfigRec = Rec & { [k: string]: unknown }

export interface Schema {
  config: ConfigRec
  events: CalEvent
  people: Person
  wishes: Wish
  reservations: Reservation
  plans: Plan
  expenses: Expense
  cards: LoyaltyCard
  shopping: ShopItem
  answers: Answer
  devices: Device
}

export type CollName = keyof Schema
export const COLLECTIONS: CollName[] = [
  'config',
  'events',
  'people',
  'wishes',
  'reservations',
  'plans',
  'expenses',
  'cards',
  'shopping',
  'answers',
  'devices',
]

export interface NotifyPayload {
  to: UserId | 'both'
  title: string
  body: string
  tag?: string
  url?: string
  /** Склеивать body с предыдущим уведомлением с тем же tag (для покупок). */
  append?: boolean
}
