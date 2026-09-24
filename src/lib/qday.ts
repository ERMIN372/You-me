import { QUESTIONS, type Question } from '../data/questions'
import { dayNum } from './dates'

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const orderCache = new Map<string, number[]>()

/** Порядок вопросов — перемешан одинаково на обоих телефонах (общий seed из конфига). */
export function order(seed: number, n = QUESTIONS.length): number[] {
  const key = `${seed}:${n}`
  const hit = orderCache.get(key)
  if (hit) return hit
  const rnd = mulberry32(seed)
  const arr = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  orderCache.set(key, arr)
  return arr
}

export function questionFor(date: string, seed: number, start: string): Question {
  const n = QUESTIONS.length
  const idx = (((dayNum(date) - dayNum(start)) % n) + n) % n
  return QUESTIONS[order(seed, n)[idx]]
}
