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

const verb = (u, m, f) => (users[u]?.g === 'f' ? f : users[u]?.g === 'm' ? m : `${m}(а)`)

async function sendTo(to, msg) {
  const targets = devices.filter((d) => to === 'both' || d.user === to)
  if (!targets.length) console.log(`Нет устройств для ${to}`)
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

function morning() {
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
  const all = [...lines, ...soon]
  if (!all.length) return console.log('Утром сказать нечего')
  return sendTo('both', { title: lines.length ? 'Сегодня' : 'Скоро', body: all.join('\n'), tag: `morning:${today}`, url: '#calendar' })
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
