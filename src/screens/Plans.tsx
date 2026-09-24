import { useState } from 'preact/hooks'
import { fmtDay } from '../lib/dates'
import { CURRENCIES, fmtMoney, parseMoney, planMode, planStats, type PlanStats } from '../lib/money'
import { other, type Expense, type Plan, type PlanKind, type UserId } from '../lib/types'
import { colorOf, me, nameOf, store, todayStr, useList, users, verb } from '../state'
import { IPlus } from '../ui/icons'
import { Dot, Empty, Field, Seg, Sheet, Toggle, toast } from '../ui/kit'

export const PLAN_KINDS: [PlanKind, string][] = [
  ['trip', 'Поездка'],
  ['repair', 'Ремонт'],
  ['purchase', 'Покупка'],
  ['celebration', 'Праздник'],
  ['other', 'Другое'],
]
const kindLabel = (k: PlanKind) => PLAN_KINDS.find((x) => x[0] === k)?.[1] ?? ''

export function PlanList({ creating, onCreated }: { creating: boolean; onCreated: () => void }) {
  const plans = useList('plans')
  const expenses = useList('expenses')
  const [open, setOpen] = useState<string | null>(null)
  const [edit, setEdit] = useState<Partial<Plan> | null>(null)
  const [showArch, setShowArch] = useState(false)
  const active = plans.filter((p) => !p.archived).sort((a, b) => b.createdAt - a.createdAt)
  const arch = plans.filter((p) => p.archived)
  const plan = open ? store().get('plans', open) : undefined
  return (
    <>
      <div class="list" style={{ marginTop: 14 }}>
        {active.length === 0 && <Empty icon="🧳">Создайте копилку на поездку или покупку — или бюджет на ремонт. Взносы и траты каждого видны.</Empty>}
        {active.map((p) => (
          <PlanCard key={p.id} p={p} expenses={expenses} onClick={() => setOpen(p.id)} />
        ))}
      </div>
      {arch.length > 0 && (
        <>
          <div class="section-title">
            <button class="caps tap" onClick={() => setShowArch(!showArch)}>
              Архив · {arch.length} {showArch ? '▾' : '▸'}
            </button>
          </div>
          {showArch && (
            <div class="list" style={{ opacity: 0.65 }}>
              {arch.map((p) => (
                <PlanCard key={p.id} p={p} expenses={expenses} onClick={() => setOpen(p.id)} />
              ))}
            </div>
          )}
        </>
      )}
      {plan && <PlanDetail p={plan} onClose={() => setOpen(null)} onEdit={() => setEdit(plan)} />}
      {(edit || creating) && (
        <PlanForm
          init={edit ?? {}}
          onClose={(id) => {
            setEdit(null)
            onCreated()
            if (id === null) setOpen(null)
          }}
        />
      )}
    </>
  )
}

function Progress({ p, s }: { p: Plan; s: PlanStats }) {
  const main = s.main
  if (main > p.budget && p.budget > 0) {
    const inBudget = (p.budget / main) * 100
    const goal = s.mode === 'goal'
    return (
      <div class="prog">
        <i style={{ width: `${inBudget}%`, background: goal ? 'var(--green)' : 'var(--orange)' }} />
        <i style={{ flex: 1, background: goal ? '#1f6b34' : '#6b3016' }} />
      </div>
    )
  }
  const pct = p.budget > 0 ? Math.min(100, (main / p.budget) * 100) : 0
  return (
    <div class="prog">
      <i style={{ width: `${pct}%`, background: 'var(--green)' }} />
    </div>
  )
}

function PlanCard({ p, expenses, onClick }: { p: Plan; expenses: Expense[]; onClick: () => void }) {
  const s = planStats(p, expenses)
  const goal = s.mode === 'goal'
  return (
    <button class="plan tap" onClick={onClick}>
      <div class="row between">
        <span class="caps">
          {kindLabel(p.kind)}
          {goal ? ' · копилка' : ''}
        </span>
        <span class="row" style={{ gap: 8 }}>
          {s.over > 0 && (goal ? <span class="over" style={{ background: 'var(--green)' }}>цель ✓</span> : <span class="over">+{fmtMoney(s.over, p.currency)}</span>)}
          <Dot u={p.by} size={26} />
        </span>
      </div>
      <div class="t">{p.title}</div>
      <Progress p={p} s={s} />
      <div class="sum">
        <b style={!goal && s.over > 0 ? { color: 'var(--orange)' } : undefined}>{fmtMoney(s.main, p.currency)}</b>
        <span>из {fmtMoney(p.budget, p.currency)}</span>
      </div>
      {goal && s.spent > 0 && (
        <div class="mono muted" style={{ fontSize: 12.5, marginTop: 6 }}>
          потрачено {fmtMoney(s.spent, p.currency)} · в копилке {fmtMoney(s.balance, p.currency)}
        </div>
      )}
    </button>
  )
}

function PlanDetail({ p, onClose, onEdit }: { p: Plan; onClose: () => void; onEdit: () => void }) {
  const expenses = useList('expenses').filter((e) => e.planId === p.id)
  const u = users()
  const s = planStats(p, expenses)
  const goal = s.mode === 'goal'
  const [exp, setExp] = useState<Partial<Expense> | null>(null)
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  const per = goal ? s.savedBy : s.by
  const max = Math.max(per.a, per.b, 1)
  return (
    <Sheet
      title={p.title}
      onClose={onClose}
      right={
        <button class="x" onClick={onEdit} style={{ color: 'var(--a)', fontWeight: 600 }}>
          Изменить
        </button>
      }
    >
      <div class="caps">
        {kindLabel(p.kind)} · {goal ? 'копилка' : 'бюджет'}
      </div>
      <Progress p={p} s={s} />
      {goal ? (
        <div class="stats">
          <div>
            <span class="caps">Цель</span>
            <b>{fmtMoney(p.budget, p.currency)}</b>
          </div>
          <div>
            <span class="caps">Собрано</span>
            <b style={{ color: 'var(--green)' }}>{fmtMoney(s.saved, p.currency)}</b>
          </div>
          <div>
            <span class="caps">{s.remaining > 0 ? 'Осталось' : 'Сверх цели'}</span>
            <b>{fmtMoney(Math.abs(s.remaining), p.currency)}</b>
          </div>
        </div>
      ) : (
        <div class="stats">
          <div>
            <span class="caps">Бюджет</span>
            <b>{fmtMoney(p.budget, p.currency)}</b>
          </div>
          <div>
            <span class="caps">Потрачено</span>
            <b style={s.over ? { color: 'var(--orange)' } : undefined}>{fmtMoney(s.spent, p.currency)}</b>
          </div>
          <div>
            <span class="caps">{s.remaining < 0 ? 'Перерасход' : 'Остаток'}</span>
            <b style={{ color: s.remaining < 0 ? 'var(--orange)' : 'var(--green)' }}>{fmtMoney(Math.abs(s.remaining), p.currency)}</b>
          </div>
        </div>
      )}

      <div class="card">
        <div class="caps" style={{ marginBottom: 10 }}>
          {goal ? 'Кто сколько внёс' : 'Кто сколько потратил'}
        </div>
        {(['a', 'b'] as UserId[]).map((x) => (
          <div key={x} style={{ marginTop: 10 }}>
            <div class="row between" style={{ fontSize: 15 }}>
              <span class="row" style={{ gap: 8 }}>
                <Dot u={x} /> {u[x].name}
              </span>
              <span class="mono">{fmtMoney(per[x], p.currency)}</span>
            </div>
            <div class="prog" style={{ margin: '8px 0 0', height: 6 }}>
              <i style={{ width: `${(per[x] / max) * 100}%`, background: colorOf(x) }} />
            </div>
          </div>
        ))}
        <div class="muted" style={{ fontSize: 14, marginTop: 14, lineHeight: 1.45 }}>
          {goal ? (
            <>
              {s.saved === 0 ? 'Взносов пока нет.' : s.evenUp ? `Чтобы вклад был поровну, ${u[s.evenUp.who].name} докладывает ${fmtMoney(s.evenUp.amount, p.currency)}.` : 'Вложились поровну 👌'}
              {s.spent > 0 && (
                <>
                  <br />
                  Потрачено из копилки {fmtMoney(s.spent, p.currency)}, сейчас в ней {fmtMoney(s.balance, p.currency)}.
                </>
              )}
            </>
          ) : s.spent === 0 ? (
            'Трат пока нет.'
          ) : s.settle ? (
            `Чтобы вышло поровну: ${u[s.settle.from].name} → ${u[s.settle.to].name} ${fmtMoney(s.settle.amount, p.currency)}`
          ) : (
            'Потрачено поровну 👌'
          )}
          {!goal && s.saved > 0 && (
            <>
              <br />
              Отложено: {fmtMoney(s.saved, p.currency)} ({u.a.name} {fmtMoney(s.savedBy.a, p.currency)}, {u.b.name} {fmtMoney(s.savedBy.b, p.currency)})
            </>
          )}
        </div>
      </div>

      {p.note && (
        <p class="muted" style={{ whiteSpace: 'pre-wrap' }}>
          {p.note}
        </p>
      )}

      <div class="section-title">
        <span class="caps">Записи · {expenses.length}</span>
        <button class="link tap row" style={{ gap: 4 }} onClick={() => setExp({ kind: goal ? 'save' : 'spend' })}>
          <IPlus size={18} /> {goal ? 'Внести' : 'Добавить'}
        </button>
      </div>
      <div class="card" style={{ padding: '4px 14px' }}>
        {sorted.length === 0 && <div class="muted" style={{ padding: '14px 0' }}>{goal ? 'Внесите первый взнос — и копилка начнёт наполняться.' : 'Добавьте первую трату.'}</div>}
        {sorted.map((e) => (
          <button key={e.id} class="exp tap" onClick={() => setExp(e)}>
            <Dot u={e.paidBy} />
            <div style={{ minWidth: 0 }}>
              <div class="ellipsis">{e.note || (e.kind === 'save' ? (goal ? 'Взнос' : 'Отложили') : 'Трата')}</div>
              <div class="mono muted" style={{ fontSize: 12 }}>
                {fmtDay(e.date)} · {u[e.paidBy].name}
                {e.kind === 'save' ? (goal ? ' · взнос' : ' · отложено') : ' · трата'}
              </div>
            </div>
            <span class="amt" style={e.kind === 'save' ? { color: 'var(--green)' } : undefined}>
              {e.kind === 'save' ? '+' : '−'}
              {fmtMoney(e.amount, p.currency)}
            </span>
          </button>
        ))}
      </div>
      {exp && <ExpenseForm plan={p} init={exp} onClose={() => setExp(null)} />}
    </Sheet>
  )
}

function PlanForm({ init, onClose }: { init: Partial<Plan>; onClose: (id?: string | null) => void }) {
  const [title, setTitle] = useState(init.title ?? '')
  const [kind, setKind] = useState<PlanKind>(init.kind ?? 'trip')
  const [mode, setMode] = useState<'goal' | 'budget'>(init.id ? (init.mode ?? 'budget') : 'goal')
  const [budget, setBudget] = useState(init.budget !== undefined ? String(init.budget) : '')
  const [currency, setCurrency] = useState(init.currency ?? 'RUB')
  const [note, setNote] = useState(init.note ?? '')
  const [archived, setArchived] = useState(!!init.archived)
  const save = () => {
    if (!title.trim()) return toast('Как назовём план?')
    const b = parseMoney(budget)
    if (b === undefined || b < 0) return toast(mode === 'goal' ? 'Сколько собираем?' : 'Укажи бюджет')
    const rec = store().put('plans', {
      id: init.id,
      title: title.trim(),
      kind,
      mode,
      budget: b,
      currency,
      note: note.trim() || undefined,
      archived: archived || undefined,
      archivedAt: archived ? (init.archivedAt ?? Date.now()) : undefined,
    })
    if (!init.id) {
      const i = me()
      store().notify({ to: other(i), title: `${nameOf(i)} ${verb(i, 'создал', 'создала')} ${mode === 'goal' ? 'копилку' : 'план'}`, body: `${rec.title} · ${mode === 'goal' ? 'цель' : 'бюджет'} ${fmtMoney(b, currency)}`, url: '#plans' })
    }
    onClose(rec.id)
  }
  const del = () => {
    if (!init.id || !confirm('Удалить план со всеми записями?')) return
    for (const e of store().list('expenses')) if (e.planId === init.id) store().remove('expenses', e.id)
    store().remove('plans', init.id)
    onClose(null)
  }
  return (
    <Sheet title={init.id ? 'План' : 'Новый план'} onClose={() => onClose()}>
      <Field label="Название">
        <input value={title} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="Япония, октябрь" />
      </Field>
      <Field label="Как считаем" group hint={mode === 'goal' ? 'Складываетесь на цель: прогресс — сколько собрано. Траты тоже можно записывать.' : 'Есть лимит: прогресс — сколько потрачено, видно перерасход.'}>
        <Seg
          sm
          options={[
            ['goal', 'Копилка'],
            ['budget', 'Бюджет'],
          ]}
          value={mode}
          onChange={setMode}
        />
      </Field>
      <Field label="Что это">
        <select value={kind} onChange={(e) => setKind(e.currentTarget.value as PlanKind)}>
          {PLAN_KINDS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <div class="two">
        <Field label={mode === 'goal' ? 'Цель' : 'Бюджет'}>
          <input inputMode="decimal" value={budget} onInput={(e) => setBudget(e.currentTarget.value)} placeholder="5 000" />
        </Field>
        <Field label="Валюта">
          <select value={currency} onChange={(e) => setCurrency(e.currentTarget.value)} disabled={!!init.id && store().list('expenses').some((e) => e.planId === init.id)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.sym} {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Заметка">
        <textarea value={note} onInput={(e) => setNote(e.currentTarget.value)} placeholder={mode === 'goal' ? 'На что копим…' : 'Что входит в бюджет…'} />
      </Field>
      {init.id && <Toggle label="В архиве" value={archived} onChange={setArchived} />}
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

function ExpenseForm({ plan, init, onClose }: { plan: Plan; init: Partial<Expense>; onClose: () => void }) {
  const u = users()
  const goal = planMode(plan) === 'goal'
  const [kind, setKind] = useState<'spend' | 'save'>(init.kind ?? (goal ? 'save' : 'spend'))
  const [amount, setAmount] = useState(init.amount !== undefined ? String(init.amount) : '')
  const [note, setNote] = useState(init.note ?? '')
  const [paidBy, setPaidBy] = useState<UserId>(init.paidBy ?? me())
  const [date, setDate] = useState(init.date ?? todayStr())
  const save = () => {
    const a = parseMoney(amount)
    if (!a || a <= 0) return toast('Сколько?')
    store().put('expenses', { id: init.id, planId: plan.id, kind, amount: a, note: note.trim() || undefined, paidBy, date })
    if (!init.id) {
      const i = me()
      store().notify({
        to: other(i),
        title: `«${plan.title}»`,
        body: `${nameOf(i)}: ${kind === 'save' ? (goal ? 'взнос' : 'отложено') : 'трата'} ${fmtMoney(a, plan.currency)}${note.trim() ? ` — ${note.trim()}` : ''}`,
        tag: `exp:${plan.id}`,
        append: true,
        url: '#plans',
      })
    }
    onClose()
  }
  const del = () => {
    if (!init.id || !confirm('Удалить запись?')) return
    store().remove('expenses', init.id)
    onClose()
  }
  return (
    <Sheet title={init.id ? 'Запись' : 'Новая запись'} onClose={onClose}>
      <Seg
        options={
          goal
            ? [
                ['save', 'Взнос'],
                ['spend', 'Трата'],
              ]
            : [
                ['spend', 'Трата'],
                ['save', 'Отложили'],
              ]
        }
        value={kind}
        onChange={setKind}
      />
      <Field label={`Сумма, ${CURRENCIES.find((c) => c.code === plan.currency)?.sym ?? plan.currency}`}>
        <input inputMode="decimal" value={amount} onInput={(e) => setAmount(e.currentTarget.value)} placeholder="12 000" autoFocus={!init.id} style={{ fontFamily: 'var(--mono)', fontSize: 22 }} />
      </Field>
      <Field label="На что">
        <input value={note} onInput={(e) => setNote(e.currentTarget.value)} placeholder={kind === 'save' ? 'С зарплаты' : 'Билеты'} />
      </Field>
      <Field label={kind === 'save' ? (goal ? 'Кто внёс' : 'Кто отложил') : 'Кто платил'} group>
        <Seg
          sm
          options={[
            ['a', u.a.name],
            ['b', u.b.name],
          ]}
          value={paidBy}
          onChange={setPaidBy}
        />
      </Field>
      <Field label="Дата">
        <input type="date" value={date} onInput={(e) => setDate(e.currentTarget.value)} />
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
