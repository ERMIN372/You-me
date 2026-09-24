import { describe, expect, it } from 'vitest'
import { MemoryRemote } from '../src/sync/memory'
import { mergeCollections, parse, serialize } from '../src/sync/merge'
import { Store, type Persisted, type Persistence } from '../src/sync/store'
import type { UserId } from '../src/lib/types'

function memPersist(): Persistence & { saved?: Persisted } {
  const imgs = new Map<string, Blob>()
  const p: Persistence & { saved?: Persisted } = {
    async load() {
      return p.saved ? structuredClone(p.saved) : undefined
    },
    async save(s) {
      p.saved = structuredClone(s)
    },
    async getImg(path) {
      return imgs.get(path)
    },
    async setImg(path, blob) {
      imgs.set(path, blob)
    },
  }
  return p
}

function device(remote: MemoryRemote, me: UserId) {
  const s = new Store(remote, me, memPersist(), { syncDelay: 1e9 })
  return s
}

describe('merge', () => {
  it('last write wins per record, tombstones win when newer', () => {
    const l = { x: { id: 'x', createdAt: 1, updatedAt: 5, by: 'a' as const, t: 'L' } }
    const r = { x: { id: 'x', createdAt: 1, updatedAt: 3, by: 'a' as const, t: 'R' }, y: { id: 'y', createdAt: 1, updatedAt: 1, by: 'b' as const } }
    const m = mergeCollections<any>(l, r)
    expect(m.merged.x.t).toBe('L')
    expect(m.merged.y).toBeDefined()
    expect(m.localAhead).toBe(true)
    expect(m.remoteAhead).toBe(true)
  })

  it('serialize/parse roundtrip', () => {
    const c = { b: { id: 'b', createdAt: 1, updatedAt: 1, by: 'a' as const }, a: { id: 'a', createdAt: 1, updatedAt: 2, by: 'b' as const } }
    expect(parse(serialize(c))).toEqual(c)
  })
})

describe('store sync', () => {
  it('two devices converge after concurrent edits of the same file', async () => {
    const remote = new MemoryRemote()
    const A = device(remote, 'a')
    const B = device(remote, 'b')
    A.put('shopping', { title: 'молоко', done: false })
    await A.sync()
    await B.sync()
    expect(B.list('shopping').map((x) => x.title)).toEqual(['молоко'])

    // Оба добавляют в один и тот же файл, не зная друг о друге
    A.put('shopping', { title: 'хлеб', done: false })
    B.put('shopping', { title: 'сыр', done: false })
    await A.sync()
    await B.sync() // B получает конфликт → подтягивает → сливает → пушит
    await A.sync()
    const titles = (s: Store) => s.list('shopping').map((x) => x.title).sort()
    expect(titles(A)).toEqual(['молоко', 'сыр', 'хлеб'])
    expect(titles(B)).toEqual(['молоко', 'сыр', 'хлеб'])
    expect(A.state.dirty).toEqual([])
    expect(B.state.dirty).toEqual([])
  })

  it('handles a write that sneaks in between pull and put', async () => {
    const remote = new MemoryRemote()
    const A = device(remote, 'a')
    const B = device(remote, 'b')
    A.put('events', { title: 'ДР', kind: 'event', start: '2026-10-08' })
    await A.sync()
    await B.sync()
    let sneaked = false
    remote.beforePut = async () => {
      if (sneaked) return
      sneaked = true
      B.put('events', { title: 'Поездка', kind: 'trip', start: '2026-10-12', end: '2026-10-26' })
      await B.sync()
    }
    A.put('events', { title: 'Ужин', kind: 'event', start: '2026-10-10' })
    await A.sync()
    remote.beforePut = undefined
    await B.sync()
    expect(A.list('events').length).toBe(3)
    expect(B.list('events').length).toBe(3)
  })

  it('deletes propagate and are not resurrected', async () => {
    const remote = new MemoryRemote()
    const A = device(remote, 'a')
    const B = device(remote, 'b')
    const w = A.put('wishes', { title: 'Ваза', owner: 'a', currency: 'RUB', priority: 2 })
    await A.sync()
    await B.sync()
    B.remove('wishes', w.id)
    await B.sync()
    await A.sync()
    expect(A.list('wishes')).toEqual([])
    await A.sync()
    await B.sync()
    expect(B.list('wishes')).toEqual([])
  })

  it('queues changes offline and pushes when back online', async () => {
    const remote = new MemoryRemote()
    const A = device(remote, 'a')
    remote.offline = true
    A.put('cards', { name: 'Пятёрочка', number: '4600517000000', format: 'EAN13', color: '#e33' })
    await A.sync()
    expect(A.status).toBe('offline')
    expect(A.state.dirty).toContain('cards')
    remote.offline = false
    await A.sync()
    expect(A.status).toBe('idle')
    expect(A.state.dirty).toEqual([])
    const B = device(remote, 'b')
    await B.sync()
    expect(B.list('cards')[0].name).toBe('Пятёрочка')
  })

  it('uses ETag: an idle sync costs one request and no writes', async () => {
    const remote = new MemoryRemote()
    const A = device(remote, 'a')
    A.put('people', { name: 'Мама', day: 8, month: 10, whose: 'b' })
    await A.sync()
    await A.sync()
    const before = remote.calls
    const commits = remote.commit
    await A.sync()
    expect(remote.calls - before).toBe(1)
    expect(remote.commit).toBe(commits)
  })

  it('persists state and resumes after reload', async () => {
    const remote = new MemoryRemote()
    const p = memPersist()
    const A = new Store(remote, 'a', p, { syncDelay: 1e9 })
    remote.offline = true
    A.put('plans', { title: 'Япония', kind: 'trip', budget: 5000, currency: 'EUR' })
    await A.flushSave()
    const A2 = new Store(remote, 'a', p, { syncDelay: 1e9 })
    await A2.init()
    expect(A2.list('plans')[0].title).toBe('Япония')
    remote.offline = false
    await A2.sync()
    const B = device(remote, 'b')
    await B.sync()
    expect(B.list('plans')[0].budget).toBe(5000)
  })

  it('coalesces notifications with the same tag and only sends when allowed', async () => {
    const remote = new MemoryRemote()
    const A = device(remote, 'a')
    A.canNotify = () => true
    A.notify({ to: 'b', title: 'Покупки', body: 'молоко', tag: 'shop', append: true })
    A.notify({ to: 'b', title: 'Покупки', body: 'хлеб', tag: 'shop', append: true })
    await A.sync()
    expect(remote.dispatched).toEqual([{ to: 'b', title: 'Покупки', body: 'молоко, хлеб', tag: 'shop', append: true }])
  })

  it('uploads images once', async () => {
    const remote = new MemoryRemote()
    const A = device(remote, 'a')
    await A.addImage('img/x.jpg', new Blob([new Uint8Array([1, 2, 3])]))
    await A.sync()
    const B = device(remote, 'b')
    const blob = await B.fetchImg('img/x.jpg')
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  })
})
