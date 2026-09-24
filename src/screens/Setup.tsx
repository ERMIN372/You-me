import { useState } from 'preact/hooks'
import { today } from '../lib/dates'
import { isIOS, isStandalone } from '../lib/push'
import type { Profile, UserId, UsersConfig } from '../lib/types'
import { decodeSetup, memoryPersistence, parseRepo } from '../sync/conn'
import { GitHubRemote, type Conn } from '../sync/github'
import { Store } from '../sync/store'
import { COLORS, guessGen } from '../state'
import { Logo } from '../ui/icons'
import { Field, Seg, Swatches, toast } from '../ui/kit'
import { Scanner } from '../ui/Scanner'

type Step = 'connect' | 'profiles' | 'who'

export interface SetupResult {
  conn: Conn
  me: UserId
  /** Стор с уже подтянутыми данными (временный, в памяти) — чтобы не качать заново. */
  init?: { users?: UsersConfig; newProfiles?: { a: Profile; b: Profile } }
}

export function Setup({ onDone }: { onDone: (r: SetupResult) => void }) {
  const [step, setStep] = useState<Step>('connect')
  const [mode, setMode] = useState<'code' | 'new'>('code')
  const [code, setCode] = useState('')
  const [repo, setRepo] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [scan, setScan] = useState(false)
  const [conn, setConn] = useState<Conn | null>(null)
  const [users, setUsers] = useState<UsersConfig | null>(null)
  const [a, setA] = useState<Profile>({ name: '', color: COLORS[0], g: 'm' })
  const [b, setB] = useState<Profile>({ name: '', color: COLORS[1], g: 'f' })
  const iosBrowser = isIOS() && !isStandalone()

  const connect = async (c: Conn) => {
    setBusy(true)
    try {
      const remote = new GitHubRemote(c)
      const info = await remote.info()
      if (!info.private) {
        if (!confirm('Этот репозиторий ПУБЛИЧНЫЙ — данные увидят все. Всё равно продолжить?')) return
      }
      if (!info.canPush) throw new Error('У токена нет права на запись (Contents: Read and write)')
      const full: Conn = { ...c, branch: c.branch || info.defaultBranch || 'main' }
      const tmp = new Store(new GitHubRemote(full), 'a', memoryPersistence())
      await tmp.sync()
      if (tmp.status !== 'idle') throw new Error(tmp.error || 'Не удалось прочитать данные')
      const u = tmp.get('config', 'users') as UsersConfig | undefined
      setConn(full)
      setUsers(u ?? null)
      setStep(u ? 'who' : 'profiles')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не получилось подключиться')
    } finally {
      setBusy(false)
    }
  }

  const fromCode = (s: string) => {
    const c = decodeSetup(s)
    if (!c) return toast('Код не похож на код подключения')
    void connect(c)
  }

  const fromForm = () => {
    const r = parseRepo(repo)
    if (!r) return toast('Репозиторий в формате владелец/имя')
    if (!token.trim()) return toast('Нужен токен')
    void connect({ ...r, branch: '', token: token.trim() })
  }

  if (step === 'profiles' && conn) {
    return (
      <div class="onb">
        <Logo size={34} />
        <h1>Знакомство</h1>
        <p>Как вас подписывать? Цвет — чтобы сразу было видно, кто что добавил.</p>
        <ProfileEdit label="Ты" p={a} onChange={setA} />
        <ProfileEdit label="Партнёр" p={b} onChange={setB} />
        <div style={{ flex: 1 }} />
        <button
          class="btn"
          style={{ marginTop: 24 }}
          onClick={() => {
            if (!a.name.trim() || !b.name.trim()) return toast('Впиши оба имени')
            onDone({ conn, me: 'a', init: { newProfiles: { a: { ...a, name: a.name.trim() }, b: { ...b, name: b.name.trim() } } } })
          }}
        >
          Готово
        </button>
      </div>
    )
  }

  if (step === 'who' && conn && users) {
    return (
      <div class="onb">
        <Logo size={34} />
        <h1>Кто ты?</h1>
        <p>Выбери себя — от этого зависит, чьи ответы и хотелки твои. Можно поменять в настройках.</p>
        <div class="who-pick">
          {(['a', 'b'] as UserId[]).map((u) => (
            <button key={u} class="tap" onClick={() => onDone({ conn, me: u, init: { users } })}>
              <span class="avatar" style={{ background: users[u].color }}>
                {users[u].name.slice(0, 1).toUpperCase()}
              </span>
              {users[u].name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div class="onb">
      <Logo size={34} />
      <h1>You&amp;Me</h1>
      <p>Общий календарь, хотелки, планы, вопрос дня, покупки и карты. Данные лежат в вашем приватном репозитории GitHub.</p>

      {iosBrowser && (
        <div class="banner warn" style={{ marginTop: 6 }}>
          <span style={{ fontSize: 22 }}>📲</span>
          <span>
            Сначала добавь на экран «Домой»: <b>Поделиться → На экран «Домой»</b>, и подключайся уже оттуда. У ярлыка своё хранилище — настройки из Safari туда не перенесутся.
          </span>
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <Seg
          options={[
            ['code', 'У меня есть код'],
            ['new', 'Первый запуск'],
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>

      {mode === 'code' ? (
        <>
          <p style={{ fontSize: 14 }}>Открой на телефоне партнёра: Настройки → «Подключить второй телефон» — и отсканируй QR или вставь код.</p>
          <button class="btn ghost" onClick={() => setScan(true)} disabled={busy}>
            Сканировать QR
          </button>
          <Field label="Или вставь код">
            <textarea value={code} onInput={(e) => setCode(e.currentTarget.value)} placeholder="YM1.…" style={{ minHeight: 80, fontFamily: 'var(--mono)', fontSize: 13 }} />
          </Field>
          <button class="btn" style={{ marginTop: 16 }} onClick={() => fromCode(code)} disabled={busy || !code.trim()}>
            {busy ? 'Подключаюсь…' : 'Подключиться'}
          </button>
        </>
      ) : (
        <>
          <ol style={{ fontSize: 14 }}>
            <li>
              Создай <b>приватный</b> репозиторий на GitHub, например <b>you-me-data</b> (с README).
            </li>
            <li>
              GitHub → Settings → Developer settings → <b>Fine-grained tokens</b> → Generate. Доступ только к этому репо. Права: <b>Contents: Read and write</b> и <b>Workflows: Read and write</b> (для уведомлений).
            </li>
            <li>Вставь сюда имя репо и токен.</li>
          </ol>
          <Field label="Репозиторий">
            <input value={repo} onInput={(e) => setRepo(e.currentTarget.value)} placeholder="ermin372/you-me-data" autoCapitalize="off" autoCorrect="off" spellcheck={false} />
          </Field>
          <Field label="Токен" hint="Хранится только на этом устройстве">
            <input value={token} onInput={(e) => setToken(e.currentTarget.value)} placeholder="github_pat_…" type="password" autoCapitalize="off" autoCorrect="off" spellcheck={false} />
          </Field>
          <button class="btn" style={{ marginTop: 18 }} onClick={fromForm} disabled={busy}>
            {busy ? 'Подключаюсь…' : 'Подключиться'}
          </button>
        </>
      )}
      <div style={{ flex: 1 }} />
      <a href="?demo" class="muted" style={{ textAlign: 'center', marginTop: 28, fontSize: 14, color: 'var(--muted)' }}>
        Посмотреть демо без подключения →
      </a>
      {scan && (
        <Scanner
          hint="Наведи на QR-код с телефона партнёра"
          onClose={() => setScan(false)}
          onResult={(r) => {
            setScan(false)
            setCode(r.text)
            fromCode(r.text)
          }}
        />
      )}
    </div>
  )
}

export function ProfileEdit({ label, p, onChange }: { label: string; p: Profile; onChange: (p: Profile) => void }) {
  return (
    <div class="card" style={{ marginTop: 14 }}>
      <div class="caps">{label}</div>
      <Field label="Имя">
        <input value={p.name} onInput={(e) => onChange({ ...p, name: e.currentTarget.value })} placeholder={label === 'Ты' ? 'Дмитрий' : 'Софья'} />
      </Field>
      <Field label="Как склонять" group>
        <Seg
          sm
          options={[
            ['m', 'добавил'],
            ['f', 'добавила'],
          ]}
          value={p.g ?? 'm'}
          onChange={(g) => onChange({ ...p, g })}
        />
      </Field>
      <Field label="От кого? (для «письмо от …»)" hint="Можно не трогать — угадаем сами">
        <input value={p.gen ?? ''} onInput={(e) => onChange({ ...p, gen: e.currentTarget.value || undefined })} placeholder={guessGen(p.name || (label === 'Ты' ? 'Дмитрий' : 'Софья'), p.g)} />
      </Field>
      <Field label="Цвет" group>
        <Swatches value={p.color} onChange={(color) => onChange({ ...p, color })} />
      </Field>
    </div>
  )
}

export const initialMeta = () => ({
  id: 'meta',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow',
  qSeed: crypto.getRandomValues(new Uint32Array(1))[0],
  qStart: today(),
})
