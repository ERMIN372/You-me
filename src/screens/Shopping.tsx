import { useState } from 'preact/hooks'
import { other, type ShopItem } from '../lib/types'
import { colorOf, me, nameOf, store, useList, verb } from '../state'
import { ICheck, IPlus, IX } from '../ui/icons'
import { Empty } from '../ui/kit'

export function ShoppingList() {
  const items = useList('shopping')
  const [text, setText] = useState('')
  const todo = items.filter((x) => !x.done).sort((a, b) => b.createdAt - a.createdAt)
  const done = items.filter((x) => x.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))

  const add = (e?: Event) => {
    e?.preventDefault()
    const titles = text
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s[0].toUpperCase() + s.slice(1))
    if (!titles.length) return
    const i = me()
    for (const title of titles) store().put('shopping', { title, done: false })
    store().notify({
      to: other(i),
      title: `${nameOf(i)} ${verb(i, 'добавил', 'добавила')} в покупки`,
      body: titles.join(', '),
      tag: 'shop',
      append: true,
      url: '#shopping',
    })
    setText('')
  }

  const toggle = (x: ShopItem) => {
    const i = me()
    store().put('shopping', x.done ? { ...x, done: false, doneBy: undefined, doneAt: undefined } : { ...x, done: true, doneBy: i, doneAt: Date.now() })
  }

  const clearDone = () => {
    if (!confirm(`Убрать купленное (${done.length})?`)) return
    for (const x of done) store().remove('shopping', x.id)
  }

  return (
    <>
      <form class="add-bar" onSubmit={add} style={{ marginTop: 14 }}>
        <input class="input" value={text} onInput={(e) => setText(e.currentTarget.value)} placeholder="Молоко, хлеб, сыр…" enterKeyHint="done" />
        <button class="icon-btn" type="submit" aria-label="Добавить" style={{ width: 50, height: 50 }}>
          <IPlus />
        </button>
      </form>

      {todo.length === 0 && done.length === 0 && <Empty icon="🛒">Список пуст. Можно добавить сразу несколько через запятую.</Empty>}

      {todo.map((x) => (
        <Row key={x.id} x={x} onToggle={() => toggle(x)} />
      ))}

      {done.length > 0 && (
        <>
          <div class="section-title">
            <span class="caps">Куплено · {done.length}</span>
            <button class="link tap" onClick={clearDone} style={{ fontSize: 15 }}>
              Очистить
            </button>
          </div>
          {done.map((x) => (
            <Row key={x.id} x={x} onToggle={() => toggle(x)} />
          ))}
        </>
      )}
    </>
  )
}

function Row({ x, onToggle }: { x: ShopItem; onToggle: () => void }) {
  const c = colorOf(x.done && x.doneBy ? x.doneBy : x.by)
  return (
    <div class={`shop ${x.done ? 'done' : ''}`}>
      <button class="check tap" style={{ borderColor: c, background: x.done ? c : 'transparent', color: '#111' }} onClick={onToggle} aria-label={x.done ? 'Вернуть' : 'Куплено'}>
        {x.done && <ICheck size={16} />}
      </button>
      <button class="grow tap" style={{ textAlign: 'left' }} onClick={onToggle}>
        <div class="t">{x.title}</div>
        <div class="by">{x.done && x.doneBy ? `${verb(x.doneBy, 'купил', 'купила')} ${nameOf(x.doneBy)}` : `${verb(x.by, 'добавил', 'добавила')} ${nameOf(x.by)}`}</div>
      </button>
      <button class="tap muted" onClick={() => store().remove('shopping', x.id)} aria-label="Удалить" style={{ padding: 6 }}>
        <IX size={18} />
      </button>
    </div>
  )
}
