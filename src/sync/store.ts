import { blobToB64, hash } from '../lib/b64'
import { COLLECTIONS, type CollName, type Collection, type NotifyPayload, type Rec, type Schema, type UserId } from '../lib/types'
import { compact, mergeCollections, parse, serialize } from './merge'
import { AuthError, ConflictError, OfflineError, type Remote } from './remote'

export interface Persisted {
  colls: Partial<Record<CollName, Collection>>
  fileSha: Partial<Record<CollName, string>>
  /** Хэш последнего известного содержимого файла в репо — чтобы не пушить одно и то же. */
  remoteHash: Partial<Record<CollName, string>>
  headSha: string | null
  dirty: CollName[]
  notify: NotifyPayload[]
  imgs: string[]
  lastSync?: number
}

export interface Persistence {
  load(): Promise<Persisted | undefined>
  save(p: Persisted): Promise<void>
  getImg(path: string): Promise<Blob | undefined>
  setImg(path: string, blob: Blob): Promise<void>
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'auth'

const empty = (): Persisted => ({
  colls: {},
  fileSha: {},
  remoteHash: {},
  headSha: null,
  dirty: [],
  notify: [],
  imgs: [],
})

type Draft<T extends Rec> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'by'> & Partial<Pick<T, 'id' | 'createdAt' | 'by'>>

export const uid = () => {
  const b = crypto.getRandomValues(new Uint8Array(9))
  return Array.from(b, (x) => x.toString(36).padStart(2, '0')).join('').slice(0, 14)
}

export class Store {
  state: Persisted = empty()
  status: SyncStatus = 'idle'
  error = ''
  private listeners = new Set<() => void>()
  private rev: Partial<Record<CollName, number>> = {}
  private etag?: string
  private running: Promise<void> | null = null
  private again = false
  private saveTimer: ReturnType<typeof setTimeout> | undefined
  private syncTimer: ReturnType<typeof setTimeout> | undefined
  private poll: ReturnType<typeof setInterval> | undefined
  /** Можно ли слать уведомления (настроены ли пуши). Проверяется перед отправкой. */
  canNotify: (p: NotifyPayload) => boolean = () => false

  constructor(
    public remote: Remote,
    public me: UserId,
    private persist: Persistence,
    private opts: { syncDelay?: number; label?: () => string } = {},
  ) {}

  async init() {
    const s = await this.persist.load()
    if (s) this.state = { ...empty(), ...s }
    this.emit()
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    for (const fn of this.listeners) fn()
  }

  private scheduleSave() {
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => void this.persist.save(this.state), 250)
  }

  async flushSave() {
    clearTimeout(this.saveTimer)
    await this.persist.save(this.state)
  }

  // ---------- чтение ----------

  coll<K extends CollName>(name: K): Collection<Schema[K]> {
    return (this.state.colls[name] ?? {}) as Collection<Schema[K]>
  }

  get<K extends CollName>(name: K, id: string): Schema[K] | undefined {
    const r = this.coll(name)[id]
    return r && !r.deleted ? r : undefined
  }

  list<K extends CollName>(name: K): Schema[K][] {
    return Object.values(this.coll(name)).filter((r) => !r.deleted)
  }

  get hasData() {
    return Object.keys(this.state.colls).length > 0
  }

  get pending() {
    return this.state.dirty.length + this.state.imgs.length + this.state.notify.length
  }

  // ---------- запись ----------

  private touch(name: CollName) {
    if (!this.state.dirty.includes(name)) this.state.dirty.push(name)
    this.rev[name] = (this.rev[name] ?? 0) + 1
    this.scheduleSave()
    this.emit()
    this.scheduleSync()
  }

  put<K extends CollName>(name: K, draft: Draft<Schema[K]>): Schema[K] {
    const c = (this.state.colls[name] ??= {}) as Collection
    const id = draft.id ?? uid()
    const prev = c[id]
    const now = Date.now()
    const rec = {
      ...(prev && !prev.deleted ? prev : {}),
      ...draft,
      id,
      createdAt: prev?.createdAt ?? draft.createdAt ?? now,
      by: prev && !prev.deleted ? prev.by : (draft.by ?? this.me),
      updatedAt: Math.max(now, (prev?.updatedAt ?? 0) + 1),
    } as Rec
    delete rec.deleted
    // undefined-поля не храним
    for (const k of Object.keys(rec)) if ((rec as unknown as Record<string, unknown>)[k] === undefined) delete (rec as unknown as Record<string, unknown>)[k]
    c[id] = rec
    this.touch(name)
    return rec as Schema[K]
  }

  remove(name: CollName, id: string) {
    const c = this.state.colls[name]
    const prev = c?.[id]
    if (!c || !prev || prev.deleted) return
    c[id] = { id, by: prev.by, createdAt: prev.createdAt, updatedAt: Math.max(Date.now(), prev.updatedAt + 1), deleted: true }
    this.touch(name)
  }

  notify(p: NotifyPayload) {
    const q = this.state.notify
    const i = p.tag ? q.findIndex((x) => x.tag === p.tag && x.to === p.to) : -1
    if (i >= 0) {
      const old = q[i]
      q[i] = p.append ? { ...p, body: `${old.body}, ${p.body}` } : p
    } else q.push(p)
    this.scheduleSave()
    this.scheduleSync()
  }

  async addImage(path: string, blob: Blob) {
    await this.persist.setImg(path, blob)
    if (!this.state.imgs.includes(path)) this.state.imgs.push(path)
    this.scheduleSave()
    this.scheduleSync()
  }

  getImg(path: string) {
    return this.persist.getImg(path)
  }

  async fetchImg(path: string): Promise<Blob> {
    const local = await this.persist.getImg(path)
    if (local) return local
    const blob = await this.remote.getBinary(path)
    await this.persist.setImg(path, blob)
    return blob
  }

  // ---------- синхронизация ----------

  scheduleSync(delay = this.opts.syncDelay ?? 1200) {
    clearTimeout(this.syncTimer)
    this.syncTimer = setTimeout(() => void this.sync(), delay)
  }

  /** Запускает синхронизацию; если уже идёт — повторит сразу после. */
  sync(): Promise<void> {
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = (async () => {
      do {
        this.again = false
        await this.syncOnce()
      } while (this.again && this.status === 'idle')
    })().finally(() => {
      this.running = null
    })
    return this.running
  }

  private setStatus(s: SyncStatus, err = '') {
    this.status = s
    this.error = err
    this.emit()
  }

  private async syncOnce() {
    this.setStatus('syncing')
    try {
      await this.pull(false)
      await this.pushImages()
      await this.pushDirty()
      await this.pushNotify()
      this.state.lastSync = Date.now()
      this.scheduleSave()
      this.setStatus('idle')
    } catch (e) {
      if (e instanceof OfflineError) this.setStatus('offline')
      else if (e instanceof AuthError) this.setStatus('auth', e.message)
      else this.setStatus('error', e instanceof Error ? e.message : String(e))
    }
  }

  private async pull(force: boolean) {
    const h = await this.remote.head(force ? undefined : this.etag)
    if (h.same) return
    if (h.sha === null) {
      this.state.headSha = null
      this.etag = undefined
      // пустой репо: всё локальное — к отправке
      for (const name of Object.keys(this.state.colls) as CollName[]) {
        this.state.fileSha[name] = undefined
        if (!this.state.dirty.includes(name)) this.state.dirty.push(name)
      }
      return
    }
    if (h.sha === this.state.headSha && !force) {
      this.etag = h.etag
      return
    }
    const files = await this.remote.list(h.sha)
    const seen = new Set<string>()
    let changed = false
    for (const f of files) {
      const name = f.name.replace(/\.json$/, '') as CollName
      if (!COLLECTIONS.includes(name)) continue
      seen.add(name)
      if (this.state.fileSha[name] === f.sha) continue
      const text = await this.remote.blob(f.sha)
      let remote: Collection
      try {
        remote = parse(text)
      } catch {
        remote = {}
      }
      const { merged, localAhead, remoteAhead } = mergeCollections(this.state.colls[name] ?? {}, remote)
      this.state.colls[name] = merged
      this.state.fileSha[name] = f.sha
      this.state.remoteHash[name] = hash(text)
      const d = this.state.dirty.includes(name)
      if (localAhead && !d) this.state.dirty.push(name)
      if (!localAhead && d) this.state.dirty = this.state.dirty.filter((x) => x !== name)
      if (remoteAhead) changed = true
    }
    // файл исчез из репо (удалили руками) — восстановим
    for (const name of Object.keys(this.state.fileSha) as CollName[]) {
      if (!seen.has(name) && this.state.fileSha[name]) {
        this.state.fileSha[name] = undefined
        if (!this.state.dirty.includes(name)) this.state.dirty.push(name)
      }
    }
    this.state.headSha = h.sha
    this.etag = h.etag
    this.scheduleSave()
    if (changed) this.emit()
  }

  private async pushDirty() {
    for (const name of [...this.state.dirty]) {
      for (let attempt = 0; ; attempt++) {
        if (!this.state.dirty.includes(name)) break
        const rev = this.rev[name] ?? 0
        const c = compact(this.state.colls[name] ?? {})
        this.state.colls[name] = c
        const text = serialize(c)
        const h = hash(text)
        const done = () => {
          if ((this.rev[name] ?? 0) === rev) this.state.dirty = this.state.dirty.filter((x) => x !== name)
        }
        if (this.state.fileSha[name] && this.state.remoteHash[name] === h) {
          done()
          break
        }
        try {
          const label = this.opts.label?.() ?? this.me
          const { sha } = await this.remote.put(`data/${name}.json`, text, this.state.fileSha[name], `${label}: ${name}`)
          this.state.fileSha[name] = sha
          this.state.remoteHash[name] = h
          done()
          this.scheduleSave()
          break
        } catch (e) {
          if (e instanceof ConflictError && attempt < 4) {
            if (attempt) await new Promise((r) => setTimeout(r, 400 * attempt))
            await this.pull(true)
            continue
          }
          throw e
        }
      }
    }
  }

  private async pushImages() {
    while (this.state.imgs.length) {
      const path = this.state.imgs[0]
      const blob = await this.persist.getImg(path)
      if (blob) await this.remote.putBinary(path, await blobToB64(blob), `${this.opts.label?.() ?? this.me}: фото`)
      this.state.imgs.shift()
      this.scheduleSave()
    }
  }

  private async pushNotify() {
    while (this.state.notify.length) {
      const p = this.state.notify[0]
      if (this.canNotify(p)) await this.remote.dispatch(p)
      this.state.notify.shift()
      this.scheduleSave()
    }
  }

  // ---------- фоновый опрос ----------

  start(intervalMs = 20000) {
    const tick = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') void this.sync()
    }
    this.poll = setInterval(tick, intervalMs)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void this.sync()
        else void this.flushSave()
      })
      window.addEventListener('online', () => void this.sync())
      window.addEventListener('focus', () => void this.sync())
    }
    void this.sync()
  }

  stop() {
    clearInterval(this.poll)
    clearTimeout(this.syncTimer)
  }
}
