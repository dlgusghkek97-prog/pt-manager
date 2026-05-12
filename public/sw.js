// ═══════════════════════════════════════════════════════════
// PT Manager Service Worker
// 푸시 알림 수신 + 클릭 시 해당 탭 열기/포커스
// ═══════════════════════════════════════════════════════════

// 설치 시
self.addEventListener('install', (event) => {
  console.log('[SW] installed')
  self.skipWaiting()
})

// 활성화 시
self.addEventListener('activate', (event) => {
  console.log('[SW] activated')
  event.waitUntil(self.clients.claim())
})

// 푸시 메시지 수신
self.addEventListener('push', (event) => {
  console.log('[SW] push received')

  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    console.error('[SW] push data parse error:', e)
    data = { title: '알림', body: event.data?.text() || '' }
  }

  const title = data.title || 'PT Manager'
  const options = {
    body: data.body || '새 알림이 도착했어요',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: data.tag || 'pt-manager-' + Date.now(),
    data: {
      link: data.link || null,
      notificationId: data.notificationId || null,
      url: data.url || '/',
    },
    requireInteraction: false,
    vibrate: [200, 100, 200],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] notification click', event.notification.data)
  event.notification.close()

  const data = event.notification.data || {}
  const targetLink = data.link
  const targetUrl = data.url || '/'

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          await client.focus()
          if (targetLink) {
            client.postMessage({
              type: 'NAVIGATE_FROM_NOTIFICATION',
              link: targetLink,
            })
          }
          return
        }
      }

      const fullUrl = targetLink
        ? `${self.location.origin}/?notif_link=${encodeURIComponent(targetLink)}`
        : `${self.location.origin}${targetUrl}`
      await self.clients.openWindow(fullUrl)
    })()
  )
})