import { useState } from 'preact/hooks'
import { fmtDay } from '../lib/dates'
import { CURRENCIES, fmtMoney, parseMoney, planStats } from '../lib/money'
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
        {active.length === 0 && <Empty icon="🧳">Создайте план — поездку, ремонт или большую покупку. Бюджет общий, траты каждого видны.</Empty>}
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

function Progress({ p, spent }: { p: Plan; spent: number }) {
  if (spent > p.budget && p.budget > 0) {
    const inBudget = (p.budget / spent) * 100
    return (
      <div class="prog">
        <i style={{ width: `${inBudget}%`, background: 'var(--orange)' }} />
        <i style={{ flex: 1, background: '#6b3016' }} />
      </div>
    )
  }
  const pct = p.budget > 0 ? Math.min(100, (spent / p.budget) * 100) : 0
  return (
    <div class="prog">
      <i style={{ width: `${pct}%`, background: 'var(--green)' }} />
    </div>
  )
}

function PlanCard({ p, expenses, onClick }: { p: Plan; expenses: Expense[]; onClick: () => void }) {
  const s = planStats(p, expenses)
  return (
    <button class="plan tap" onClick={onClick}>
      <div class="row between">
        <span class="caps">{kindLabel(p.kind)}</span>
        <span class="row" style={{ gap: 8 }}>
          {s.over > 0 && <span class="over">+{fmtMoney(s.over, p.currency)}</span>}
          <Dot u={p.by} size={26} />
        </span>
      </div>
      <div class="t">{p.title}</div>
      <Progress p={p} spent={s.spent} />
      <div class="sum">
        <b style={s.over > 0 ? { color: 'var(--orange)' } : undefined}>{fmtMoney(s.spent, p.currency)}</b>
        <span>из {fmtMoney(p.budget, p.currency)}</span>
      </div>
    </button>
  )
}

function PlanDetail({ p, onClose, onEdit }: { p: Plan; onClose: () => void; onEdit: () => void }) {
  const expenses = useList('expenses').filter((e) => e.planId === p.id)
  const u = users()
  const s = planStats(p, expenses)
  const [exp, setExp] = useState<Partial<Expense> | null>(null)
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  const max = Math.max(s.by.a, s.by.b, 1)
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
      <div class="caps">{kindLabel(p.kind)}</div>
      <Progress p={p} spent={s.spent} />
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

      <div class="card">
        <div class="caps" style={{ marginBottom: 10 }}>
          Кто сколько потратил
        </div>
        {(['a', 'b'] as UserId[]).map((x) => (
          <div key={x} style={{ marginTop: 10 }}>
            <div class="row between" style={{ fontSize: 15 }}>
              <span class="row" style={{ gap: 8 }}>
                <Dot u={x} /> {u[x].name}
              </span>
              <span class="mono">{fmtMoney(s.by[x], p.currency)}</span>
            </div>
            <div class="prog" style={{ margin: '8px 0 0', height: 6 }}>
              <i style={{ width: `${(s.by[x] / max) * 100}%`, background: colorOf(x) }} />
            </div>
          </div>
        ))}
        <div class="muted" style={{ fontSize: 14, marginTop: 14 }}>
          {s.spent === 0
            ? 'Трат пока нет.'
            : s.settle
              ? `Чтобы вышло поровну: ${u[s.settle.from].name} → ${u[s.settle.to].name} ${fmtMoney(s.settle.amount, p.currency)}`
              : 'Потрачено поровну 👌'}
        </div>
        {s.saved > 0 && (
          <div class="muted" style={{ fontSize: 14, marginTop: 8 }}>
            Отложено: {fmtMoney(s.saved, p.currency)} ({u.a.name} {fmtMoney(s.savedBy.a, p.currency)}, {u.b.name} {fmtMoney(s.savedBy.b, p.currency)})
          </div>
        )}
      </div>

      {p.note && (
        <p class="muted" style={{ whiteSpace: 'pre-wrap' }}>
          {p.note}
        </p>
      )}

      <div class="section-title">
        <span class="caps">Записи · {expenses.length}</span>
        <button class="link tap row" style={{ gap: 4 }} onClick={() => setExp({})}>
          <IPlus size={18} /> Добавить
        </button>
      </div>
      <div class="card" style={{ padding: '4px 14px' }}>
        {sorted.length === 0 && <div class="muted" style={{ padding: '14px 0' }}>Добавьте первую трату или сколько отложили.</div>}
        {sorted.map((e) => (
          <button key={e.id} class="exp tap" onClick={() => setExp(e)}>
            <Dot u={e.paidBy} />
            <div style={{ minWidth: 0 }}>
              <div class="ellipsis">{e.note || (e.kind === 'save' ? 'Отложили' : 'Трата')}</div>
              <div class="mono muted" style={{ fontSize: 12 }}>
                {fmtDay(e.date)} · {u[e.paidBy].name}
                {e.kind === 'save' ? ' · отложено' : ''}
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
  const [budget, setBudget] = useState(init.budget !== undefined ? String(init.budget) : '')
  const [currency, setCurrency] = useState(init.currency ?? 'RUB')
  const [note, setNote] = useState(init.note ?? '')
  const [archived, setArchived] = useState(!!init.archived)
  const save = () => {
    if (!title.trim()) return toast('Как назовём план?')
    const b = parseMoney(budget)
    if (b === undefined || b < 0) return toast('Укажи бюджет')
    const rec = store().put('plans', {
      id: init.id,
      title: title.trim(),
      kind,
      budget: b,
      currency,
      note: note.trim() || undefined,
      archived: archived || undefined,
      archivedAt: archived ? (init.archivedAt ?? Date.now()) : undefined,
    })
    if (!init.id) {
      const i = me()
      store().notify({ to: other(i), title: `${nameOf(i)} ${verb(i, 'создал', 'создала')} план`, body: `${rec.title} · ${fmtMoney(b, currency)}`, url: '#plans' })
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
      <Field label="Тип">
        <select value={kind} onChange={(e) => setKind(e.currentTarget.value as PlanKind)}>
          {PLAN_KINDS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <div class="two">
        <Field label="Бюджет">
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
        <textarea value={note} onInput={(e) => setNote(e.currentTarget.value)} placeholder="Что входит в бюджет…" />
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
  const [kind, setKind] = useState<'spend' | 'save'>(init.kind ?? 'spend')
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
        body: `${nameOf(i)}: ${kind === 'save' ? 'отложено' : 'трата'} ${fmtMoney(a, plan.currency)}${note.trim() ? ` — ${note.trim()}` : ''}`,
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
        options={[
          ['spend', 'Трата'],
          ['save', 'Отложили'],
        ]}
        value={kind}
        onChange={setKind}
      />
      <Field label={`Сумма, ${CURRENCIES.find((c) => c.code === plan.currency)?.sym ?? plan.currency}`}>
        <input inputMode="decimal" value={amount} onInput={(e) => setAmount(e.currentTarget.value)} placeholder="12 000" autoFocus={!init.id} style={{ fontFamily: 'var(--mono)', fontSize: 22 }} />
      </Field>
      <Field label="На что">
        <input value={note} onInput={(e) => setNote(e.currentTarget.value)} placeholder={kind === 'save' ? 'С зарплаты' : 'Билеты'} />
      </Field>
      <Field label={kind === 'save' ? 'Кто отложил' : 'Кто платил'} group>
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
