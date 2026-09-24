// Отправка пуш-уведомлений You&Me. Запускается из .github/workflows/you-me-notify.yml
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import webpush from 'web-push'

const read = (name) => {
  const f = `data/${name}.json`
  if (!existsSync(f)) return {}
  try {
    return JSON.parse(readFileSync(f, 'utf8')).items ?? {}
  } catch {
    return {}
  }
}
const alive = (coll) => Object.values(coll).filter((r) => !r.deleted)

const config = read('config')
const push = config.push
const users = { a: { name: 'Я', g: '', ...config.users?.a }, b: { name: 'Ты', g: '', ...config.users?.b } }
const tz = config.meta?.timezone || 'Europe/Moscow'
const privateKey = process.env.VAPID_PRIVATE_KEY || push?.privateKey

if (!push?.publicKey || !privateKey) {
  console.log('Push не настроен (нет VAPID-ключей в config) — выходим')
  process.exit(0)
}
webpush.setVapidDetails(push.subject || 'mailto:you-me@example.com', push.publicKey, privateKey)

const devicesColl = read('devices')
const devices = alive(devicesColl)
let pruned = false

const guessGen = (n, g) => {
  n = (n || '').trim()
  if (n.length < 3 || /\s/.test(n)) return n
  const low = n.toLowerCase()
  const last = low.slice(-1)
  const prev = low.slice(-2, -1)
  if (last === 'я') return n.slice(0, -1) + 'и'
  if (last === 'а') return n.slice(0, -1) + ('гкхжшщч'.includes(prev) ? 'и' : 'ы')
  if (g === 'f') return n
  if (last === 'й' || last === 'ь') return n.slice(0, -1) + 'я'
  if (/[бвгджзклмнпрстфхцчшщ]/.test(last)) return n + 'а'
  return n
}
const gen = (u) => users[u]?.gen?.trim() || guessGen(users[u]?.name, users[u]?.g)
const SYM = { RUB: '₽', EUR: '€', USD: '$', KZT: '₸', GEL: '₾', AMD: '֏', TRY: '₺', THB: '฿', CNY: '¥', JPY: 'JP¥', GBP: '£', BYN: 'Br' }
const money = (n, c) => `${Number(n).toLocaleString('ru-RU').replace(/[\u00a0\u202f]/g, ' ')} ${SYM[c] ?? c}`
const verb = (u, m, f) => (users[u]?.g === 'f' ? f : users[u]?.g === 'm' ? m : `${m}(а)`)

async function sendTo(to, msg) {
  const targets = devices.filter((d) => to === 'both' || d.user === to)
  if (!targets.length) console.log(`Нет устройств для ${to}`)
  if (process.env.DEBUG) console.log('msg', to, JSON.stringify(msg))
  for (const d of targets) {
    try {
      await webpush.sendNotification(d.sub, JSON.stringify(msg), { TTL: 60 * 60 * 12, urgency: 'normal' })
      console.log(`→ ${d.user}: ${msg.title}`)
    } catch (e) {
      console.log(`× ${d.user}: ${e.statusCode ?? ''} ${e.body ?? e.message}`)
      if (e.statusCode === 404 || e.statusCode === 410) {
        devicesColl[d.id] = { id: d.id, by: d.by, createdAt: d.createdAt, updatedAt: Date.now(), deleted: true }
        pruned = true
      }
    }
  }
}

// ---------- даты (как в приложении: YYYY-MM-DD в часовом поясе пары) ----------
const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const dn = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86400000)
}
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
const onYear = (m, d, y) => `${y}-${String(m).padStart(2, '0')}-${String(m === 2 && d === 29 && !isLeap(y) ? 28 : d).padStart(2, '0')}`
const plural = (n, a, b, c) => {
  const x = Math.abs(n) % 100
  const y = x % 10
  return x > 10 && x < 20 ? c : y > 1 && y < 5 ? b : y === 1 ? a : c
}
const Y = Number(today.slice(0, 4))

async function morning() {
  const lines = []
  const soon = []
  const t = dn(today)
  for (const p of alive(read('people'))) {
    for (const y of [Y, Y + 1]) {
      const d = dn(onYear(p.month, p.day, y)) - t
      const age = p.year ? y - p.year : null
      const ageS = age ? ` (${age} ${plural(age, 'год', 'года', 'лет')})` : ''
      if (d === 0) lines.push(`🎂 Сегодня ДР: ${p.name}${ageS}`)
      if (d === 1) soon.push(`🎂 Завтра ДР: ${p.name}${ageS}`)
      if (d === 7) soon.push(`🎁 Через неделю ДР: ${p.name} — пора думать о подарке`)
    }
  }
  for (const e of alive(read('events'))) {
    const repeat = e.yearly || e.kind === 'anniversary'
    const [sy, sm, sd] = e.start.split('-').map(Number)
    const start = repeat ? onYear(sm, sd, Y) : e.start
    const d = dn(start) - t
    const n = Y - sy
    const title = e.kind === 'anniversary' && n > 0 ? `${e.title} — ${n} ${plural(n, 'год', 'года', 'лет')}` : e.title
    const icon = e.kind === 'trip' ? '✈️' : e.kind === 'anniversary' ? '💞' : '📅'
    if (d === 0) lines.push(`${icon} Сегодня: ${title}${e.time ? `, ${e.time}` : ''}`)
    if (d === 1) soon.push(`${icon} Завтра: ${title}${e.time ? `, ${e.time}` : ''}`)
  }
  // Вместе: годовщина и каждые 100 дней
  const tg = config.meta?.together
  if (tg && dn(tg) <= t) {
    const [ty, tm, td] = tg.split('-').map(Number)
    const total = t - dn(tg)
    if (dn(onYear(tm, td, Y)) === t && Y > ty) lines.push(`💞 Сегодня ${Y - ty} ${plural(Y - ty, 'год', 'года', 'лет')} вместе!`)
    else if (total > 0 && total % 100 === 0) lines.push(`🎉 Сегодня ${total} ${plural(total, 'день', 'дня', 'дней')} вместе`)
  }
  const common = [...lines, ...soon]
  const personal = { a: [], b: [] }
  // Задачи со сроком сегодня / просроченные вчера
  for (const x of alive(read('tasks'))) {
    if (x.done || !x.due) continue
    const d = dn(x.due) - t
    if (d !== 0 && d !== -1) continue
    const text = d === 0 ? `✅ Сегодня срок: ${x.title}` : `⏰ Просрочено: ${x.title}`
    for (const u of x.assignee ? [x.assignee] : ['a', 'b']) personal[u].push(x.assignee ? text : `${text} (свободная)`)
  }
  // ДР из профилей: имениннику — поздравление, партнёру — напоминание про хотелки (брони видит только он)
  const wishesAll = alive(read('wishes'))
  const resv = alive(read('reservations'))
  const wishHint = { a: false, b: false }
  for (const u of ['a', 'b']) {
    const bd = users[u].birthday
    if (!bd || !/^\d{4}-\d{2}-\d{2}$/.test(bd)) continue
    const [, bm, bdd] = bd.split('-').map(Number)
    const o = u === 'a' ? 'b' : 'a'
    for (const y of [Y, Y + 1]) {
      const d = dn(onYear(bm, bdd, y)) - t
      if (d === 0) {
        personal[o].push(`🎂 Сегодня ДР ${gen(u)}!`)
        personal[u].push(`🎉 С днём рождения, ${users[u].name}!`)
      }
      if (d === 14 || d === 7 || d === 2) {
        const open = wishesAll.filter((w) => w.owner === u && !w.gifted)
        const top = [...open].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).slice(0, 3)
        const booked = open.filter((w) => resv.some((r) => r.wishId === w.id))
        let text = `🎁 Через ${d} ${plural(d, 'день', 'дня', 'дней')} ДР ${gen(u)}.`
        text += top.length ? ` В хотелках: ${top.map((w) => (w.price != null ? `${w.title} (${money(w.price, w.currency)})` : w.title)).join(', ')}` : ' Хотелок нет — самое время спросить намёком.'
        if (booked.length) text += `. Ты бронируешь: ${booked.map((w) => w.title).join(', ')}`
        personal[o].push(text)
        wishHint[o] = true
      }
    }
  }
  // Капсулы, которые открываются сегодня
  for (const c of alive(read('capsules'))) {
    if (dn(c.openAt) !== t) continue
    const to = c.to === 'both' ? ['a', 'b'] : [c.to]
    for (const u of to) {
      personal[u].push(u === c.by ? `💌 Сегодня открылось твоё письмо «${c.title}»` : `💌 ${users[c.by]?.name ?? ''} ${verb(c.by, 'написал', 'написала')} тебе письмо «${c.title}» — сегодня оно открылось`)
    }
  }
  for (const u of ['a', 'b']) {
    const all = [...common, ...personal[u]]
    if (!all.length) {
      console.log(`Утром для ${u} сказать нечего`)
      continue
    }
    const letter = personal[u].some((l) => l.startsWith('💌'))
    await sendTo(u, { title: lines.length || personal[u].length ? 'Сегодня' : 'Скоро', body: all.join('\n'), tag: `morning:${today}`, url: letter ? '#capsules' : wishHint[u] ? '#wishes' : '#us' })
  }
}

async function evening() {
  const answers = alive(read('answers')).filter((a) => a.date === today)
  const has = (u) => answers.some((a) => a.user === u)
  for (const u of ['a', 'b']) {
    if (has(u)) continue
    const p = u === 'a' ? 'b' : 'a'
    const body = has(p)
      ? `${users[p].name} уже ${verb(p, 'ответил', 'ответила')} — ответь, чтобы увидеть ответ`
      : 'Вопрос дня ждёт вас обоих 💬'
    await sendTo(u, { title: 'Вопрос дня', body, tag: `q:${today}`, url: '#question' })
  }
}

const event = process.env.EVENT
if (event === 'repository_dispatch') {
  const p = JSON.parse(process.env.PAYLOAD || '{}')
  if (p.to && p.title) await sendTo(p.to, { title: p.title, body: p.body ?? '', tag: p.tag, url: p.url })
} else {
  const kind = process.env.KIND || (process.env.SCHEDULE === '0 17 * * *' ? 'evening' : 'morning')
  console.log(`Сегодня ${today} (${tz}), режим: ${kind}`)
  if (kind === 'evening') await evening()
  else await morning()
}

if (pruned) {
  const ids = Object.keys(devicesColl).sort()
  const lines = ids.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(devicesColl[id])}`)
  writeFileSync('data/devices.json', `{"v": 1, "items": {\n${lines.join(',\n')}\n}}\n`)
}
