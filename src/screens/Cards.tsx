import { useEffect, useRef, useState } from 'preact/hooks'
import { detectFormat, formatLabel, FORMATS, fromZxing, groupNumber, qrSvg, renderBarcode } from '../lib/barcode'
import type { BarcodeFormat, LoyaltyCard } from '../lib/types'
import { colorOf, nameOf, store, useList, verb } from '../state'
import { IPlus, IScan } from '../ui/icons'
import { Duo, Empty, Field, Glow, Sheet, Swatches, toast } from '../ui/kit'
import { Scanner } from '../ui/Scanner'

const CARD_COLORS = ['#d8312f', '#1f8f3a', '#ef7d00', '#1e62d0', '#6a3fc8', '#26272c', '#e0a800', '#d6336c', '#0f8f86', '#7a4a2a']

export function CardsScreen({ openSettings }: { openSettings: () => void }) {
  const cards = useList('cards').sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  const [view, setView] = useState<LoyaltyCard | null>(null)
  const [edit, setEdit] = useState<Partial<LoyaltyCard> | null>(null)
  return (
    <div class="screen">
      <Glow color="rgba(120, 55, 25, 0.35)" />
      <div class="head">
        <div>
          <div class="caps">{cards.length ? `${cards.length} ${cards.length === 1 ? 'карта' : cards.length < 5 ? 'карты' : 'карт'}` : 'лояльность'}</div>
          <h1>Карты</h1>
        </div>
        <div class="actions">
          <button class="icon-btn" onClick={() => setEdit({})} aria-label="Добавить карту">
            <IPlus />
          </button>
          <Duo size={34} onClick={openSettings} />
        </div>
      </div>
      {cards.length === 0 && <Empty icon="💳">Добавьте карты магазинов — на кассе достаточно открыть штрихкод. Работает и без интернета.</Empty>}
      <div class="cards-grid">
        {cards.map((c) => (
          <button key={c.id} class="lcard tap" style={{ background: c.color }} onClick={() => setView(c)}>
            <div class="n">{c.name}</div>
            <div class="num">
              <span>•• {c.number.replace(/\s/g, '').slice(-4)}</span>
              <i class="dot" style={{ background: colorOf(c.by), boxShadow: '0 0 0 2px rgba(255,255,255,.7)' }} />
            </div>
          </button>
        ))}
      </div>
      {view && <BarcodeView c={view} onClose={() => setView(null)} onEdit={() => (setEdit(view), setView(null))} />}
      {edit && <CardForm init={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function BarcodeView({ c, onClose, onEdit }: { c: LoyaltyCard; onClose: () => void; onEdit: () => void }) {
  const svg = useRef<SVGSVGElement>(null)
  const [qr, setQr] = useState('')
  const [awake, setAwake] = useState(false)

  useEffect(() => {
    if (c.format === 'QR') void qrSvg(c.number, 0).then(setQr)
    else if (svg.current) void renderBarcode(svg.current, c.number, c.format)
  }, [c.number, c.format])

  // Экран не гаснет, пока открыт штрихкод (Screen Wake Lock API). Яркость из браузера менять нельзя.
  useEffect(() => {
    type WL = { release: () => Promise<void> }
    let lock: WL | undefined
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WL> } }
    const req = () =>
      nav.wakeLock
        ?.request('screen')
        .then((l) => {
          lock = l
          setAwake(true)
        })
        .catch(() => setAwake(false))
    void req()
    const onVis = () => document.visibilityState === 'visible' && void req()
    document.addEventListener('visibilitychange', onVis)
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', '#ffffff')
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      void lock?.release().catch(() => undefined)
      meta?.setAttribute('content', '#0f1013')
    }
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(c.number)
      toast('Номер скопирован')
    } catch {
      toast(c.number)
    }
  }

  return (
    <div class="bc-view" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="top">
        <button class="done" onClick={onClose}>
          Готово
        </button>
        <span class="lock">{awake ? 'ЭКРАН НЕ ГАСНЕТ' : 'ЯРКОСТЬ ↑ ВРУЧНУЮ'}</span>
      </div>
      <h2>{c.name}</h2>
      <div class="meta">
        <i class="dot" style={{ background: colorOf(c.by), marginRight: 8, verticalAlign: '-1px' }} />
        {verb(c.by, 'добавил', 'добавила')} {nameOf(c.by)} · {formatLabel(c.format)}
      </div>
      <div class={`code ${c.format === 'QR' ? 'qr' : ''}`} onClick={onClose}>
        {c.format === 'QR' ? <div style={{ width: '72%', maxWidth: 320 }} dangerouslySetInnerHTML={{ __html: qr }} /> : <svg ref={svg} />}
      </div>
      <div class="digits">{groupNumber(c.number)}</div>
      {c.note && <p style={{ textAlign: 'center', color: '#6b6b70' }}>{c.note}</p>}
      <div class="bottom">
        <button onClick={copy}>Копировать</button>
        <button onClick={onEdit}>Изменить</button>
      </div>
    </div>
  )
}

function CardForm({ init, onClose }: { init: Partial<LoyaltyCard>; onClose: () => void }) {
  const [name, setName] = useState(init.name ?? '')
  const [number, setNumber] = useState(init.number ?? '')
  const [format, setFormat] = useState<BarcodeFormat>(init.format ?? 'EAN13')
  const [manualFormat, setManualFormat] = useState(!!init.id)
  const [color, setColor] = useState(init.color ?? CARD_COLORS[0])
  const [note, setNote] = useState(init.note ?? '')
  const [scan, setScan] = useState(false)

  const onNumber = (v: string) => {
    setNumber(v)
    if (!manualFormat && v.trim()) setFormat(detectFormat(v))
  }

  const save = () => {
    if (!name.trim()) return toast('Какой магазин?')
    const n = number.trim()
    if (!n) return toast('Нужен номер карты')
    store().put('cards', { id: init.id, name: name.trim(), number: format === 'QR' ? n : n.replace(/\s/g, ''), format, color, note: note.trim() || undefined })
    onClose()
  }
  const del = () => {
    if (!init.id || !confirm('Удалить карту?')) return
    store().remove('cards', init.id)
    onClose()
  }

  return (
    <>
      <Sheet title={init.id ? 'Карта' : 'Новая карта'} onClose={onClose}>
        <button class="btn ghost" onClick={() => setScan(true)} style={{ marginTop: 6 }}>
          <IScan size={20} /> Сканировать камерой
        </button>
        <Field label="Магазин">
          <input value={name} onInput={(e) => setName(e.currentTarget.value)} placeholder="Пятёрочка" />
        </Field>
        <Field label="Номер / содержимое кода">
          <input value={number} onInput={(e) => onNumber(e.currentTarget.value)} inputMode={format === 'QR' ? 'text' : 'numeric'} placeholder="4600 5170 …" style={{ fontFamily: 'var(--mono)' }} />
        </Field>
        <Field label="Формат" hint="Определяется сам по номеру. Если касса не читает — попробуй Code 128.">
          <select
            value={format}
            onChange={(e) => {
              setFormat(e.currentTarget.value as BarcodeFormat)
              setManualFormat(true)
            }}
          >
            {FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Цвет" group>
          <Swatches value={color} onChange={setColor} colors={CARD_COLORS} />
        </Field>
        <Field label="Заметка">
          <input value={note} onInput={(e) => setNote(e.currentTarget.value)} placeholder="Пин-код, телефон…" />
        </Field>
        <div class="btns">
          {init.id && (
            <button class="btn danger" onClick={del}>
              Удалить
            </button>
          )}
          <button class="btn" onClick={save}>
            Сохранить
          </button>
        </div>
      </Sheet>
      {scan && (
        <Scanner
          onClose={() => setScan(false)}
          onResult={(r) => {
            setScan(false)
            setNumber(r.text)
            setFormat(fromZxing(r.format))
            setManualFormat(true)
            toast('Код считан ✅')
          }}
        />
      )}
    </>
  )
}
