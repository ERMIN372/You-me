import { workerCfg } from '../state'

export interface LinkPreview {
  title?: string
  price?: number
  currency?: string
  image?: string
}

/** Подтягивает название/цену/картинку по ссылке через ваш Cloudflare Worker (см. worker/README.md). */
export async function fetchPreview(url: string): Promise<LinkPreview> {
  const w = workerCfg()
  if (!w?.url) throw new Error('Не настроен Worker для ссылок (Настройки → Ссылки)')
  const res = await fetch(`${w.url.replace(/\/+$/, '')}/preview?url=${encodeURIComponent(url)}`, {
    headers: { 'X-Key': w.key },
  })
  if (!res.ok) throw new Error(res.status === 403 ? 'Неверный ключ Worker' : `Сайт не отдал данные (${res.status})`)
  return res.json()
}

export async function fetchImageViaWorker(imageUrl: string): Promise<Blob> {
  const w = workerCfg()
  if (!w?.url) throw new Error('Worker не настроен')
  const res = await fetch(`${w.url.replace(/\/+$/, '')}/image?url=${encodeURIComponent(imageUrl)}`, {
    headers: { 'X-Key': w.key },
  })
  if (!res.ok) throw new Error('Картинка не скачалась')
  return res.blob()
}
