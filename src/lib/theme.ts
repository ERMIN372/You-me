// Тема: авто (по системе iPhone) или вручную. Выбор хранится на устройстве.
export type ThemeMode = 'auto' | 'light' | 'dark'

const KEY = 'ym.theme'
const BG = { dark: '#0f1013', light: '#f3f0ea' }

export function loadTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

const mq = () => window.matchMedia?.('(prefers-color-scheme: light)')

export function resolved(mode = loadTheme()): 'light' | 'dark' {
  if (mode !== 'auto') return mode
  return mq()?.matches ? 'light' : 'dark'
}

/** Цвет полосы статуса/адресной строки под текущую тему. */
export function setBarColor(color?: string) {
  const c = color ?? BG[resolved()]
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', c))
}

export function applyTheme(mode = loadTheme()) {
  const root = document.documentElement
  if (mode === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)
  setBarColor()
}

export function saveTheme(mode: ThemeMode) {
  try {
    if (mode === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, mode)
  } catch {
    /* приватный режим */
  }
  applyTheme(mode)
}

export function watchSystemTheme() {
  mq()?.addEventListener?.('change', () => loadTheme() === 'auto' && setBarColor())
}
