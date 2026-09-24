import { useEffect, useState } from 'preact/hooks'
import { qrSvg } from '../lib/barcode'
import { currentDeviceId, disableOnThisDevice, enableOnThisDevice, installWorkflow, isIOS, isStandalone, pushSupported, setupPush } from '../lib/push'
import { other, type Profile, type UserId, type UsersConfig } from '../lib/types'
import { encodeSetup, loadConn, saveMe } from '../sync/conn'
import { isDemo, meta, pushCfg, store, useStoreVersion, users, workerCfg } from '../state'
import { IRefresh } from '../ui/icons'
import { Field, Seg, Sheet, toast } from '../ui/kit'
import { loadTheme, saveTheme, type ThemeMode } from '../lib/theme'
import { fmtDay } from '../lib/dates'
import { ProfileEdit } from './Setup'
import { TogetherSheet } from './Us'

const APP_VERSION = '1.1.0'

function ago(ts?: number) {
  if (!ts) return 'ещё не было'
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'только что'
  if (s < 3600) return `${Math.round(s / 60)} мин назад`
  return new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const STATUS: Record<string, string> = {
  idle: 'синхронизировано',
  syncing: 'синхронизация…',
  offline: 'нет сети — изменения сохранены на телефоне',
  error: 'ошибка',
  auth: 'токен не работает',
}

export function SettingsSheet({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  const s = useStoreVersion()!
  const u = users()
  const me = s.me
  const conn = loadConn()
  const [editU, setEditU] = useState<UserId | null>(null)
  const [share, setShare] = useState(false)
  const [workerOpen, setWorkerOpen] = useState(false)
  const [devId, setDevId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(loadTheme)
  const [togetherOpen, setTogetherOpen] = useState(false)
  const devices = s.list('devices')
  const push = pushCfg()
  const thisDevice = devId ? devices.find((d) => d.id === devId) : undefined

  useEffect(() => {
    void currentDeviceId().then(setDevId)
  }, [])

  const switchMe = () => {
    const to = other(me)
    if (!confirm(`Переключиться на профиль «${u[to].name}»? Это меняет, чьи ответы и хотелки твои на этом устройстве.`)) return
    saveMe(to)
    location.reload()
  }

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      await store().sync()
      toast(ok)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не получилось')
    } finally {
      setBusy(false)
    }
  }

  const appUrl = location.origin + location.pathname

  return (
    <Sheet title="Настройки" onClose={onClose}>
      {isDemo() && <div class="banner info">Демо-режим: данные только в памяти и пропадут после перезагрузки.</div>}

      <div class="caps" style={{ margin: '14px 2px 8px' }}>
        Мы
      </div>
      <div class="set-group">
        {(['a', 'b'] as UserId[]).map((x) => (
          <button key={x} class="set-row tap" onClick={() => setEditU(x)}>
            <span class="row">
              <span class="avatar" style={{ background: u[x].color }}>
                {u[x].name.slice(0, 1).toUpperCase()}
              </span>
              <span>
                {u[x].name}
                {x === me && <span class="muted"> · это ты</span>}
              </span>
            </span>
            <span class="v">изменить</span>
          </button>
        ))}
        <button class="set-row tap" onClick={() => setTogetherOpen(true)}>
          <span>Мы вместе с</span>
          <span class="v">{meta()?.together ? fmtDay(meta()!.together!, true) : 'указать'}</span>
        </button>
        <button class="set-row tap" onClick={switchMe}>
          <span>Переключиться на «{u[other(me)].name}»</span>
          <span class="v">на этом устройстве</span>
        </button>
      </div>

      <div class="caps" style={{ margin: '22px 2px 8px' }}>
        Синхронизация
      </div>
      <div class="set-group">
        <div class="set-row">
          <span>Статус</span>
          <span class="v" style={{ color: s.status === 'error' || s.status === 'auth' ? 'var(--orange)' : undefined }}>
            {STATUS[s.status]}
            {s.error ? `: ${s.error}` : ''}
          </span>
        </div>
        <div class="set-row">
          <span>Последняя</span>
          <span class="v">{ago(s.state.lastSync)}</span>
        </div>
        {s.pending > 0 && (
          <div class="set-row">
            <span>Ждут отправки</span>
            <span class="v">{s.pending}</span>
          </div>
        )}
        {conn && (
          <a class="set-row" href={`https://github.com/${conn.owner}/${conn.repo}`} target="_blank" rel="noopener noreferrer">
            <span style={{ color: 'var(--text)' }}>Репозиторий</span>
            <span class="v mono" style={{ fontSize: 13 }}>
              {conn.owner}/{conn.repo}
            </span>
          </a>
        )}
        <button class="set-row tap" onClick={() => void store().sync()}>
          <span>Синхронизировать сейчас</span>
          <IRefresh size={18} class={s.status === 'syncing' ? 'spin' : ''} />
        </button>
        {conn && (
          <button class="set-row tap" onClick={() => setShare(true)}>
            <span>Подключить второй телефон</span>
            <span class="v">QR-код</span>
          </button>
        )}
      </div>

      <div class="caps" style={{ margin: '22px 2px 8px' }}>
        Уведомления
      </div>
      <div class="set-group">
        {!pushSupported() || (isIOS() && !isStandalone()) ? (
          <div class="set-row">
            <span class="muted" style={{ fontSize: 14 }}>
              На iPhone пуши работают только в приложении с экрана «Домой» (iOS 16.4+). Добавь ярлык: Поделиться → На экран «Домой».
            </span>
          </div>
        ) : !push?.installed ? (
          <button class="set-row tap" disabled={busy || isDemo()} onClick={() => run(() => setupPush(appUrl), 'Уведомления настроены. Теперь включи их на каждом телефоне')}>
            <span>Настроить уведомления</span>
            <span class="v">{busy ? '…' : 'один раз'}</span>
          </button>
        ) : (
          <>
            <button
              class="set-row tap"
              disabled={busy}
              onClick={() =>
                thisDevice
                  ? run(async () => (await disableOnThisDevice(), setDevId(null)), 'Выключено на этом устройстве')
                  : run(async () => setDevId((await enableOnThisDevice()).id), 'Включено 🔔')
              }
            >
              <span>На этом устройстве</span>
              <span class="v" style={{ color: thisDevice ? 'var(--green)' : undefined }}>
                {thisDevice ? 'включены' : 'включить'}
              </span>
            </button>
            <div class="set-row">
              <span>Устройства</span>
              <span class="v">
                {u.a.name}: {devices.filter((d) => d.user === 'a').length} · {u.b.name}: {devices.filter((d) => d.user === 'b').length}
              </span>
            </div>
            {thisDevice && (
              <button
                class="set-row tap"
                disabled={busy}
                onClick={() => run(async () => store().notify({ to: me, title: 'Проверка', body: 'Уведомления работают 🎉 (придут через ~30–60 секунд)', url: '#calendar' }), 'Отправлено — жди ~минуту')}
              >
                <span>Прислать тестовое</span>
                <span class="v">→</span>
              </button>
            )}
            <button class="set-row tap" disabled={busy} onClick={() => run(installWorkflow, 'Автоматизация обновлена')}>
              <span>Переустановить автоматизацию</span>
              <span class="v">GitHub Actions</span>
            </button>
          </>
        )}
      </div>

      <div class="caps" style={{ margin: '22px 2px 8px' }}>
        Хотелки по ссылке
      </div>
      <div class="set-group">
        <button class="set-row tap" onClick={() => setWorkerOpen(true)}>
          <span>Cloudflare Worker</span>
          <span class="v">{workerCfg()?.url ? 'настроен' : 'не настроен'}</span>
        </button>
      </div>

      <div class="caps" style={{ margin: '22px 2px 8px' }}>
        Тема
      </div>
      <Seg
        sm
        options={[
          ['auto', 'Как в системе'],
          ['light', 'Светлая'],
          ['dark', 'Тёмная'],
        ]}
        value={theme}
        onChange={(m) => {
          setTheme(m)
          saveTheme(m)
        }}
      />

      <div class="caps" style={{ margin: '22px 2px 8px' }}>
        Прочее
      </div>
      <div class="set-group">
        <div class="set-row">
          <span>Часовой пояс пары</span>
          <span class="v">{meta()?.timezone ?? '—'}</span>
        </div>
        <button
          class="set-row tap"
          onClick={() => {
            const m = meta()
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
            if (m && confirm(`Поставить ${tz}? От пояса зависит «сегодня» для вопроса дня и уведомлений.`)) store().put('config', { ...m, timezone: tz })
          }}
        >
          <span>Взять пояс с этого устройства</span>
          <span class="v">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
        </button>
        <div class="set-row">
          <span>Версия</span>
          <span class="v mono">{APP_VERSION}</span>
        </div>
        <button
          class="set-row tap"
          onClick={() => {
            if (confirm('Отключить это устройство? Данные в репозитории останутся, на телефоне — удалятся.')) onLogout()
          }}
        >
          <span style={{ color: 'var(--danger-fg)' }}>{isDemo() ? 'Выйти из демо' : 'Отключить устройство'}</span>
        </button>
      </div>

      {togetherOpen && <TogetherSheet onClose={() => setTogetherOpen(false)} />}
      {editU && <ProfileSheet u={editU} onClose={() => setEditU(null)} />}
      {share && conn && <ShareSheet code={encodeSetup(conn)} onClose={() => setShare(false)} />}
      {workerOpen && <WorkerSheet onClose={() => setWorkerOpen(false)} />}
    </Sheet>
  )
}

function ProfileSheet({ u, onClose }: { u: UserId; onClose: () => void }) {
  const all = users()
  const [p, setP] = useState<Profile>(all[u])
  const save = () => {
    if (!p.name.trim()) return toast('Имя не может быть пустым')
    const cur = store().get('config', 'users') as UsersConfig | undefined
    store().put('config', { ...(cur ?? {}), id: 'users', a: all.a, b: all.b, [u]: { ...p, name: p.name.trim() } })
    onClose()
  }
  return (
    <Sheet title="Профиль" onClose={onClose}>
      <ProfileEdit label={u === store().me ? 'Ты' : 'Партнёр'} p={p} onChange={setP} />
      <div class="btns">
        <button class="btn" onClick={save}>
          Сохранить
        </button>
      </div>
    </Sheet>
  )
}

function ShareSheet({ code, onClose }: { code: string; onClose: () => void }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    void qrSvg(code, 2).then(setSvg)
  }, [code])
  return (
    <Sheet title="Второй телефон" onClose={onClose}>
      <ol class="muted" style={{ paddingLeft: 20, lineHeight: 1.55, fontSize: 14 }}>
        <li>На втором iPhone открой ссылку приложения в Safari → Поделиться → «На экран Домой».</li>
        <li>Открой приложение с экрана «Домой» → «У меня есть код» → «Сканировать QR».</li>
        <li>Наведи камеру на этот код.</li>
      </ol>
      <div class="qr-box" dangerouslySetInnerHTML={{ __html: svg }} />
      <div class="banner warn">В коде — токен доступа к вашим данным. Показывай только партнёру, не пересылай в чаты.</div>
      <div class="code-text">{code}</div>
      <div class="btns">
        <button
          class="btn ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code)
              toast('Код скопирован')
            } catch {
              toast('Не получилось скопировать — выдели текст вручную')
            }
          }}
        >
          Скопировать код
        </button>
      </div>
    </Sheet>
  )
}

function WorkerSheet({ onClose }: { onClose: () => void }) {
  const w = workerCfg()
  const [url, setUrl] = useState(w?.url ?? '')
  const [key, setKey] = useState(w?.key ?? '')
  const save = () => {
    if (!url.trim()) {
      if (w) store().remove('config', 'worker')
      return onClose()
    }
    if (!/^https:\/\//.test(url.trim())) return toast('Адрес должен начинаться с https://')
    store().put('config', { id: 'worker', url: url.trim().replace(/\/+$/, ''), key: key.trim() })
    onClose()
  }
  return (
    <Sheet title="Хотелки по ссылке" onClose={onClose}>
      <p class="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
        Чтобы по ссылке подтягивались название, цена и фото, нужен маленький бесплатный Cloudflare Worker (браузер сам не может читать чужие сайты). Инструкция — в папке <span class="mono">worker/</span> репозитория приложения. Настройка общая для вас двоих.
      </p>
      <Field label="Адрес Worker">
        <input value={url} onInput={(e) => setUrl(e.currentTarget.value)} placeholder="https://you-me-preview.имя.workers.dev" autoCapitalize="off" autoCorrect="off" />
      </Field>
      <Field label="Ключ (переменная KEY в Worker)">
        <input value={key} onInput={(e) => setKey(e.currentTarget.value)} placeholder="длинная случайная строка" autoCapitalize="off" autoCorrect="off" />
      </Field>
      <div class="btns">
        <button class="btn" onClick={save}>
          Сохранить
        </button>
      </div>
    </Sheet>
  )
}
