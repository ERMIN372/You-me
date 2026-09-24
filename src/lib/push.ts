import workflowYml from '../../data-repo/.github/workflows/you-me-notify.yml?raw'
import notifyScript from '../../data-repo/.github/you-me/notify.mjs?raw'
import { b64url, b64urlToBytes, hash } from './b64'
import type { Device, NotifyPayload, PushConfig } from './types'
import { HttpError } from '../sync/remote'
import { pushCfg, store } from '../state'

export const WORKFLOW_PATH = '.github/workflows/you-me-notify.yml'
export const SCRIPT_PATH = '.github/you-me/notify.mjs'

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** Можно ли отправлять: пуши настроены и у адресата есть устройство. */
export function canNotify(p: NotifyPayload): boolean {
  const cfg = pushCfg()
  if (!cfg?.installed) return false
  const devices = store().list('devices')
  return devices.some((d) => p.to === 'both' || d.user === p.to)
}

/** Генерирует VAPID-ключи прямо в браузере (ECDSA P-256). */
export async function generateVapid(): Promise<{ publicKey: string; privateKey: string }> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey)
  return { publicKey: b64url(pub), privateKey: jwk.d! }
}

/** Кладёт workflow и скрипт уведомлений в репо с данными. Нужен доступ токена «Workflows: Read and write». */
export async function installWorkflow(): Promise<void> {
  const r = store().remote
  for (const [path, text] of [
    [SCRIPT_PATH, notifyScript],
    [WORKFLOW_PATH, workflowYml],
  ] as const) {
    try {
      const sha = (await r.fileSha(path)) ?? undefined
      await r.put(path, text, sha, 'You&Me: автоматизация уведомлений')
    } catch (e) {
      if (e instanceof HttpError && (e.status === 403 || e.status === 404)) {
        throw new Error('Токену не хватает права «Workflows: Read and write». Добавь его в настройках токена на GitHub или скопируй файлы из папки data-repo вручную.')
      }
      throw e
    }
  }
}

export async function setupPush(appUrl: string): Promise<PushConfig> {
  const existing = pushCfg()
  const keys = existing ?? (await generateVapid())
  await installWorkflow()
  return store().put('config', {
    id: 'push',
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    subject: existing?.subject ?? appUrl,
    installed: true,
  }) as unknown as PushConfig
}

async function registration() {
  if (!pushSupported()) throw new Error('Этот браузер не умеет пуши')
  return navigator.serviceWorker.ready
}

export async function currentDeviceId(): Promise<string | null> {
  if (!pushSupported()) return null
  try {
    const reg = await Promise.race([registration(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))])
    const sub = await reg.pushManager.getSubscription()
    return sub ? `d${hash(sub.endpoint)}` : null
  } catch {
    return null
  }
}

export async function enableOnThisDevice(): Promise<Device> {
  const cfg = pushCfg()
  if (!cfg) throw new Error('Сначала настрой уведомления')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Уведомления запрещены. Разреши в Настройках iPhone → Уведомления → You&Me.')
  const reg = await registration()
  let sub = await reg.pushManager.getSubscription()
  const key = b64urlToBytes(cfg.publicKey)
  // Подписка со старым ключом — пересоздаём
  if (sub && sub.options.applicationServerKey) {
    const cur = new Uint8Array(sub.options.applicationServerKey)
    if (cur.length !== key.length || cur.some((b, i) => b !== key[i])) {
      await sub.unsubscribe()
      sub = null
    }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as BufferSource })
  const s = store()
  return s.put('devices', { id: `d${hash(sub.endpoint)}`, user: s.me, sub: sub.toJSON(), ua: navigator.userAgent.slice(0, 160) })
}

export async function disableOnThisDevice() {
  const reg = await registration()
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  store().remove('devices', `d${hash(sub.endpoint)}`)
  await sub.unsubscribe()
}
