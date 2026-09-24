import { useState } from 'preact/hooks'
import { agoDay } from '../lib/dates'
import { other, type Vote } from '../lib/types'
import { voteView } from '../lib/us'
import { colorOf, genOf, me, nameOf, store, todayStr, useList, users, verb } from '../state'
import { IChevL, ILock, IPlus, IX } from '../ui/icons'
import { Empty, Field, Glow, Sheet, toast } from '../ui/kit'

const TEMPLATES: [string, string[]][] = [
  ['Да / Нет', ['Да', 'Нет']],
  ['Шкала 1–5', ['1', '2', '3', '4', '5']],
  ['Своё', ['', '']],
]

export function VotesScreen({ onBack }: { onBack: () => void }) {
  const votes = useList('votes')
  const ballots = useList('ballots')
  const i = me()
  const t = todayStr()
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const views = votes.map((v) => ({ v, x: voteView(v, ballots, i) })).sort((a, b) => b.v.createdAt - a.v.createdAt)
  const waiting = views.filter(({ x }) => !x.mine)
  const pending = views.filter(({ x }) => x.mine && !x.theirs)
  const done = views.filter(({ x }) => x.done)
  const openVote = open ? store().get('votes', open) : undefined

  const Item = ({ v, sub, accent }: { v: Vote; sub: string; accent?: string }) => (
    <button class="row-link accent tap" style={{ borderLeftColor: accent ?? 'transparent' }} onClick={() => setOpen(v.id)}>
      <div class="grow">
        <div class="t">{v.question}</div>
        <div class="s">{sub}</div>
      </div>
    </button>
  )

  return (
    <div class="screen">
      <Glow color="rgba(40, 70, 140, 0.4)" />
      <div class="row between">
        <button class="back tap" onClick={onBack}>
          <IChevL size={20} /> Мы
        </button>
        <button class="link tap" style={{ color: 'var(--a)', fontWeight: 650, fontSize: 17, marginTop: 8 }} onClick={() => setCreating(true)}>
          Спросить
        </button>
      </div>
      <div class="head" style={{ marginTop: 8 }}>
        <div>
          <div class="caps">тайные голосования</div>
          <h1>Голосуем</h1>
        </div>
      </div>
      <p class="muted" style={{ marginTop: -6, fontSize: 14, lineHeight: 1.45 }}>
        Спорный вопрос — голосуете оба. Голос партнёра не виден, пока не проголосуешь сам: выбор остаётся своим.
      </p>

      {views.length === 0 && <Empty icon="🗳️">Задай первый вопрос: «Куда едем в отпуск?», «Заводим кота?»</Empty>}

      {waiting.length > 0 && (
        <>
          <div class="section-title">
            <span class="caps">Ждут твоего голоса · {waiting.length}</span>
          </div>
          <div class="list">
            {waiting.map(({ v, x }) => (
              <Item key={v.id} v={v} accent={colorOf(v.by)} sub={x.theirs ? `🔒 ${nameOf(other(i))} уже ${verb(other(i), 'проголосовал', 'проголосовала')}` : `${v.by === i ? `ты ${verb(i, 'спросил', 'спросила')}` : `${verb(v.by, 'спросил', 'спросила')} ${nameOf(v.by)}`} · ${agoDay(v.createdAt, t)}`} />
            ))}
          </div>
        </>
      )}
      {pending.length > 0 && (
        <>
          <div class="section-title">
            <span class="caps">Ждём ответа {genOf(other(i))}</span>
          </div>
          <div class="list">
            {pending.map(({ v, x }) => (
              <Item key={v.id} v={v} sub={`твой голос: ${v.options[x.mine!.choice]}`} />
            ))}
          </div>
        </>
      )}
      {done.length > 0 && (
        <>
          <div class="section-title">
            <span class="caps">Итоги</span>
          </div>
          <div class="list">
            {done.map(({ v, x }) => (
              <Item key={v.id} v={v} sub={x.match ? `🎉 совпало: ${v.options[x.mine!.choice]}` : `разошлись: ${v.options[x.mine!.choice]} vs ${v.options[x.theirs!.choice]}`} />
            ))}
          </div>
        </>
      )}

      {openVote && <VoteSheet v={openVote} onClose={() => setOpen(null)} />}
      {creating && <VoteForm onClose={() => setCreating(false)} />}
    </div>
  )
}

function VoteSheet({ v, onClose }: { v: Vote; onClose: () => void }) {
  const ballots = useList('ballots')
  const i = me()
  const p = other(i)
  const u = users()
  const x = voteView(v, ballots, i)
  const [pick, setPick] = useState<number | null>(x.mine?.choice ?? null)
  const [comment, setComment] = useState(x.mine?.comment ?? '')
  const [changing, setChanging] = useState(false)
  const canVote = !x.mine || (changing && !x.theirs)
  const scale = v.options.length === 5 && v.options.every((o, k) => o === String(k + 1))

  const send = () => {
    if (pick === null) return toast('Выбери вариант')
    const first = !x.mine
    store().put('ballots', { id: `${v.id}:${i}`, voteId: v.id, user: i, choice: pick, comment: comment.trim() || undefined })
    setChanging(false)
    if (first) {
      store().notify({
        to: p,
        title: x.theirs ? 'Итоги голосования открыты 🗳️' : 'Тайное голосование',
        body: x.theirs ? `«${v.question}» — смотри, совпало ли` : `${nameOf(i)} ${verb(i, 'проголосовал', 'проголосовала')}: «${v.question}». Твоя очередь`,
        tag: `vote:${v.id}`,
        url: '#votes',
      })
    }
  }
  const del = () => {
    if (!confirm('Удалить голосование?')) return
    store().remove('votes', v.id)
    for (const b of ballots) if (b.voteId === v.id) store().remove('ballots', b.id)
    onClose()
  }

  return (
    <Sheet title="" onClose={onClose}>
      <div class="caps">
        {v.by === i ? `ты ${verb(i, 'спросил', 'спросила')}` : `${verb(v.by, 'спросил', 'спросила')} ${nameOf(v.by)}`}
      </div>
      <h2 style={{ fontSize: 25, margin: '8px 0 16px', lineHeight: 1.2 }}>{v.question}</h2>

      <div style={scale ? { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 } : undefined}>
        {v.options.map((o, k) => {
          const mineHere = (canVote ? pick : x.mine?.choice) === k
          const theirsHere = x.reveal && !changing && x.theirs?.choice === k
          return (
            <button
              key={k}
              class="toggle tap"
              disabled={!canVote}
              onClick={() => setPick(k)}
              style={{
                width: '100%',
                marginTop: scale ? 0 : 10,
                justifyContent: scale ? 'center' : 'space-between',
                fontSize: scale ? 22 : 17,
                fontWeight: 600,
                fontFamily: scale ? 'var(--mono)' : undefined,
                boxShadow: mineHere ? `inset 0 0 0 2px ${colorOf(i)}` : theirsHere ? `inset 0 0 0 2px ${colorOf(p)}` : undefined,
                opacity: 1,
              }}
            >
              <span>{o}</span>
              {!scale && (
                <span class="row" style={{ gap: 4 }}>
                  {mineHere && <i class="dot" style={{ background: colorOf(i) }} />}
                  {theirsHere && <i class="dot" style={{ background: colorOf(p) }} />}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {scale && x.done && !changing && (
        <div class="row" style={{ justifyContent: 'center', gap: 16, marginTop: 10, fontSize: 14 }}>
          <span class="row" style={{ gap: 6 }}>
            <i class="dot" style={{ background: colorOf(i) }} /> ты: {v.options[x.mine!.choice]}
          </span>
          <span class="row" style={{ gap: 6 }}>
            <i class="dot" style={{ background: colorOf(p) }} /> {u[p].name}: {v.options[x.theirs!.choice]}
          </span>
        </div>
      )}

      {canVote ? (
        <>
          <Field label="Комментарий (необязательно)">
            <input value={comment} onInput={(e) => setComment(e.currentTarget.value)} placeholder="Почему так" />
          </Field>
          <div class="btns">
            <button class="btn" onClick={send}>
              {x.mine ? 'Сохранить голос' : 'Проголосовать'}
            </button>
          </div>
          {!x.mine && (
            <p class="muted" style={{ fontSize: 13, textAlign: 'center' }}>
              {x.theirs ? `🔒 ${u[p].name} уже ${verb(p, 'проголосовал', 'проголосовала')} — увидишь после своего голоса` : `Голос ${genOf(p)} откроется, когда проголосуете оба`}
            </p>
          )}
        </>
      ) : x.done ? (
        <div class="stack" style={{ marginTop: 16 }}>
          <div class="card" style={{ textAlign: 'center', fontSize: 18, fontWeight: 650 }}>
            {x.match ? '🎉 Совпало!' : '🤝 Мнения разошлись — время договориться'}
          </div>
          {[x.mine!, x.theirs!]
            .filter((b) => b.comment)
            .map((b) => (
              <div key={b.id} class="answer" style={{ borderColor: colorOf(b.user) }}>
                <div class="who" style={{ color: colorOf(b.user) }}>
                  {nameOf(b.user)}
                </div>
                {b.comment}
              </div>
            ))}
        </div>
      ) : (
        <>
          <div class="locked" style={{ marginTop: 16 }}>
            <ILock size={22} />
            <span>Ждём голоса {genOf(p)}. Откроется, когда проголосуете оба.</span>
          </div>
          <button class="btn ghost" style={{ marginTop: 10 }} onClick={() => setChanging(true)}>
            {verb(i, 'Передумал', 'Передумала')} — изменить голос
          </button>
        </>
      )}

      {v.by === i && (
        <button class="btn danger" style={{ marginTop: 18 }} onClick={del}>
          Удалить голосование
        </button>
      )}
    </Sheet>
  )
}

function VoteForm({ onClose }: { onClose: () => void }) {
  const i = me()
  const [question, setQuestion] = useState('')
  const [tpl, setTpl] = useState(2)
  const [options, setOptions] = useState<string[]>(['', ''])

  const choose = (k: number) => {
    setTpl(k)
    setOptions([...TEMPLATES[k][1]])
  }
  const save = () => {
    if (!question.trim()) return toast('О чём голосуем?')
    const opts = options.map((o) => o.trim()).filter(Boolean)
    if (opts.length < 2) return toast('Нужно хотя бы два варианта')
    if (new Set(opts).size !== opts.length) return toast('Варианты повторяются')
    const rec = store().put('votes', { question: question.trim(), options: opts })
    store().notify({ to: other(i), title: 'Тайное голосование 🗳️', body: `${nameOf(i)} спрашивает: «${rec.question}»`, tag: `vote:${rec.id}`, url: '#votes' })
    onClose()
  }

  return (
    <Sheet title="Новое голосование" onClose={onClose}>
      <Field label="Вопрос">
        <input value={question} onInput={(e) => setQuestion(e.currentTarget.value)} placeholder="Куда летим на майские?" autoFocus />
      </Field>
      <Field label="Шаблон" group>
        <div class="presets">
          {TEMPLATES.map(([label], k) => (
            <button type="button" key={label} onClick={() => choose(k)} style={k === tpl ? { color: 'var(--text)', boxShadow: 'inset 0 0 0 1.5px var(--text)' } : undefined}>
              {label}
            </button>
          ))}
        </div>
      </Field>
      <Field label={`Варианты · ${options.length}`} group>
        {options.map((o, k) => (
          <div key={k} class="row" style={{ gap: 8, marginTop: k ? 8 : 0 }}>
            <input
              class="input"
              value={o}
              onInput={(e) => {
                const next = [...options]
                next[k] = e.currentTarget.value
                setOptions(next)
              }}
              placeholder={`Вариант ${k + 1}`}
            />
            {options.length > 2 && (
              <button type="button" class="icon-btn sm" onClick={() => setOptions(options.filter((_, j) => j !== k))} aria-label="Убрать">
                <IX size={16} />
              </button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <button type="button" class="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setOptions([...options, ''])}>
            <IPlus size={16} /> Вариант
          </button>
        )}
      </Field>
      <div class="btns">
        <button class="btn" onClick={save}>
          Спросить
        </button>
      </div>
    </Sheet>
  )
}
