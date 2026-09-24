import { afterEach, describe, expect, it, vi } from 'vitest'
import { GitHubRemote, type Conn } from '../src/sync/github'
import { Store, type Persistence } from '../src/sync/store'

/** Мини-эмулятор GitHub REST API (то, что использует приложение). */
function fakeGitHub() {
  const files = new Map<string, { sha: string; bytes: Buffer }>()
  const blobs = new Map<string, Buffer>()
  let commit = 0
  const log: string[] = []
  const dispatches: unknown[] = []
  const head = () => (commit ? `commit${commit}` : null)
  const b64wrap = (b: Buffer) => b.toString('base64').replace(/(.{60})/g, '$1\n')

  const handler = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const method = init.method ?? 'GET'
    const h = new Headers(init.headers)
    log.push(`${method} ${url.pathname}${url.search}`)
    expect(h.get('authorization')).toBe('Bearer tkn')
    expect(init.cache).toBe('no-store')
    const m = url.pathname.match(/^\/repos\/me\/data(\/.*)?$/)
    if (!m) return new Response('{}', { status: 404 })
    const p = m[1] ?? ''
    const json = (d: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json', ...headers } })

    if (p === '') return json({ default_branch: 'main', private: true, permissions: { push: true } })
    if (p === '/git/ref/heads/main') {
      const sha = head()
      if (!sha) return json({ message: 'Git Repository is empty.' }, 409)
      const etag = `W/"${sha}"`
      if (h.get('if-none-match') === etag) return new Response(null, { status: 304 })
      return json({ object: { sha } }, 200, { etag })
    }
    if (p === '/contents/data' && method === 'GET') {
      const list = [...files.entries()].filter(([k]) => k.startsWith('data/') && !k.slice(5).includes('/')).map(([k, v]) => ({ name: k.slice(5), path: k, sha: v.sha, type: 'file' }))
      return list.length ? json(list) : json({ message: 'Not Found' }, 404)
    }
    const blob = p.match(/^\/git\/blobs\/(.+)$/)
    if (blob) return json({ content: b64wrap(blobs.get(blob[1])!), encoding: 'base64' })
    if (p === '/dispatches' && method === 'POST') {
      dispatches.push(JSON.parse(String(init.body)))
      return new Response(null, { status: 204 })
    }
    const c = p.match(/^\/contents\/(.+)$/)
    if (c) {
      const path = decodeURIComponent(c[1])
      const cur = files.get(path)
      if (method === 'PUT') {
        const body = JSON.parse(String(init.body))
        if (cur && !body.sha) return json({ message: 'Invalid request.\n\n"sha" wasn\'t supplied.' }, 422)
        if (cur && body.sha !== cur.sha) return json({ message: `${path} does not match ${body.sha}` }, 409)
        if (!cur && body.sha) return json({ message: 'sha does not match' }, 409)
        const bytes = Buffer.from(body.content, 'base64')
        commit++
        const sha = `blob${commit}`
        files.set(path, { sha, bytes })
        blobs.set(sha, bytes)
        return json({ content: { sha, path }, commit: { sha: head() } }, cur ? 200 : 201)
      }
      if (!cur) return json({ message: 'Not Found' }, 404)
      if (h.get('accept') === 'application/vnd.github.raw') return new Response(new Uint8Array(cur.bytes))
      return json({ sha: cur.sha, path })
    }
    return json({ message: 'unhandled ' + p }, 500)
  }
  return { handler, files, log, dispatches }
}

const persist = (): Persistence => {
  const imgs = new Map<string, Blob>()
  return { load: async () => undefined, save: async () => {}, getImg: async (p) => imgs.get(p), setImg: async (p, b) => void imgs.set(p, b) }
}
const conn: Conn = { owner: 'me', repo: 'data', branch: 'main', token: 'tkn' }

afterEach(() => vi.unstubAllGlobals())

describe('GitHubRemote + Store against fake GitHub API', () => {
  it('bootstraps an empty repo, syncs two devices, handles conflicts and Cyrillic', async () => {
    const gh = fakeGitHub()
    vi.stubGlobal('fetch', gh.handler)
    const info = await new GitHubRemote(conn).info()
    expect(info).toEqual({ defaultBranch: 'main', private: true, canPush: true })

    const A = new Store(new GitHubRemote(conn), 'a', persist(), { syncDelay: 1e9 })
    const B = new Store(new GitHubRemote(conn), 'b', persist(), { syncDelay: 1e9 })
    A.put('shopping', { title: 'Молоко «Простоквашино» 🥛', done: false })
    await A.sync()
    expect(A.status).toBe('idle')
    expect(gh.files.has('data/shopping.json')).toBe(true)

    await B.sync()
    expect(B.list('shopping')[0].title).toBe('Молоко «Простоквашино» 🥛')

    A.put('shopping', { title: 'Хлеб', done: false })
    B.put('shopping', { title: 'Сыр', done: false })
    await A.sync()
    await B.sync() // 409 → pull → merge → retry
    await A.sync()
    const t = (s: Store) => s.list('shopping').map((x) => x.title).sort()
    expect(t(A)).toEqual(['Молоко «Простоквашино» 🥛', 'Сыр', 'Хлеб'])
    expect(t(B)).toEqual(t(A))
    expect(gh.log.some((l) => l.startsWith('PUT'))).toBe(true)
  })

  it('idle sync is a single conditional request (304)', async () => {
    const gh = fakeGitHub()
    vi.stubGlobal('fetch', gh.handler)
    const A = new Store(new GitHubRemote(conn), 'a', persist(), { syncDelay: 1e9 })
    A.put('cards', { name: 'Пятёрочка', number: '4600517000003', format: 'EAN13', color: '#f00' })
    await A.sync()
    await A.sync()
    const n = gh.log.length
    await A.sync()
    expect(gh.log.slice(n)).toEqual(['GET /repos/me/data/git/ref/heads/main'])
  })

  it('uploads images, downloads raw, sends dispatch', async () => {
    const gh = fakeGitHub()
    vi.stubGlobal('fetch', gh.handler)
    const A = new Store(new GitHubRemote(conn), 'a', persist(), { syncDelay: 1e9 })
    A.canNotify = () => true
    await A.addImage('img/2026-09/x.jpg', new Blob([new Uint8Array([255, 216, 255, 0, 1])]))
    A.notify({ to: 'b', title: 'Хотелка', body: 'Ваза' })
    await A.sync()
    expect(A.status).toBe('idle')
    expect(gh.dispatches).toEqual([{ event_type: 'notify', client_payload: { to: 'b', title: 'Хотелка', body: 'Ваза' } }])
    const B = new Store(new GitHubRemote(conn), 'b', persist(), { syncDelay: 1e9 })
    const blob = await B.fetchImg('img/2026-09/x.jpg')
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([255, 216, 255, 0, 1])
    // повторная загрузка того же файла (422 "sha wasn't supplied") — не ошибка
    await new GitHubRemote(conn).putBinary('img/2026-09/x.jpg', 'AAAA', 'again')
  })

  it('reports auth errors', async () => {
    vi.stubGlobal('fetch', async () => new Response('{"message":"Bad credentials"}', { status: 401 }))
    const A = new Store(new GitHubRemote(conn), 'a', persist(), { syncDelay: 1e9 })
    await A.sync()
    expect(A.status).toBe('auth')
  })
})
