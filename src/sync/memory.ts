import { b64ToBytes, hash } from '../lib/b64'
import type { NotifyPayload } from '../lib/types'
import { ConflictError, OfflineError, type HeadResult, type Remote, type RemoteFile } from './remote'

interface MemFile {
  sha: string
  text?: string
  bin?: Uint8Array
}

/** Репо в памяти: для демо-режима и тестов. Повторяет семантику конфликтов GitHub Contents API. */
export class MemoryRemote implements Remote {
  files = new Map<string, MemFile>()
  blobs = new Map<string, string>()
  commit = 0
  offline = false
  dispatched: NotifyPayload[] = []
  /** Счётчик запросов — чтобы тесты видели, что ETag экономит вызовы. */
  calls = 0
  /** Хук для тестов: вызывается перед put — можно вклинить «чужую» запись. */
  beforePut?: (path: string) => Promise<void> | void

  private check() {
    this.calls++
    if (this.offline) throw new OfflineError('offline')
  }

  private headSha() {
    return this.commit ? `c${this.commit}` : null
  }

  async head(etag?: string): Promise<HeadResult> {
    this.check()
    const sha = this.headSha()
    if (etag && etag === `"${sha}"`) return { same: true }
    return { same: false, sha, etag: sha ? `"${sha}"` : undefined }
  }

  async list(_head: string): Promise<RemoteFile[]> {
    this.check()
    const out: RemoteFile[] = []
    for (const [path, f] of this.files) {
      if (path.startsWith('data/') && path.endsWith('.json') && !path.slice(5).includes('/')) {
        out.push({ name: path.slice(5), sha: f.sha })
      }
    }
    return out
  }

  async blob(sha: string): Promise<string> {
    this.check()
    const t = this.blobs.get(sha)
    if (t === undefined) throw new Error('no blob ' + sha)
    return t
  }

  async put(path: string, text: string, sha: string | undefined, _message: string) {
    this.check()
    await this.beforePut?.(path)
    return this.write(path, text, sha)
  }

  /** Прямая запись (как будто это сделало другое устройство). */
  write(path: string, text: string, sha: string | undefined) {
    const cur = this.files.get(path)
    if (cur && cur.sha !== sha) throw new ConflictError('sha mismatch')
    if (!cur && sha) throw new ConflictError('file gone')
    this.commit++
    const nsha = hash(text) + '.' + this.commit
    this.files.set(path, { sha: nsha, text })
    this.blobs.set(nsha, text)
    return { sha: nsha }
  }

  async putBinary(path: string, b64: string, _message: string) {
    this.check()
    if (this.files.has(path)) return
    this.commit++
    this.files.set(path, { sha: 'b' + this.commit, bin: b64ToBytes(b64) })
  }

  async getBinary(path: string): Promise<Blob> {
    this.check()
    const f = this.files.get(path)
    if (!f?.bin) throw new Error('not found')
    return new Blob([f.bin as BlobPart])
  }

  async fileSha(path: string) {
    this.check()
    return this.files.get(path)?.sha ?? null
  }

  async dispatch(payload: NotifyPayload) {
    this.check()
    this.dispatched.push(payload)
  }
}
