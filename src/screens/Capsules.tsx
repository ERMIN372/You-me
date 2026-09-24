import { useEffect, useState } from 'preact/hooks'
import { addDays, dateOf, days, diffDays, fmtDay, onYear, parts } from '../lib/dates'
import { other, type Capsule, type UserId } from '../lib/types'
import { capsuleState, readState, readers, together } from '../lib/us'
import { colorOf, genOf, me, meta, nameOf, store, todayStr, useList, users } from '../state'
import { IChevL, ILockClock, IMail, IMailOpen } from '../ui/icons'
import { Field, Glow, Img, PhotoPicker, Seg, Sheet, toast } from '../ui/kit'

export function CapsulesScreen({ onBack }: { onBack: () => void }) {
  const capsules = useList('capsules')
  const reads = useList('reads')
  const i = me()
  const t = todayStr()
  const [edit, setEdit] = useState<Partial<Capsule> | null>(null)
  const [read, setRead] = useState<Capsule | null>(null)

  const visible = capsules.filter((c) => c.by === i || readers(c).includes(i))
  const locked = visible.filter((c) => capsuleState(c, i, t) === 'locked').sort((a, b) => a.openAt.localeCompare(b.openAt))
  const mine = visible.filter((c) => capsuleState(c, i, t) === 'mine').sort((a, b) => a.openAt.localeCompare(b.openAt))
  const opened = visible.filter((c) => capsuleState(c, i, t) === 'open').sort((a, b) => b.openAt.localeCompare(a.openAt))

  return (
    <div class="screen">
      <Glow color="rgba(70, 50, 150, 0.4)" />
      <div class="row between">
        <button class="back tap" onClick={onBack}>
          <IChevL size={20} /> Мы
        </button>
        <button class="link tap" style={{ color: 'var(--a)', fontWeight: 650, fontSize: 17, marginTop: 8 }} onClick={() => setEdit({})}>
          Написать
        </button>
      </div>
      <div class="head" style={{ marginTop: 8 }}>
        <h1>Капсулы</h1>
      </div>

      {locked.map((c) => (
        <button key={c.id} class="cap hero tap" onClick={() => toast(`Откроется ${fmtDay(c.openAt, true)} — потерпи 🙂`)} style={{ marginBottom: 12 }}>
          <IMail size={34} />
          <span class="badge">{c.to === 'both' ? 'ВАМ' : 'ТЕБЕ'}</span>
          <div class="t">Тебя ждёт письмо от {genOf(c.by)}</div>
          <div class="s">
            откроется {fmtDay(c.openAt)} · через {days(diffDays(t, c.openAt))}
          </div>
        </button>
      ))}

      {mine.map((c) => (
        <button key={c.id} class="cap tap" onClick={() => setEdit(c)}>
          <span class="ico">
            <ILockClock size={26} />
          </span>
          <div class="grow">
            <div class="t">{c.title}</div>
            <div class="s">
              откроется {fmtDay(c.openAt)} · {c.to === 'both' ? 'вам обоим' : `для ${genOf(c.to)}`} · ваше, можно править
            </div>
          </div>
          <i class="edge" style={{ background: colorOf(i) }} />
        </button>
      ))}

      {opened.map((c) => {
        const r = readState(c, reads)
        const unread = !r.readBy.includes(i) && c.by !== i
        return (
          <button key={c.id} class="cap tap" onClick={() => setRead(c)} style={unread ? { boxShadow: `inset 0 0 0 2px ${colorOf(c.by)}` } : undefined}>
            <span class="ico" style={unread ? { color: colorOf(c.by) } : undefined}>
              {unread ? <IMail size={26} /> : <IMailOpen size={26} />}
            </span>
            <div class="grow">
              <div class="t">«{c.title}»</div>
              <div class="s">
                открыто {fmtDay(c.openAt)} · {r.all ? (readers(c).length > 1 ? 'прочитано обоими' : 'прочитано') : unread ? 'новое!' : `не прочитано: ${readers(c).filter((u) => !r.readBy.includes(u)).map(nameOf).join(', ')}`}
              </div>
            </div>
          </button>
        )
      })}

      <button class="cap add tap" style={{ marginTop: 12 }} onClick={() => setEdit({})}>
        + Написать письмо в будущее
      </button>
      <p class="muted" style={{ fontSize: 13, textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
        Пишете сегодня — читаете вместе потом. До даты открытия письмо видит только автор.
      </p>

      {edit && <CapsuleForm init={edit} onClose={() => setEdit(null)} />}
      {read && <CapsuleRead c={read} onClose={() => setRead(null)} />}
    </div>
  )
}

function CapsuleRead({ c, onClose }: { c: Capsule; onClose: () => void }) {
  const i = me()
  useEffect(() => {
    if (readers(c).includes(i) && !store().get('reads', `${c.id}:${i}`)) store().put('reads', { id: `${c.id}:${i}`, capsuleId: c.id, user: i })
  }, [c.id])
  return (
    <Sheet title="" onClose={onClose}>
      <div class="caps" style={{ color: colorOf(c.by) }}>
        {c.by === i ? 'твоё письмо' : `от ${genOf(c.by)}`} · написано {fmtDay(dateOf(c.createdAt), true)}
      </div>
      <h2 style={{ fontSize: 26, margin: '8px 0 14px', lineHeight: 1.15 }}>{c.title}</h2>
      {c.photo && (
        <div class="photo-big thumb">
          <Img path={c.photo} />
        </div>
      )}
      <div class="letter">{c.text}</div>
    </Sheet>
  )
}

function CapsuleForm({ init, onClose }: { init: Partial<Capsule>; onClose: () => void }) {
  const i = me()
  const p = other(i)
  const u = users()
  const t = todayStr()
  const [title, setTitle] = useState(init.title ?? '')
  const [text, setText] = useState(init.text ?? '')
  const [openAt, setOpenAt] = useState(init.openAt ?? addDays(t, 365))
  const [to, setTo] = useState<UserId | 'both'>(init.to ?? p)
  const [photo, setPhoto] = useState(init.photo)

  const y = parts(t).y
  const tg = meta()?.together ? together(meta()!.together!, t) : null
  const presets: [string, string][] = [
    ...(tg ? [['На годовщину', tg.inDays > 0 ? tg.next : addDays(tg.next, 365)] as [string, string]] : []),
    ['14 февраля', diffDays(t, `${y}-02-14`) > 0 ? `${y}-02-14` : `${y + 1}-02-14`],
    ['Новый год', `${y + 1}-01-01`],
    ['Через год', addDays(t, 365)],
    ['Через 5 лет', onYear(parts(t).m, parts(t).d, y + 5)],
  ]

  const save = () => {
    if (!title.trim()) return toast('Назови письмо')
    if (!text.trim()) return toast('Напиши хоть пару строк')
    if (diffDays(t, openAt) < 1) return toast('Дата открытия — хотя бы завтра')
    const rec = store().put('capsules', { id: init.id, title: title.trim(), text: text.trim(), openAt, to, photo })
    if (!init.id) {
      store().notify({
        to: to === 'both' ? p : to,
        title: 'Тебя ждёт письмо 💌',
        body: `От ${genOf(i)} — откроется ${fmtDay(rec.openAt, true)}`,
        tag: `cap:${rec.id}`,
        url: '#capsules',
      })
    }
    onClose()
  }
  const del = () => {
    if (!init.id || !confirm('Удалить письмо?')) return
    store().remove('capsules', init.id)
    onClose()
  }

  return (
    <Sheet title={init.id ? 'Письмо' : 'Письмо в будущее'} onClose={onClose}>
      <Field label="Название">
        <input value={title} onInput={(e) => setTitle(e.currentTarget.value)} placeholder={`${u[p].name} — на годовщину`} autoFocus={!init.id} />
      </Field>
      <Field label="Кому" group>
        <Seg
          sm
          options={[
            [p, u[p].name],
            ['both', 'Нам обоим'],
          ]}
          value={to}
          onChange={setTo}
        />
      </Field>
      <Field label="Письмо">
        <textarea value={text} onInput={(e) => setText(e.currentTarget.value)} style={{ minHeight: 200 }} placeholder="Привет из прошлого…" />
      </Field>
      <Field label="Когда открыть" group>
        <input class="input" type="date" value={openAt} min={addDays(t, 1)} onInput={(e) => setOpenAt(e.currentTarget.value)} />
        <div class="presets">
          {presets.map(([label, d]) => (
            <button type="button" key={label} onClick={() => setOpenAt(d)} style={d === openAt ? { color: 'var(--text)', boxShadow: 'inset 0 0 0 1.5px var(--text)' } : undefined}>
              {label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Фото (необязательно)" group>
        <PhotoPicker value={photo} onChange={setPhoto} />
      </Field>
      <p class="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>
        До {fmtDay(openAt, true)} {to === 'both' ? `${u[p].name} увидит` : 'адресат увидит'} только «Тебя ждёт письмо от {genOf(i)}». Ты можешь править, пока не открылось.
      </p>
      <div class="btns">
        {init.id && (
          <button class="btn danger" onClick={del}>
            Удалить
          </button>
        )}
        <button class="btn" onClick={save}>
          {init.id ? 'Сохранить' : 'Запечатать'}
        </button>
      </div>
    </Sheet>
  )
}
