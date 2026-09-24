/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

// Офлайн: всё приложение (HTML, JS, CSS, шрифты, иконки) кэшируется при установке.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

self.skipWaiting()
clientsClaim()

interface Msg {
  title?: string
  body?: string
  tag?: string
  url?: string
}

self.addEventListener('push', (event) => {
  let data: Msg = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }
  const scope = self.registration.scope
  event.waitUntil(
    self.registration.showNotification(data.title || 'You&Me', {
      body: data.body || '',
      tag: data.tag,
      icon: `${scope}icons/icon-192.png`,
      badge: `${scope}icons/badge-96.png`,
      data: { url: data.url || '' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const hash = (event.notification.data?.url as string) || ''
  const target = self.registration.scope + (hash.startsWith('#') ? hash : '')
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const c of all) {
        if (c.url.startsWith(self.registration.scope)) {
          await c.focus()
          c.postMessage({ type: 'navigate', hash })
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
