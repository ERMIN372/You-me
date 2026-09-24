import { b64ToUtf8, utf8ToB64 } from '../lib/b64'
import type { NotifyPayload } from '../lib/types'
import { AuthError, ConflictError, HttpError, OfflineError, type HeadResult, type Remote, type RemoteFile } from './remote'

export interface Conn {
  owner: string
  repo: string
  branch: string
  token: string
}

const API = 'https://api.github.com'

const encPath = (p: string) => p.split('/').map(encodeURIComponent).join('/')

export class GitHubRemote implements Remote {
  constructor(private c: Conn) {}

  private get base() {
    return `${API}/repos/${encodeURIComponent(this.c.owner)}/${encodeURIComponent(this.c.repo)}`
  }

  private async req(url: string, init: RequestInit & { accept?: string; etag?: string } = {}): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.c.token}`,
      Accept: init.accept ?? 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (init.etag) headers['If-None-Match'] = init.etag
    if (init.body) headers['Content-Type'] = 'application/json'
    let res: Response
    try {
      res = await fetch(url.startsWith('http') ? url : this.base + url, { ...init, headers, cache: 'no-store' })
    } catch {
      throw new OfflineError('Нет сети')
    }
    if (res.status === 401) throw new AuthError('Токен не подходит или истёк')
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
      throw new HttpError(403, 'Лимит запросов GitHub исчерпан, подождите немного')
    }
    return res
  }

  private async fail(res: Response): Promise<never> {
    let msg = `GitHub ответил ${res.status}`
    try {
      const j = await res.json()
      if (j?.message) msg += `: ${j.message}`
    } catch {
      /* пусто */
    }
    throw new HttpError(res.status, msg)
  }

  /** Проверка подключения: доступ к репо и права. */
  async info(): Promise<{ defaultBranch: string; private: boolean; canPush: boolean }> {
    const res = await this.req('')
    if (res.status === 404) throw new HttpError(404, 'Репозиторий не найден или у токена нет к нему доступа')
    if (!res.ok) await this.fail(res)
    const j = await res.json()
    return { defaultBranch: j.default_branch, private: j.private, canPush: j.permissions?.push !== false }
  }

  async head(etag?: string): Promise<HeadResult> {
    const res = await this.req(`/git/ref/heads/${encPath(this.c.branch)}`, { etag })
    if (res.status === 304) return { same: true }
    // 409 — репо пустой, 404 — ветки ещё нет
    if (res.status === 409 || res.status === 404) return { same: false, sha: null }
    if (!res.ok) await this.fail(res)
    const j = await res.json()
    return { same: false, sha: j.object.sha, etag: res.headers.get('etag') ?? undefined }
  }

  async list(head: string): Promise<RemoteFile[]> {
    const res = await this.req(`/contents/data?ref=${head}`)
    if (res.status === 404) return []
    if (!res.ok) await this.fail(res)
    const j = await res.json()
    if (!Array.isArray(j)) return []
    return j
      .filter((f: { type: string; name: string }) => f.type === 'file' && f.name.endsWith('.json'))
      .map((f: { name: string; sha: string }) => ({ name: f.name, sha: f.sha }))
  }

  async blob(sha: string): Promise<string> {
    const res = await this.req(`/git/blobs/${sha}`)
    if (!res.ok) await this.fail(res)
    const j = await res.json()
    return b64ToUtf8(j.content)
  }

  private async putRaw(path: string, content: string, sha: string | undefined, message: string) {
    const res = await this.req(`/contents/${encPath(path)}`, {
      method: 'PUT',
      body: JSON.stringify({ message, content, sha, branch: this.c.branch }),
    })
    if (res.status === 409) throw new ConflictError('Файл изменился')
    if (res.status === 422) {
      const j = await res.json().catch(() => ({}))
      const m = String(j?.message ?? '')
      if (/sha/i.test(m)) throw new ConflictError(m)
      throw new HttpError(422, m || 'GitHub отклонил запись')
    }
    if (!res.ok) await this.fail(res)
    return res.json()
  }

  async put(path: string, text: string, sha: string | undefined, message: string) {
    const j = await this.putRaw(path, utf8ToB64(text), sha, message)
    return { sha: j.content.sha as string }
  }

  async putBinary(path: string, b64: string, message: string) {
    try {
      await this.putRaw(path, b64, undefined, message)
    } catch (e) {
      // Уже загружено (например, после обрыва связи) — ок
      if (e instanceof ConflictError) return
      throw e
    }
  }

  async getBinary(path: string): Promise<Blob> {
    const res = await this.req(`/contents/${encPath(path)}?ref=${encodeURIComponent(this.c.branch)}`, {
      accept: 'application/vnd.github.raw',
    })
    if (!res.ok) await this.fail(res)
    return res.blob()
  }

  async fileSha(path: string): Promise<string | null> {
    const res = await this.req(`/contents/${encPath(path)}?ref=${encodeURIComponent(this.c.branch)}`)
    if (res.status === 404) return null
    if (!res.ok) await this.fail(res)
    const j = await res.json()
    return j.sha ?? null
  }

  async dispatch(payload: NotifyPayload) {
    const res = await this.req('/dispatches', {
      method: 'POST',
      body: JSON.stringify({ event_type: 'notify', client_payload: payload }),
    })
    if (!res.ok) await this.fail(res)
  }
}
