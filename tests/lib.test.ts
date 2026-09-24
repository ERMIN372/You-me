import { describe, expect, it } from 'vitest'
import { detectFormat, eanValid, groupNumber } from '../src/lib/barcode'
import { occurrences, weekBars } from '../src/lib/calendar'
import { addDays, dayNum, monthGrid, nextOccurrence, plural, weekday } from '../src/lib/dates'
import { fmtMoney, parseMoney, planStats } from '../src/lib/money'
import { order, questionFor } from '../src/lib/qday'
import { QUESTIONS } from '../src/data/questions'
import { decodeSetup, encodeSetup, parseRepo } from '../src/sync/conn'
import type { CalEvent, Expense, Person, Plan } from '../src/lib/types'

const base = { createdAt: 1, updatedAt: 1, by: 'a' as const }

describe('dates', () => {
  it('weekday: 2026-10-08 is Thursday', () => {
    expect(weekday('2026-10-08')).toBe(3)
    expect(weekday('2026-09-28')).toBe(0)
  })
  it('month grid starts on Monday and covers the month', () => {
    const g = monthGrid(2026, 10)
    expect(g[0][0]).toBe('2026-09-28')
    expect(g.at(-1)![6]).toBe('2026-11-01')
    expect(g.length).toBe(5)
  })
  it('next occurrence and leap day', () => {
    expect(nextOccurrence(10, 8, '2026-10-09')).toBe('2027-10-08')
    expect(nextOccurrence(2, 29, '2026-01-01')).toBe('2026-02-28')
    expect(nextOccurrence(2, 29, '2028-01-01')).toBe('2028-02-29')
  })
  it('russian plurals', () => {
    expect([1, 2, 5, 11, 21, 22, 25].map((n) => plural(n, 'год', 'года', 'лет'))).toEqual(['год', 'года', 'лет', 'лет', 'год', 'года', 'лет'])
  })
  it('addDays across month/year', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(dayNum('2026-03-01') - dayNum('2026-02-28')).toBe(1)
  })
})

describe('calendar', () => {
  const ev = (e: Partial<CalEvent>): CalEvent => ({ id: Math.random().toString(), title: 't', kind: 'event', start: '2026-10-10', ...base, ...e })
  it('birthdays with age', () => {
    const p: Person = { id: 'p', name: 'Мама Софьи', day: 8, month: 10, year: 1958, whose: 'b', ...base }
    const o = occurrences([], [p], '2026-10-01', '2026-10-31')
    expect(o).toHaveLength(1)
    expect(o[0].subtitle).toContain('68 лет')
  })
  it('yearly anniversary counts years', () => {
    const o = occurrences([ev({ kind: 'anniversary', start: '2023-10-24', title: 'Годовщина' })], [], '2026-10-01', '2026-10-31')
    expect(o[0].date).toBe('2026-10-24')
    expect(o[0].subtitle).toContain('3 года')
  })
  it('multi-day trips become bars split by week', () => {
    const trip = ev({ kind: 'trip', start: '2026-10-12', end: '2026-10-26' })
    const g = monthGrid(2026, 10)
    const occs = occurrences([trip], [], g[0][0], g.at(-1)![6])
    const bars = g.map((w) => weekBars(w, occs))
    expect(bars.map((b) => b.length)).toEqual([0, 0, 1, 1, 1])
    expect(bars[2][0]).toMatchObject({ startCol: 0, endCol: 6, capStart: true, capEnd: false })
    expect(bars[4][0]).toMatchObject({ startCol: 0, endCol: 0, capStart: false, capEnd: true })
  })
})

describe('money', () => {
  it('formats and parses', () => {
    expect(fmtMoney(214300, 'RUB')).toBe('214\u00a0300\u00a0₽')
    expect(fmtMoney(2400, 'EUR')).toBe('2\u00a0400\u00a0€')
    expect(parseMoney('7 400,50')).toBe(7400.5)
    expect(parseMoney('')).toBeUndefined()
  })
  it('plan stats: overspend and fair split', () => {
    const plan: Plan = { id: 'k', title: 'Кухня', kind: 'repair', budget: 180000, currency: 'RUB', ...base }
    const e = (amount: number, paidBy: 'a' | 'b', kind: 'spend' | 'save' = 'spend'): Expense => ({ id: String(amount), planId: 'k', amount, paidBy, kind, date: '2026-01-01', ...base })
    const s = planStats(plan, [e(156000, 'a'), e(58300, 'b'), e(1000, 'b', 'save')])
    expect(s.spent).toBe(214300)
    expect(s.over).toBe(34300)
    expect(s.saved).toBe(1000)
    expect(s.settle).toEqual({ from: 'b', to: 'a', amount: 48850 })
  })
})

describe('barcode', () => {
  it('EAN checksum and detection', () => {
    expect(eanValid('4600517000003')).toBe(true)
    expect(eanValid('4600517000001')).toBe(false)
    expect(detectFormat('4600517000003')).toBe('EAN13')
    expect(detectFormat('4600517000001')).toBe('CODE128')
    expect(detectFormat('SM-7788')).toBe('CODE128')
    expect(groupNumber('4600517000003')).toBe('4600 5170 0000 3')
  })
})

describe('question of the day', () => {
  it('same question on both phones for the same day; permutation is full', () => {
    const a = questionFor('2026-10-08', 123, '2026-09-01')
    const b = questionFor('2026-10-08', 123, '2026-09-01')
    expect(a).toEqual(b)
    const o = order(123)
    expect(new Set(o).size).toBe(QUESTIONS.length)
    expect(QUESTIONS.length).toBeGreaterThan(400)
  })
  it('no repeats within one full cycle', () => {
    const seen = new Set<string>()
    for (let i = 0; i < QUESTIONS.length; i++) seen.add(questionFor(addDays('2026-09-01', i), 7, '2026-09-01').q)
    expect(seen.size).toBe(QUESTIONS.length)
  })
})

describe('setup code', () => {
  it('roundtrip', () => {
    const c = { owner: 'ermin372', repo: 'you-me-data', branch: 'main', token: 'github_pat_ABC_123' }
    expect(decodeSetup(encodeSetup(c))).toEqual(c)
    expect(decodeSetup('мусор')).toBeNull()
  })
  it('parses repo input', () => {
    expect(parseRepo('https://github.com/ERMIN372/you-me-data.git')).toEqual({ owner: 'ERMIN372', repo: 'you-me-data' })
    expect(parseRepo('ermin372/you-me-data')).toEqual({ owner: 'ermin372', repo: 'you-me-data' })
  })
})
