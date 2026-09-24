import type { NotifyPayload } from '../lib/types'

export class ConflictError extends Error {}
export class OfflineError extends Error {}
export class AuthError extends Error {}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export interface RemoteFile {
  name: string
  sha: string
}

export type HeadResult = { same: true } | { same: false; sha: string | null; etag?: string }

/** Хранилище данных. Реализации: GitHub (приватный репо) и память (демо/тесты). */
export interface Remote {
  /** Текущий коммит ветки. sha = null — репо пустой. same — не изменилось с etag. */
  head(etag?: string): Promise<HeadResult>
  /** JSON-файлы в data/ на коммите head. */
  list(head: string): Promise<RemoteFile[]>
  blob(sha: string): Promise<string>
  /** Создать/обновить текстовый файл. sha — известная версия файла (undefined = новый). */
  put(path: string, text: string, sha: string | undefined, message: string): Promise<{ sha: string }>
  /** Загрузить бинарный файл (картинку). Если уже есть — ок. */
  putBinary(path: string, b64: string, message: string): Promise<void>
  getBinary(path: string): Promise<Blob>
  /** sha файла по пути или null. */
  fileSha(path: string): Promise<string | null>
  dispatch(payload: NotifyPayload): Promise<void>
}
