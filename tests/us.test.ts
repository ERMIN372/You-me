import { describe, expect, it } from 'vitest'
import { ordinalGen } from '../src/lib/dates'
import type { Capsule } from '../src/lib/types'
import { capsuleState, nextLockedForMe, readState, together, unreadForMe, yearStats } from '../src/lib/us'
import { guessGen } from '../src/state'

const base = { createdAt: Date.UTC(2026, 0, 5), updatedAt: Date.UTC(2026, 0, 5), by: 'a' as const }

describe('together', () => {
  it('counts days and the next anniversary', () => {
    const tg = together('2023-10-12', '2026-10-08')!
    expect(tg.days).toBe(1092)
    expect(tg.next).toBe('2026-10-12')
    expect(tg.inDays).toBe(4)
    expect(tg.n).toBe(3)
    expect(tg.years).toBe(2)
    expect(ordinalGen(tg.n + 1)).toBe('четвёртой')
  })
  it('anniversary day itself', () => {
    const tg = together('2023-10-12', '2026-10-12')!
    expect(tg.inDays).toBe(0)
    expect(tg.n).toBe(3)
    expect(tg.years).toBe(3)
  })
  it('future start → null', () => {
    expect(together('2030-01-01', '2026-01-01')).toBeNull()
  })
})

describe('year stats', () => {
  it('counts gifted, trips, closed plans, photos, answers, tasks, letters', () => {
    const s = yearStats(2026, {
      wishes: [
        { id: 'w1', title: 'a', owner: 'b', currency: 'RUB', priority: 1, gifted: true, giftedAt: Date.UTC(2026, 5, 1), photo: 'img/2026-05/x.jpg', ...base },
        { id: 'w2', title: 'b', owner: 'b', currency: 'RUB', priority: 1, gifted: true, giftedAt: Date.UTC(2025, 5, 1), photo: 'img/2025-05/y.jpg', ...base },
      ],
      events: [
        { id: 'e1', title: 'Япония', kind: 'trip', start: '2026-10-01', end: '2026-10-10', ...base },
        { id: 'e2', title: 'Ужин', kind: 'event', start: '2026-03-01', ...base },
      ],
      plans: [{ id: 'p1', title: 'Кухня', kind: 'repair', budget: 1, currency: 'RUB', archived: true, archivedAt: Date.UTC(2026, 2, 1), ...base }],
      tasks: [{ id: 't1', title: 'x', done: true, doneAt: Date.UTC(2026, 1, 1), ...base }],
      capsules: [{ id: 'c1', title: 'x', text: 'y', openAt: '2027-01-01', to: 'b', photo: 'img/2026-05/x.jpg', ...base }],
      answers: [
        { id: '1', date: '2026-02-01', user: 'a', text: 'x', ...base },
        { id: '2', date: '2026-02-01', user: 'b', text: 'y', ...base },
        { id: '3', date: '2026-02-02', user: 'a', text: 'x', ...base },
      ],
    })
    expect([s.gifted.length, s.trips.length, s.plansClosed.length, s.photos, s.answeredBoth, s.tasksDone, s.letters, s.events]).toEqual([1, 1, 1, 1, 1, 1, 1, 2])
  })
})

describe('capsules', () => {
  const c = (o: Partial<Capsule>): Capsule => ({ id: 'c', title: 'x', text: 'y', openAt: '2027-02-14', to: 'a', ...base, by: 'b', ...o })
  it('locked for recipient, editable for author, open after date', () => {
    expect(capsuleState(c({}), 'a', '2026-10-01')).toBe('locked')
    expect(capsuleState(c({}), 'b', '2026-10-01')).toBe('mine')
    expect(capsuleState(c({}), 'a', '2027-02-14')).toBe('open')
  })
  it('read tracking and unread badge', () => {
    const x = c({ openAt: '2026-09-01', to: 'both' })
    expect(unreadForMe([x], [], 'a', '2026-10-01')).toHaveLength(1)
    expect(unreadForMe([x], [], 'b', '2026-10-01')).toHaveLength(0) // автор
    const reads = [{ id: 'c:a', capsuleId: 'c', user: 'a' as const, ...base }]
    expect(unreadForMe([x], reads, 'a', '2026-10-01')).toHaveLength(0)
    expect(readState(x, reads)).toEqual({ readBy: ['a'], all: false })
    expect(nextLockedForMe([c({ id: '1', openAt: '2027-05-01' }), c({ id: '2', openAt: '2027-01-01' })], 'a', '2026-10-01')?.id).toBe('2')
  })
})

describe('names', () => {
  it('guesses genitive', () => {
    expect(guessGen('Софья', 'f')).toBe('Софьи')
    expect(guessGen('Дмитрий', 'm')).toBe('Дмитрия')
    expect(guessGen('Ольга', 'f')).toBe('Ольги')
    expect(guessGen('Анна', 'f')).toBe('Анны')
    expect(guessGen('Иван', 'm')).toBe('Ивана')
    expect(guessGen('Игорь', 'm')).toBe('Игоря')
    expect(guessGen('Любовь', 'f')).toBe('Любовь')
    expect(guessGen('Я')).toBe('Я')
  })
})

import { planStats } from '../src/lib/money'
import { voteView, votesWaitingForMe } from '../src/lib/us'
import type { Ballot, Expense, Plan, Vote } from '../src/lib/types'

describe('plans: goal vs budget', () => {
  const e = (amount: number, paidBy: 'a' | 'b', kind: 'spend' | 'save'): Expense => ({ id: `${amount}${paidBy}${kind}`, planId: 'p', amount, paidBy, kind, date: '2026-01-01', ...base })
  it('goal: progress by collected, even-up by contributions, balance after spends', () => {
    const plan: Plan = { id: 'p', title: 'Япония', kind: 'trip', mode: 'goal', budget: 5000, currency: 'EUR', ...base }
    const s = planStats(plan, [e(1200, 'a', 'save'), e(700, 'b', 'save'), e(500, 'b', 'save'), e(640, 'a', 'spend')])
    expect(s.main).toBe(2400)
    expect(s.progress).toBeCloseTo(0.48)
    expect(s.remaining).toBe(2600)
    expect(s.balance).toBe(1760)
    expect(s.evenUp).toBeNull() // 1200 vs 1200
    expect(s.over).toBe(0)
  })
  it('legacy plan without mode stays budget', () => {
    const plan: Plan = { id: 'p', title: 'Кухня', kind: 'repair', budget: 100, currency: 'RUB', ...base }
    const s = planStats(plan, [e(150, 'a', 'spend')])
    expect(s.mode).toBe('budget')
    expect(s.over).toBe(50)
  })
})

describe('secret votes', () => {
  const v: Vote = { id: 'v', question: 'Кот?', options: ['Да', 'Нет'], ...base }
  const b = (user: 'a' | 'b', choice: number): Ballot => ({ id: `v:${user}`, voteId: 'v', user, choice, ...base, by: user })
  it('partner vote is revealed only after mine', () => {
    expect(voteView(v, [b('b', 0)], 'a')).toMatchObject({ reveal: false, done: false })
    expect(voteView(v, [b('b', 0), b('a', 0)], 'a')).toMatchObject({ reveal: true, done: true, match: true })
    expect(voteView(v, [b('b', 1), b('a', 0)], 'a').match).toBe(false)
    expect(votesWaitingForMe([v], [b('b', 0)], 'a')).toHaveLength(1)
    expect(votesWaitingForMe([v], [b('b', 0)], 'b')).toHaveLength(0)
  })
})
