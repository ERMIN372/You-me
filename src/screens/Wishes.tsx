import { useState } from 'preact/hooks'
import { compressImage } from '../lib/image'
import { CURRENCIES, fmtMoney, parseMoney } from '../lib/money'
import { fetchImageViaWorker, fetchPreview } from '../lib/preview'
import { other, type UserId, type Wish } from '../lib/types'
import { colorOf, me, nameOf, store, useList, users, verb, workerCfg } from '../state'
import { ILink } from '../ui/icons'
import { Empty, Field, Img, PhotoPicker, saveImage, Seg, Sheet, toast } from '../ui/kit'

export const PRIORITY: Record<number, string> = { 0: 'было бы неплохо', 1: 'хочу', 2: 'очень хочу' }

type Filter = UserId | 'all'

export function WishList({ creating, onCreated }: { creating: boolean; onCreated: () => void }) {
  const wishes = useList('wishes')
  const reservations = useList('reservations')
  const i = me()
  const partner = other(i)
  const u = users()
  const [filter, setFilter] = useState<Filter>(partner)
  const [open, setOpen] = useState<Wish | null>(null)
  const [edit, setEdit] = useState<Partial<Wish> | null>(null)
  const [showGifted, setShowGifted] = useState(false)

  const reserved = new Set(reservations.map((r) => r.wishId))
  const active = wishes.filter((w) => !w.gifted)
  const count = (x: UserId) => active.filter((w) => w.owner === x).length
  const shown = active
    .filter((w) => filter === 'all' || w.owner === filter)
    .sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt)
  const gifted = wishes.filter((w) => w.gifted && (filter === 'all' || w.owner === filter)).sort((a, b) => b.updatedAt - a.updatedAt)

  const chip = (f: Filter, label: string) => (
    <button class={`chip ${filter === f ? 'on' : ''}`} style={filter === f ? { background: f === 'all' ? 'var(--text)' : colorOf(f) } : undefined} onClick={() => setFilter(f)}>
      {label}
    </button>
  )

  return (
    <>
      <div class="chips">
        {chip(partner, `${u[partner].name} · ${count(partner)}`)}
        {chip(i, `${u[i].name} · ${count(i)}`)}
        {chip('all', 'Всё')}
      </div>
      <div class="list">
        {shown.length === 0 && (
          <Empty icon="🎁">
            {filter === i ? 'Добавь то, что хочешь получить — ссылку, цену, фото.' : filter === partner ? `${u[partner].name} пока ничего не добавил(а).` : 'Пока пусто.'}
          </Empty>
        )}
        {shown.map((w) => (
          <WishCard key={w.id} w={w} reservedByMe={w.owner !== i && reserved.has(w.id)} onClick={() => setOpen(w)} />
        ))}
      </div>
      {gifted.length > 0 && (
        <>
          <div class="section-title">
            <button class="caps tap" onClick={() => setShowGifted(!showGifted)}>
              Подарено · {gifted.length} {showGifted ? '▾' : '▸'}
            </button>
          </div>
          {showGifted && (
            <div class="list" style={{ opacity: 0.6 }}>
              {gifted.map((w) => (
                <WishCard key={w.id} w={w} reservedByMe={false} onClick={() => setOpen(w)} />
              ))}
            </div>
          )}
        </>
      )}
      {open && <WishDetail w={open} onClose={() => setOpen(null)} onEdit={() => (setEdit(open), setOpen(null))} />}
      {(edit || creating) && (
        <WishForm
          init={edit ?? {}}
          onClose={() => {
            setEdit(null)
            onCreated()
          }}
        />
      )}
    </>
  )
}

function WishCard({ w, reservedByMe, onClick }: { w: Wish; reservedByMe: boolean; onClick: () => void }) {
  return (
    <button class="wish tap" onClick={onClick}>
      <div class="thumb">
        <Img path={w.photo} placeholder="фото товара" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div class="t">{w.title}</div>
        {w.price !== undefined && <div class="p">{fmtMoney(w.price, w.currency)}</div>}
        <div class="tags">
          {w.priority === 2 && <span class="pill">очень хочу</span>}
          {reservedByMe && (
            <span class="pill solid" style={{ color: 'var(--green)' }}>
              🎁 даришь ты
            </span>
          )}
          {w.gifted && <span class="pill">подарено</span>}
        </div>
      </div>
    </button>
  )
}

function WishDetail({ w, onClose, onEdit }: { w: Wish; onClose: () => void; onEdit: () => void }) {
  useList('reservations')
  const i = me()
  const mine = w.owner === i
  const res = store().get('reservations', w.id)
  const toggleReserve = () => {
    if (res) store().remove('reservations', w.id)
    else {
      store().put('reservations', { id: w.id, wishId: w.id })
      toast('Забронировано. Владелец хотелки этого не увидит 🤫')
    }
  }
  const toggleGifted = () => {
    store().put('wishes', { ...w, gifted: !w.gifted })
    if (!w.gifted) toast('Ура! Хотелка в архиве')
    onClose()
  }
  return (
    <Sheet title="" onClose={onClose}>
      {w.photo && (
        <div class="photo-big thumb">
          <Img path={w.photo} />
        </div>
      )}
      <div class="caps">
        <i class="dot" style={{ background: colorOf(w.owner), marginRight: 8, verticalAlign: 'middle' }} />
        хочет {nameOf(w.owner)} · {PRIORITY[w.priority]}
      </div>
      <h2 style={{ fontSize: 26, margin: '8px 0 4px', lineHeight: 1.15 }}>{w.title}</h2>
      {w.price !== undefined && (
        <div class="mono" style={{ fontSize: 22, fontWeight: 600 }}>
          {fmtMoney(w.price, w.currency)}
        </div>
      )}
      {w.note && <p style={{ whiteSpace: 'pre-wrap', color: 'var(--muted)' }}>{w.note}</p>}
      {w.url && (
        <a class="btn ghost" href={w.url} target="_blank" rel="noopener noreferrer" style={{ marginTop: 16 }}>
          <ILink size={18} /> Открыть ссылку
        </a>
      )}
      {!mine && !w.gifted && (
        <button class="btn" style={{ marginTop: 10, background: res ? 'var(--card-2)' : 'var(--green)', color: res ? 'var(--text)' : '#08140b' }} onClick={toggleReserve}>
          {res ? 'Снять бронь' : '🎁 Я подарю'}
        </button>
      )}
      {!mine && res && <p class="muted" style={{ fontSize: 13, textAlign: 'center' }}>Бронь видишь только ты</p>}
      {mine && (
        <div class="btns">
          <button class="btn ghost" onClick={onEdit}>
            Изменить
          </button>
          <button class="btn ghost" onClick={toggleGifted}>
            {w.gifted ? 'Вернуть в список' : `${verb(i, 'Получил', 'Получила')} 🎉`}
          </button>
        </div>
      )}
    </Sheet>
  )
}

function WishForm({ init, onClose }: { init: Partial<Wish>; onClose: () => void }) {
  const [url, setUrl] = useState(init.url ?? '')
  const [title, setTitle] = useState(init.title ?? '')
  const [price, setPrice] = useState(init.price !== undefined ? String(init.price) : '')
  const [currency, setCurrency] = useState(init.currency ?? 'RUB')
  const [photo, setPhoto] = useState(init.photo)
  const [priority, setPriority] = useState<0 | 1 | 2>(init.priority ?? 1)
  const [note, setNote] = useState(init.note ?? '')
  const [loading, setLoading] = useState(false)
  const hasWorker = !!workerCfg()?.url

  const pull = async () => {
    if (!/^https?:\/\//.test(url.trim())) return toast('Вставь ссылку целиком, с https://')
    setLoading(true)
    try {
      const p = await fetchPreview(url.trim())
      if (p.title && !title) setTitle(p.title)
      if (p.price !== undefined && !price) setPrice(String(p.price))
      if (p.currency && CURRENCIES.some((c) => c.code === p.currency)) setCurrency(p.currency)
      if (p.image && !photo) {
        try {
          const blob = await compressImage(await fetchImageViaWorker(p.image))
          setPhoto(await saveImage(blob))
        } catch {
          /* без картинки */
        }
      }
      if (!p.title && p.price === undefined) toast('Сайт не отдал данные — заполни вручную')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не получилось')
    } finally {
      setLoading(false)
    }
  }

  const save = () => {
    if (!title.trim()) return toast('Что хочется?')
    const i = me()
    const rec = store().put('wishes', {
      id: init.id,
      title: title.trim(),
      owner: init.owner ?? i,
      url: url.trim() || undefined,
      price: parseMoney(price),
      currency,
      photo,
      priority,
      note: note.trim() || undefined,
      gifted: init.gifted,
    })
    if (!init.id) {
      store().notify({
        to: other(i),
        title: `${nameOf(i)} ${verb(i, 'добавил', 'добавила')} хотелку`,
        body: [rec.title, rec.price !== undefined ? fmtMoney(rec.price, rec.currency) : ''].filter(Boolean).join(' · '),
        tag: `wish:${rec.id}`,
        url: '#wishes',
      })
    }
    onClose()
  }
  const del = () => {
    if (!init.id || !confirm('Удалить хотелку?')) return
    store().remove('wishes', init.id)
    store().remove('reservations', init.id)
    onClose()
  }

  return (
    <Sheet title={init.id ? 'Хотелка' : 'Новая хотелка'} onClose={onClose}>
      <Field label="Ссылка" hint={hasWorker ? 'Нажми «Подтянуть» — заполним название, цену и фото' : undefined} group>
        <div class="row" style={{ gap: 8 }}>
          <input class="input" type="url" inputMode="url" value={url} onInput={(e) => setUrl(e.currentTarget.value)} placeholder="https://…" />
          {hasWorker && (
            <button type="button" class="btn ghost sm" onClick={pull} disabled={loading || !url}>
              {loading ? '…' : 'Подтянуть'}
            </button>
          )}
        </div>
      </Field>
      <Field label="Что">
        <input value={title} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="Ваза Fern Studio" />
      </Field>
      <div class="two">
        <Field label="Цена">
          <input inputMode="decimal" value={price} onInput={(e) => setPrice(e.currentTarget.value)} placeholder="7 400" />
        </Field>
        <Field label="Валюта">
          <select value={currency} onChange={(e) => setCurrency(e.currentTarget.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.sym} {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Фото" group>
        <PhotoPicker value={photo} onChange={setPhoto} />
      </Field>
      <Field label="Насколько хочется" group>
        <Seg
          sm
          options={[
            ['0', 'неплохо бы'],
            ['1', 'хочу'],
            ['2', 'очень хочу'],
          ]}
          value={String(priority) as '0' | '1' | '2'}
          onChange={(v) => setPriority(Number(v) as 0 | 1 | 2)}
        />
      </Field>
      <Field label="Заметка">
        <textarea value={note} onInput={(e) => setNote(e.currentTarget.value)} placeholder="Размер, цвет, где продаётся…" />
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
  )
}
