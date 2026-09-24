import { createStore, del, get, set } from 'idb-keyval'
import type { UserId } from '../lib/types'
import type { Conn } from './github'
import type { Persisted, Persistence } from './store'

const K_CONN = 'ym.conn'
const K_ME = 'ym.me'

function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function lsSet(k: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* приватный режим */
  }
}

export function loadConn(): Conn | null {
  const s = lsGet(K_CONN)
  if (!s) return null
  try {
    const c = JSON.parse(s)
    if (c.owner && c.repo && c.token) return { branch: 'main', ...c }
  } catch {
    /* битые данные */
  }
  return null
}

export const saveConn = (c: Conn | null) => lsSet(K_CONN, c ? JSON.stringify(c) : null)
export const loadMe = (): UserId | null => {
  const v = lsGet(K_ME)
  return v === 'a' || v === 'b' ? v : null
}
export const saveMe = (u: UserId | null) => lsSet(K_ME, u)

/** Код подключения для второго телефона: YM1.<base64url(json)> */
export function encodeSetup(c: Conn): string {
  const json = JSON.stringify({ o: c.owner, r: c.repo, b: c.branch, t: c.token })
  return 'YM1.' + btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeSetup(code: string): Conn | null {
  const m = code.trim().match(/YM1\.([A-Za-z0-9_-]+)/)
  if (!m) return null
  try {
    const b = m[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(escape(atob(b + '='.repeat((4 - (b.length % 4)) % 4))))
    const j = JSON.parse(json)
    if (!j.o || !j.r || !j.t) return null
    return { owner: j.o, repo: j.r, branch: j.b || 'main', token: j.t }
  } catch {
    return null
  }
}

/** Разбирает «owner/repo» или ссылку на репо. */
export function parseRepo(s: string): { owner: string; repo: string } | null {
  const t = s.trim().replace(/\.git$/, '').replace(/\/+$/, '')
  const m = t.match(/(?:github\.com[/:])?([\w.-]+)\/([\w.-]+)$/)
  return m ? { owner: m[1], repo: m[2] } : null
}

// ---------- IndexedDB ----------

const db = typeof indexedDB !== 'undefined' ? createStore('you-me', 'kv') : undefined

export function idbPersistence(ns: string): Persistence {
  const key = `state:${ns}`
  return {
    async load() {
      if (!db) return undefined
      try {
        return (await get<Persisted>(key, db)) ?? undefined
      } catch {
        return undefined
      }
    },
    async save(p) {
      if (!db) return
      try {
        await set(key, p, db)
      } catch {
        /* нет места / приватный режим */
      }
    },
    async getImg(path) {
      if (!db) return undefined
      try {
        return (await get<Blob>(`img:${path}`, db)) ?? undefined
      } catch {
        return undefined
      }
    },
    async setImg(path, blob) {
      if (!db) return
      try {
        await set(`img:${path}`, blob, db)
      } catch {
        /* ignore */
      }
    },
  }
}

export async function clearState(ns: string) {
  if (db) await del(`state:${ns}`, db).catch(() => undefined)
}

/** Хранилище в памяти (демо-режим). */
export function memoryPersistence(): Persistence {
  const imgs = new Map<string, Blob>()
  return {
    async load() {
      return undefined
    },
    async save() {},
    async getImg(p) {
      return imgs.get(p)
    },
    async setImg(p, b) {
      imgs.set(p, b)
    },
  }
}
