import { addDays, parts, today } from '../lib/dates'
import { memoryPersistence } from './conn'
import { MemoryRemote } from './memory'
import { Store } from './store'

/** Демо-режим: всё в памяти, заполнено примерами как на промо-скринах. */
export async function demoStore(): Promise<Store> {
  const s = new Store(new MemoryRemote(), 'a', memoryPersistence())
  const t = today()
  const { y } = parts(t)
  const day = (n: number) => addDays(t, n)

  s.put('config', { id: 'users', a: { name: 'Дмитрий', color: '#4b9cf5', g: 'm' }, b: { name: 'Софья', color: '#ea7266', g: 'f' } } as never)
  s.put('config', { id: 'meta', timezone: 'Europe/Moscow', qSeed: 42, qStart: day(-30), together: day(-1250) } as never)

  const [, m, d] = t.split('-').map(Number)
  s.put('people', { name: 'Мама Софьи', day: d, month: m, year: y - 68, whose: 'b', note: 'Любит пионы и чай с чабрецом', by: 'b' })
  const bro = addDays(t, 16).split('-').map(Number)
  s.put('people', { name: 'Брат Дмитрия', day: bro[2], month: bro[1], year: y - 31, whose: 'a' })
  s.put('events', { title: 'Ужин с друзьями', kind: 'event', start: day(2), time: '19:30', by: 'a' })
  s.put('events', { title: 'Япония', kind: 'trip', start: day(4), end: day(17), note: 'Токио → Киото → Осака', by: 'a' })
  s.put('events', { title: 'Концерт', kind: 'event', start: day(9), by: 'b' })
  s.put('events', { title: 'Годовщина', kind: 'anniversary', start: `${y - 3}-${addDays(t, 21).slice(5)}`, by: 'b' })

  s.put('wishes', { title: 'Ваза Fern Studio', owner: 'b', price: 7400, currency: 'RUB', priority: 2, by: 'b' })
  s.put('wishes', { title: '«Дни в Бургундии»', owner: 'b', price: 2100, currency: 'RUB', priority: 1, note: 'Настольная игра', by: 'b' })
  s.put('wishes', { title: 'Керамика, суббота', owner: 'b', price: 4500, currency: 'RUB', priority: 1, note: 'Мастер-класс на двоих', by: 'b' })
  s.put('wishes', { title: 'Плёночный фотоаппарат', owner: 'a', price: 18000, currency: 'RUB', priority: 2, by: 'a' })
  s.put('wishes', { title: 'Кроссовки для бега', owner: 'a', price: 120, currency: 'EUR', priority: 1, by: 'a' })
  s.put('wishes', { title: 'Турка для кофе', owner: 'a', price: 3200, currency: 'RUB', priority: 1, gifted: true, giftedAt: Date.now() - 40 * 86400000, by: 'a' })
  s.put('wishes', { title: 'Серьги с жемчугом', owner: 'b', price: 9900, currency: 'RUB', priority: 2, gifted: true, giftedAt: Date.now() - 90 * 86400000, by: 'b' })
  const w = s.list('wishes').find((x) => x.title.startsWith('Ваза'))!
  s.put('reservations', { id: w.id, wishId: w.id, by: 'a' })

  const jp = s.put('plans', { title: 'Япония, октябрь', kind: 'trip', budget: 5000, currency: 'EUR', by: 'a' })
  s.put('expenses', { planId: jp.id, amount: 1600, kind: 'spend', paidBy: 'a', note: 'Билеты', date: day(-20), by: 'a' })
  s.put('expenses', { planId: jp.id, amount: 800, kind: 'spend', paidBy: 'b', note: 'Отели', date: day(-12), by: 'b' })
  s.put('expenses', { planId: jp.id, amount: 500, kind: 'save', paidBy: 'b', note: 'С премии', date: day(-3), by: 'b' })
  const k = s.put('plans', { title: 'Кухня', kind: 'repair', budget: 180000, currency: 'RUB', by: 'a' })
  s.put('expenses', { planId: k.id, amount: 132000, kind: 'spend', paidBy: 'a', note: 'Гарнитур', date: day(-40), by: 'a' })
  s.put('expenses', { planId: k.id, amount: 58300, kind: 'spend', paidBy: 'b', note: 'Техника', date: day(-25), by: 'b' })
  s.put('expenses', { planId: k.id, amount: 24000, kind: 'spend', paidBy: 'a', note: 'Работа', date: day(-10), by: 'a' })

  s.put('plans', { title: 'Новый диван', kind: 'purchase', budget: 60000, currency: 'RUB', archived: true, archivedAt: Date.now() - 60 * 86400000, by: 'b' })
  s.put('events', { title: 'Питер на майские', kind: 'trip', start: `${y}-05-01`, end: `${y}-05-04`, by: 'b' })

  s.put('tasks', { title: 'Записаться к стоматологу', done: false, assignee: 'a', takenAt: Date.now() - 86400000, due: day(6), by: 'a' })
  s.put('tasks', { title: 'Забрать посылку из ПВЗ', done: false, assignee: 'b', takenAt: Date.now() - 3600000, by: 'b' })
  s.put('tasks', { title: 'Выбрать подарок маме Софьи', done: false, due: day(10), by: 'b' })
  s.put('tasks', { title: 'Поменять шины', done: false, by: 'a' })
  s.put('tasks', { title: 'Оплатить интернет', done: false, due: day(-1), by: 'b' })
  s.put('tasks', { title: 'Вынести старый шкаф', done: true, doneAt: Date.now() - 2 * 86400000, doneBy: 'a', assignee: 'a', by: 'b' })

  s.put('capsules', { title: 'Дмитрию — на Новый год', text: 'Секрет!', openAt: `${y + 1}-02-14`, to: 'a', by: 'b' })
  s.put('capsules', { title: 'Софье — на годовщину', text: 'Помнишь, как мы…', openAt: addDays(t, 120), to: 'b', by: 'a' })
  const first = s.put('capsules', { title: 'Первый год', text: 'Привет из прошлого! Год назад мы решили писать друг другу письма в будущее. Надеюсь, мы всё так же спорим, кто моет посуду 🙂', openAt: day(-30), to: 'both', by: 'a', createdAt: Date.now() - 400 * 86400000 })
  s.put('reads', { id: `${first.id}:a`, capsuleId: first.id, user: 'a', by: 'a' })
  s.put('reads', { id: `${first.id}:b`, capsuleId: first.id, user: 'b', by: 'b' })

  s.put('cards', { name: 'Пятёрочка', number: '4600517000003', format: 'EAN13', color: '#d8312f', by: 'a' })
  s.put('cards', { name: 'Вкусвилл', number: '2800123456788', format: 'EAN13', color: '#1f8f3a', by: 'b' })
  s.put('cards', { name: 'Спортмастер', number: 'SM-778812903', format: 'CODE128', color: '#1e62d0', by: 'a' })
  s.put('cards', { name: 'Кофейня', number: 'https://example.com/card/12345', format: 'QR', color: '#7a4a2a', by: 'b' })

  s.put('shopping', { title: 'Молоко', done: false, by: 'b' })
  s.put('shopping', { title: 'Авокадо ×2', done: false, by: 'a' })
  s.put('shopping', { title: 'Хлеб', done: true, doneBy: 'a', doneAt: Date.now(), by: 'b' })

  const { questionFor } = await import('../lib/qday')
  const q1 = questionFor(day(-1), 42, day(-30))
  s.put('answers', { id: `${day(-1)}:a`, date: day(-1), user: 'a', text: 'Когда ты рассмеялась над моей шуткой про пингвинов 🐧', q: q1.q, cat: q1.cat, by: 'a' })
  s.put('answers', { id: `${day(-1)}:b`, date: day(-1), user: 'b', text: 'Что ты пришёл с зонтом, хотя дождя не обещали — и он пошёл.', q: q1.q, cat: q1.cat, by: 'b' })
  const q0 = questionFor(t, 42, day(-30))
  s.put('answers', { id: `${t}:b`, date: t, user: 'b', text: 'Секрет 🤫', q: q0.q, cat: q0.cat, by: 'b' })

  await s.sync()
  return s
}
