import { useEffect, useState } from 'preact/hooks'
import { today } from './lib/dates'
import type { CollName, MetaConfig, Profile, PushConfig, Schema, UserId, UsersConfig, WorkerConfig } from './lib/types'
import type { Store } from './sync/store'

export const DEFAULT_USERS: Record<UserId, Profile> = {
  a: { name: 'Я', color: '#4b9cf5' },
  b: { name: 'Ты', color: '#ea7266' },
}

export const COLORS = ['#4b9cf5', '#ea7266', '#1fb5a8', '#9b7cf0', '#f0a93c', '#5cc26e', '#f07ab8', '#8d99ae']

let current: Store | null = null
let demo = false
const appListeners = new Set<() => void>()

export function setStore(s: Store | null, isDemo = false) {
  current?.stop()
  current = s
  demo = isDemo
  for (const fn of appListeners) fn()
}

export const store = () => current!
export const isDemo = () => demo

/** Перерисовка при любом изменении стора (или смене стора). */
export function useStoreVersion() {
  const [, setV] = useState(0)
  useEffect(() => {
    const bump = () => setV((v) => v + 1)
    appListeners.add(bump)
    const un = current?.subscribe(bump)
    return () => {
      appListeners.delete(bump)
      un?.()
    }
  }, [current])
  return current
}

export function useList<K extends CollName>(name: K): Schema[K][] {
  const s = useStoreVersion()
  return s ? s.list(name) : []
}

export function users(): Record<UserId, Profile> {
  const u = current?.get('config', 'users') as UsersConfig | undefined
  return { a: { ...DEFAULT_USERS.a, ...u?.a }, b: { ...DEFAULT_USERS.b, ...u?.b } }
}

export const meta = () => current?.get('config', 'meta') as MetaConfig | undefined
export const pushCfg = () => current?.get('config', 'push') as PushConfig | undefined
export const workerCfg = () => current?.get('config', 'worker') as WorkerConfig | undefined

export const me = () => current!.me
export const nameOf = (u: UserId | 'both') => (u === 'both' ? 'Общее' : users()[u].name)
export const colorOf = (u: UserId | 'both') => (u === 'both' ? '#1fb5a8' : users()[u].color)

/** Склонение глагола по роду: verb('a', 'добавил', 'добавила'). */
export function verb(u: UserId, m: string, f: string) {
  const g = users()[u].g
  return g === 'f' ? f : g === 'm' ? m : `${m}(а)`
}

export const todayStr = () => today(meta()?.timezone)
