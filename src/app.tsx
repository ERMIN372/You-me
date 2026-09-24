import { useEffect, useState } from 'preact/hooks'
import { other } from './lib/types'
import { unreadForMe } from './lib/us'
import { isDemo, me, todayStr, useList, useStoreVersion } from './state'
import { CalendarScreen } from './screens/Calendar'
import { CapsulesScreen } from './screens/Capsules'
import { CardsScreen } from './screens/Cards'
import { PlanList } from './screens/Plans'
import { QuestionScreen } from './screens/Question'
import { SettingsSheet } from './screens/Settings'
import { ShoppingList } from './screens/Shopping'
import { TaskList } from './screens/Tasks'
import { UsScreen } from './screens/Us'
import { WishList } from './screens/Wishes'
import { ICalendar, ICard, ICloudOff, IGift, IPlus, ITasks, IUs } from './ui/icons'
import { Duo, Glow, Seg, Toasts } from './ui/kit'

type Tab = 'us' | 'calendar' | 'wishes' | 'plans' | 'tasks' | 'shopping' | 'cards' | 'question' | 'capsules'
const TABS: Tab[] = ['us', 'calendar', 'wishes', 'plans', 'tasks', 'shopping', 'cards', 'question', 'capsules']

const readHash = (): Tab => {
  const h = location.hash.replace('#', '') as Tab
  return TABS.includes(h) ? h : 'us'
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
  const capsules = useList('capsules')
  const reads = useList('reads')
  const tasks = useList('tasks')
  const t = todayStr()
  const qPending = s ? !answers.some((a) => a.date === t && a.user === me()) && answers.some((a) => a.date === t && a.user === other(me())) : false
  const letter = s ? unreadForMe(capsules, reads, me(), t).length > 0 : false
  const freeTasks = tasks.filter((x) => !x.done && !x.assignee).length
  const shopCount = useList('shopping').filter((x) => !x.done).length

  const open = () => setSettings(true)
  const usTab = tab === 'us' || tab === 'question' || tab === 'capsules'
  const wishTab = tab === 'wishes' || tab === 'plans'
  const dealsTab = tab === 'tasks' || tab === 'shopping'

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

      {tab === 'us' && <UsScreen go={setTab} openSettings={open} />}
      {tab === 'question' && <QuestionScreen openSettings={open} onBack={() => setTab('us')} />}
      {tab === 'capsules' && <CapsulesScreen onBack={() => setTab('us')} />}
      {tab === 'calendar' && <CalendarScreen openSettings={open} />}
      {wishTab && <TwoModeTab mode={tab} setMode={setTab} openSettings={open} modes={WISH_MODES} />}
      {dealsTab && <TwoModeTab mode={tab} setMode={setTab} openSettings={open} modes={DEAL_MODES} />}
      {tab === 'cards' && <CardsScreen openSettings={open} />}

      <nav class="tabbar">
        <TabBtn on={usTab} onClick={() => setTab('us')} icon={<IUs />} label="Мы" badge={qPending || letter} />
        <TabBtn on={tab === 'calendar'} onClick={() => setTab('calendar')} icon={<ICalendar />} label="Календарь" />
        <TabBtn on={wishTab} onClick={() => setTab(wishTab ? tab : 'wishes')} icon={<IGift />} label="Хотелки" />
        <TabBtn
          on={dealsTab}
          onClick={() => setTab(dealsTab ? tab : 'tasks')}
          icon={<ITasks />}
          label={freeTasks + shopCount ? `Дела · ${freeTasks + shopCount}` : 'Дела'}
        />
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

interface Mode {
  id: Tab
  title: string
  glow: string
  List: (p: { creating: boolean; onCreated: () => void }) => preact.JSX.Element
  /** Нужна ли кнопка «+» (у покупок своё поле ввода). */
  plus: boolean
}

const WISH_MODES: [Mode, Mode] = [
  { id: 'wishes', title: 'Хотелки', glow: 'rgba(120, 30, 30, 0.4)', List: WishList, plus: true },
  { id: 'plans', title: 'Планы', glow: 'rgba(20, 90, 90, 0.4)', List: PlanList, plus: true },
]
const DEAL_MODES: [Mode, Mode] = [
  { id: 'tasks', title: 'Задачи', glow: 'rgba(25, 90, 35, 0.45)', List: TaskList, plus: true },
  { id: 'shopping', title: 'Покупки', glow: 'rgba(40, 110, 70, 0.3)', List: () => <ShoppingList />, plus: false },
]

function TwoModeTab({ mode, setMode, openSettings, modes }: { mode: Tab; setMode: (t: Tab) => void; openSettings: () => void; modes: [Mode, Mode] }) {
  const [creating, setCreating] = useState(false)
  const cur = modes.find((m) => m.id === mode) ?? modes[0]
  const List = cur.List
  return (
    <div class="screen">
      <Glow color={cur.glow} />
      <div class="head">
        <h1>{cur.title}</h1>
        <div class="actions">
          {cur.plus && (
            <button class="icon-btn" onClick={() => setCreating(true)} aria-label="Добавить">
              <IPlus />
            </button>
          )}
          <Duo size={34} onClick={openSettings} />
        </div>
      </div>
      <Seg
        options={modes.map((m) => [m.id, m.title] as [Tab, string])}
        value={cur.id}
        onChange={(m) => {
          setCreating(false)
          setMode(m)
        }}
      />
      <List creating={creating} onCreated={() => setCreating(false)} />
    </div>
  )
}
