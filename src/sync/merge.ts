import type { Collection, Rec } from '../lib/types'

/** Сколько хранить надгробия удалённых записей. */
export const TOMBSTONE_TTL = 180 * 24 * 3600 * 1000

/** Кто из двух версий записи побеждает. Детерминированно на обоих устройствах. */
export function pick<T extends Rec>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b
  const ja = JSON.stringify(a)
  const jb = JSON.stringify(b)
  return ja >= jb ? a : b
}

export interface MergeResult<T extends Rec> {
  merged: Collection<T>
  /** В merged есть что-то, чего нет в remote → нужно запушить. */
  localAhead: boolean
  /** В merged есть что-то новое относительно local → обновить UI. */
  remoteAhead: boolean
}

export function mergeCollections<T extends Rec>(local: Collection<T>, remote: Collection<T>): MergeResult<T> {
  const merged: Collection<T> = {}
  let localAhead = false
  let remoteAhead = false
  const ids = new Set([...Object.keys(local), ...Object.keys(remote)])
  for (const id of ids) {
    const l = local[id]
    const r = remote[id]
    if (!r) {
      merged[id] = l
      localAhead = true
    } else if (!l) {
      merged[id] = r
      remoteAhead = true
    } else {
      const w = pick(l, r)
      merged[id] = w
      if (w !== r && JSON.stringify(w) !== JSON.stringify(r)) localAhead = true
      if (w !== l && JSON.stringify(w) !== JSON.stringify(l)) remoteAhead = true
    }
  }
  return { merged, localAhead, remoteAhead }
}

/** Выкидывает старые надгробия перед записью в репо. */
export function compact<T extends Rec>(c: Collection<T>, now = Date.now()): Collection<T> {
  const out: Collection<T> = {}
  for (const [id, r] of Object.entries(c)) {
    if (r.deleted && now - r.updatedAt > TOMBSTONE_TTL) continue
    out[id] = r
  }
  return out
}

/** Стабильная сериализация: записи по id, по строке на запись — читаемые диффы в репо. */
export function serialize(c: Collection): string {
  const ids = Object.keys(c).sort()
  const lines = ids.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(c[id])}`)
  return `{"v": 1, "items": {\n${lines.join(',\n')}\n}}\n`
}

export function parse(text: string): Collection {
  const j = JSON.parse(text)
  if (j && typeof j === 'object' && j.items && typeof j.items === 'object') return j.items
  return {}
}
