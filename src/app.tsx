import { useEffect, useState } from 'preact/hooks'
import { other } from './lib/types'
import { isDemo, me, todayStr, useList, useStoreVersion } from './state'
import { CalendarScreen } from './screens/Calendar'
import { CardsScreen } from './screens/Cards'
import { PlanList } from './screens/Plans'
import { QuestionScreen } from './screens/Question'
import { SettingsSheet } from './screens/Settings'
import { ShoppingScreen } from './screens/Shopping'
import { WishList } from './screens/Wishes'
import { ICalendar, ICard, ICart, IChat, ICloudOff, IGift, IPlus } from './ui/icons'
import { Duo, Glow, Seg, Toasts } from './ui/kit'

type Tab = 'calendar' | 'wishes' | 'plans' | 'question' | 'shopping' | 'cards'
const TABS: Tab[] = ['calendar', 'wishes', 'plans', 'question', 'shopping', 'cards']

const readHash = (): Tab => {
  const h = location.hash.replace('#', '') as Tab
  return TABS.includes(h) ? h : 'calendar'
}

export function App({ onLogout }: { onLogout: () => void }) {
  const s = useStoreVersion()
  const [tab, setTabState] = useState<Tab>(readHash)
  const [settings, setSettings] = useState(false)

  const setTab = (t: Tab) => {
    setTabState(t)
    history.replaceState(null, '', `${location.pathname}${location.search}#${t}`)
    window.scrollTo(0, 0)
  }

  useEffect(() => {
    const onHash = () => setTabState(readHash())
    window.addEventListener('hashchange', onHash)
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'navigate' && typeof e.data.hash === 'string') {
        const h = e.data.hash.replace('#', '') as Tab
        if (TABS.includes(h)) setTab(h)
      }
    }
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => {
      window.removeEventListener('hashchange', onHash)
      navigator.serviceWorker?.removeEventListener('message', onMsg)
    }
  }, [])

  const answers = useList('answers')
  const t = todayStr()
  const qBadge = s ? !answers.some((a) => a.date === t && a.user === me()) && answers.some((a) => a.date === t && a.user === other(me())) : false
  const shopCount = useList('shopping').filter((x) => !x.done).length

  const open = () => setSettings(true)
  const wishTab = tab === 'wishes' || tab === 'plans'

  return (
    <div class="app">
      {s && (s.status === 'auth' || s.status === 'error') && (
        <div class="screen" style={{ paddingTop: 6 }}>
          <button class="banner warn tap" style={{ width: '100%', textAlign: 'left' }} onClick={open}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <span>{s.status === 'auth' ? 'Токен GitHub не работает — данные не синхронизируются. Открой настройки.' : `Синхронизация: ${s.error}`}</span>
          </button>
        </div>
      )}
      {s && s.status === 'offline' && (
        <div style={{ position: 'fixed', top: 'calc(var(--sat) + 6px)', right: 14, zIndex: 30 }} class="sync-pill">
          <ICloudOff size={14} /> офлайн{s.pending ? ` · ${s.pending}` : ''}
        </div>
      )}
      {isDemo() && (
        <div class="screen">
          <div class="banner info" style={{ marginTop: 4, marginBottom: 0 }}>
            Демо: данные в памяти. <a href={location.pathname}>Подключить свои →</a>
          </div>
        </div>
      )}

      {tab === 'calendar' && <CalendarScreen openSettings={open} />}
      {wishTab && <WishesTab mode={tab} setMode={setTab} openSettings={open} />}
      {tab === 'question' && <QuestionScreen openSettings={open} />}
      {tab === 'shopping' && <ShoppingScreen openSettings={open} />}
      {tab === 'cards' && <CardsScreen openSettings={open} />}

      <nav class="tabbar">
        <TabBtn on={tab === 'calendar'} onClick={() => setTab('calendar')} icon={<ICalendar />} label="Календарь" />
        <TabBtn on={wishTab} onClick={() => setTab(wishTab ? tab : 'wishes')} icon={<IGift />} label="Хотелки" />
        <TabBtn on={tab === 'question'} onClick={() => setTab('question')} icon={<IChat />} label="Вопрос дня" badge={qBadge} />
        <TabBtn on={tab === 'shopping'} onClick={() => setTab('shopping')} icon={<ICart />} label={shopCount ? `Покупки · ${shopCount}` : 'Покупки'} />
        <TabBtn on={tab === 'cards'} onClick={() => setTab('cards')} icon={<ICard />} label="Карты" />
      </nav>

      {settings && <SettingsSheet onClose={() => setSettings(false)} onLogout={onLogout} />}
      <Toasts />
    </div>
  )
}

function TabBtn(props: { on: boolean; onClick: () => void; icon: preact.ComponentChildren; label: string; badge?: boolean }) {
  return (
    <button class={props.on ? 'on' : ''} onClick={props.onClick}>
      {props.icon}
      <span>{props.label}</span>
      {props.badge && <i class="badge" />}
    </button>
  )
}

function WishesTab({ mode, setMode, openSettings }: { mode: 'wishes' | 'plans'; setMode: (t: Tab) => void; openSettings: () => void }) {
  const [creating, setCreating] = useState(false)
  return (
    <div class="screen">
      <Glow color={mode === 'wishes' ? 'rgba(120, 30, 30, 0.4)' : 'rgba(20, 90, 90, 0.4)'} />
      <div class="head">
        <h1>{mode === 'wishes' ? 'Хотелки' : 'Планы'}</h1>
        <div class="actions">
          <button class="icon-btn" onClick={() => setCreating(true)} aria-label="Добавить">
            <IPlus />
          </button>
          <Duo size={34} onClick={openSettings} />
        </div>
      </div>
      <Seg
        options={[
          ['wishes', 'Хотелки'],
          ['plans', 'Планы'],
        ]}
        value={mode}
        onChange={(m) => {
          setCreating(false)
          setMode(m)
        }}
      />
      {mode === 'wishes' ? <WishList creating={creating} onCreated={() => setCreating(false)} /> : <PlanList creating={creating} onCreated={() => setCreating(false)} />}
    </div>
  )
}
