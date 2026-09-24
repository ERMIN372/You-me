import type { ComponentChildren, JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { compressImage } from '../lib/image'
import type { UserId } from '../lib/types'
import { COLORS, colorOf, nameOf, store, users } from '../state'
import { ICamera, IImage } from './icons'

// ---------- тосты ----------

let toastFn: ((m: string) => void) | null = null
export const toast = (m: string) => toastFn?.(m)

export function Toasts() {
  const [msg, setMsg] = useState('')
  const t = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    toastFn = (m) => {
      setMsg(m)
      clearTimeout(t.current)
      t.current = setTimeout(() => setMsg(''), 2600)
    }
    return () => {
      toastFn = null
    }
  }, [])
  return msg ? <div class="toast">{msg}</div> : null
}

// ---------- шторка ----------

export function Sheet(props: { title?: string; onClose: () => void; children: ComponentChildren; right?: ComponentChildren }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [])
  return (
    <div class="sheet-bg" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="grab" />
        {(props.title || props.right) && (
          <div class="sheet-head">
            <h2>{props.title}</h2>
            {props.right ?? (
              <button class="x" onClick={props.onClose}>
                Закрыть
              </button>
            )}
          </div>
        )}
        {props.children}
      </div>
    </div>
  )
}

// ---------- поля ----------

/** Поле формы. group — для кнопок/переключателей (не оборачиваем в <label>, иначе тап по подписи жмёт первую кнопку). */
export function Field(props: { label: string; hint?: ComponentChildren; children: ComponentChildren; group?: boolean }) {
  const Tag = props.group ? 'div' : 'label'
  return (
    <Tag class="field">
      <span>{props.label}</span>
      {props.children}
      {props.hint && <small class="hint">{props.hint}</small>}
    </Tag>
  )
}

export function Toggle(props: { label: ComponentChildren; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" class="toggle" style={{ width: '100%' }} onClick={() => props.onChange(!props.value)}>
      <span style={{ textAlign: 'left' }}>{props.label}</span>
      <span class={`switch ${props.value ? 'on' : ''}`} />
    </button>
  )
}

export function Seg<T extends string>(props: { options: [T, ComponentChildren][]; value: T; onChange: (v: T) => void; sm?: boolean }) {
  return (
    <div class={`seg ${props.sm ? 'sm' : ''}`}>
      {props.options.map(([v, label]) => (
        <button type="button" key={v} class={v === props.value ? 'on' : ''} onClick={() => props.onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function Swatches(props: { value: string; onChange: (c: string) => void; colors?: string[] }) {
  return (
    <div class="swatches">
      {(props.colors ?? COLORS).map((c) => (
        <button type="button" key={c} class={`swatch ${c === props.value ? 'on' : ''}`} style={{ background: c }} onClick={() => props.onChange(c)} aria-label={c} />
      ))}
    </div>
  )
}

// ---------- люди ----------

export function Duo({ size = 30, onClick }: { size?: number; onClick?: () => void }) {
  const u = users()
  const r = size / 2
  const w = size * 1.6
  return (
    <button class="tap" onClick={onClick} aria-label="Настройки" style={{ display: 'inline-flex' }}>
      <svg width={w} height={size} viewBox={`0 0 ${w} ${size}`}>
        <defs>
          <clipPath id={`duo-${size}`}>
            <circle cx={r} cy={r} r={r - 0.5} />
          </clipPath>
        </defs>
        <circle cx={r} cy={r} r={r - 0.5} fill={u.a.color} />
        <circle cx={w - r} cy={r} r={r - 0.5} fill={u.b.color} />
        <circle cx={w - r} cy={r} r={r - 0.5} fill="#f3efe8" opacity="0.5" clip-path={`url(#duo-${size})`} />
      </svg>
    </button>
  )
}

export function Avatar({ u, size }: { u: UserId; size?: number }) {
  const name = nameOf(u)
  return (
    <span class="avatar" style={{ background: colorOf(u), ...(size ? { width: size, height: size, fontSize: size * 0.42 } : {}) }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export const Dot = ({ u, color, size = 10 }: { u?: UserId | 'both'; color?: string; size?: number }) => (
  <i class="dot" style={{ background: color ?? colorOf(u ?? 'both'), width: size, height: size }} />
)

// ---------- картинки ----------

const urlCache = new Map<string, string>()

export function useImage(path?: string): string | undefined {
  const [url, setUrl] = useState<string | undefined>(path ? urlCache.get(path) : undefined)
  useEffect(() => {
    if (!path) return setUrl(undefined)
    const hit = urlCache.get(path)
    if (hit) return setUrl(hit)
    let alive = true
    store()
      .fetchImg(path)
      .then((blob) => {
        const u = URL.createObjectURL(blob)
        urlCache.set(path, u)
        if (alive) setUrl(u)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [path])
  return url
}

export function Img({ path, alt = '', placeholder }: { path?: string; alt?: string; placeholder?: string }) {
  const url = useImage(path)
  return url ? <img src={url} alt={alt} loading="lazy" /> : placeholder ? <span>{placeholder}</span> : null
}

/** Выбор фото (камера/галерея), сжатие, сохранение в очередь загрузки. Возвращает путь в репо. */
export function PhotoPicker(props: { value?: string; onChange: (path: string | undefined) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const onFile = async (e: JSX.TargetedEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0]
    e.currentTarget.value = ''
    if (!f) return
    setBusy(true)
    try {
      const blob = await compressImage(f)
      const path = await saveImage(blob)
      props.onChange(path)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Не получилось')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div class="row" style={{ gap: 12 }}>
      <div class="thumb" style={{ width: 72, height: 72 }}>
        <Img path={props.value} placeholder="фото" />
      </div>
      <div class="grow row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" class="btn ghost sm" onClick={() => input.current?.click()} disabled={busy}>
          {props.value ? <IImage size={18} /> : <ICamera size={18} />}
          {busy ? 'Сжимаю…' : props.value ? 'Заменить' : (props.label ?? 'Добавить фото')}
        </button>
        {props.value && (
          <button type="button" class="btn ghost sm" onClick={() => props.onChange(undefined)}>
            Убрать
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  )
}

export async function saveImage(blob: Blob): Promise<string> {
  const id = crypto.getRandomValues(new Uint32Array(2)).join('').slice(0, 14)
  const path = `img/${new Date().toISOString().slice(0, 7)}/${id}.jpg`
  await store().addImage(path, blob)
  urlCache.set(path, URL.createObjectURL(blob))
  return path
}

export function Empty({ icon, children }: { icon: string; children: ComponentChildren }) {
  return (
    <div class="empty">
      <div class="big">{icon}</div>
      {children}
    </div>
  )
}

/** Tint-подсветка сверху экрана, как в промо-скринах. */
export const Glow = ({ color }: { color: string }) => <div class="screen-glow" style={{ background: `radial-gradient(120% 70% at 10% -10%, ${color}, transparent 70%)` }} />
