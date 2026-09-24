import type { Expense, Plan, UserId } from './types'

export const CURRENCIES: { code: string; sym: string; name: string }[] = [
  { code: 'RUB', sym: '₽', name: 'Рубль' },
  { code: 'EUR', sym: '€', name: 'Евро' },
  { code: 'USD', sym: '$', name: 'Доллар' },
  { code: 'KZT', sym: '₸', name: 'Тенге' },
  { code: 'GEL', sym: '₾', name: 'Лари' },
  { code: 'AMD', sym: '֏', name: 'Драм' },
  { code: 'TRY', sym: '₺', name: 'Лира' },
  { code: 'AED', sym: 'AED', name: 'Дирхам' },
  { code: 'THB', sym: '฿', name: 'Бат' },
  { code: 'CNY', sym: '¥', name: 'Юань' },
  { code: 'JPY', sym: 'JP¥', name: 'Иена' },
  { code: 'GBP', sym: '£', name: 'Фунт' },
  { code: 'BYN', sym: 'Br', name: 'Бел. рубль' },
  { code: 'RSD', sym: 'RSD', name: 'Динар' },
]

export const sym = (code: string) => CURRENCIES.find((c) => c.code === code)?.sym ?? code

const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })

export function fmtMoney(n: number | undefined, cur: string) {
  if (n === undefined || Number.isNaN(n)) return ''
  return `${nf.format(n).replace(/[  ]/g, ' ')} ${sym(cur)}`
}

/** «7 400,50» / «7400.5» → 7400.5 */
export function parseMoney(s: string): number | undefined {
  const t = s.replace(/[\s  ]/g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined
}

export interface PlanStats {
  spent: number
  saved: number
  by: Record<UserId, number>
  savedBy: Record<UserId, number>
  remaining: number
  over: number
  /** Кто кому сколько должен, чтобы траты были поровну. */
  settle: { from: UserId; to: UserId; amount: number } | null
  progress: number
}

export function planStats(plan: Plan, expenses: Expense[]): PlanStats {
  const by = { a: 0, b: 0 }
  const savedBy = { a: 0, b: 0 }
  for (const e of expenses) {
    if (e.planId !== plan.id) continue
    if (e.kind === 'save') savedBy[e.paidBy] += e.amount
    else by[e.paidBy] += e.amount
  }
  const r2 = (n: number) => Math.round(n * 100) / 100
  const spent = r2(by.a + by.b)
  const saved = r2(savedBy.a + savedBy.b)
  const half = spent / 2
  const diff = r2(by.a - half)
  const settle = Math.abs(diff) < 0.01 ? null : diff > 0 ? { from: 'b' as const, to: 'a' as const, amount: diff } : { from: 'a' as const, to: 'b' as const, amount: -diff }
  return {
    spent,
    saved,
    by,
    savedBy,
    remaining: r2(plan.budget - spent),
    over: r2(Math.max(0, spent - plan.budget)),
    settle,
    progress: plan.budget > 0 ? spent / plan.budget : 0,
  }
}
