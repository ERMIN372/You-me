import '@fontsource-variable/onest'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './styles.css'
import { render } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app'
import { canNotify } from './lib/push'
import { applyTheme, watchSystemTheme } from './lib/theme'
import type { UserId } from './lib/types'
import { initialMeta, Setup, type SetupResult } from './screens/Setup'
import { clearState, idbPersistence, loadConn, loadMe, saveConn, saveMe } from './sync/conn'
import { GitHubRemote, type Conn } from './sync/github'
import { Store } from './sync/store'
import { setStore, users } from './state'
import { Logo } from './ui/icons'
import { Toasts } from './ui/kit'

applyTheme()
watchSystemTheme()
if ('serviceWorker' in navigator && !import.meta.env.DEV) registerSW({ immediate: true })

const nsOf = (c: Conn) => `${c.owner}/${c.repo}`

async function openStore(conn: Conn, me: UserId): Promise<Store> {
  const s: Store = new Store(new GitHubRemote(conn), me, idbPersistence(nsOf(conn)), { label: (): string => users()[s.me].name })
  s.canNotify = canNotify
  await s.init()
  setStore(s)
  return s
}

type Phase = { k: 'loading' } | { k: 'setup' } | { k: 'app' }

function Root() {
  const [phase, setPhase] = useState<Phase>({ k: 'loading' })

  useEffect(() => {
    void (async () => {
      if (new URLSearchParams(location.search).has('demo')) {
        const { demoStore } = await import('./sync/demo')
        setStore(await demoStore(), true)
        return setPhase({ k: 'app' })
      }
      const conn = loadConn()
      const me = loadMe()
      if (!conn || !me) return setPhase({ k: 'setup' })
      const s = await openStore(conn, me)
      s.start()
      setPhase({ k: 'app' })
    })()
  }, [])

  const onSetup = async (r: SetupResult) => {
    setPhase({ k: 'loading' })
    saveConn(r.conn)
    saveMe(r.me)
    const s = await openStore(r.conn, r.me)
    await s.sync()
    const np = r.init?.newProfiles
    if (np && !s.get('config', 'users')) {
      s.put('config', { id: 'users', a: np.a, b: np.b } as never)
      if (!s.get('config', 'meta')) s.put('config', initialMeta() as never)
      await s.sync()
    }
    s.start()
    setPhase({ k: 'app' })
  }

  const onLogout = async () => {
    const conn = loadConn()
    setStore(null)
    if (conn) await clearState(nsOf(conn))
    saveConn(null)
    saveMe(null)
    location.href = location.pathname
  }

  if (phase.k === 'loading') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ animation: 'fade .4s ease-out' }}>
          <Logo size={40} />
        </div>
      </div>
    )
  }
  if (phase.k === 'setup')
    return (
      <>
        <Setup onDone={onSetup} />
        <Toasts />
      </>
    )
  return <App onLogout={onLogout} />
}

render(<Root />, document.getElementById('app')!)
