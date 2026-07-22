const CACHE_NAME = 'china-trip-v10'
const APP_SHELL = [
  '/manifest.webmanifest',
  '/icon-192.svg',
  '/icon-512.svg',
  '/apple-touch-icon.svg',
  '/offline.html',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then(async (keys) => {
        const oldCacheKeys = keys.filter((key) => key !== CACHE_NAME)
        await Promise.all(oldCacheKeys.map((key) => caches.delete(key)))
        await self.clients.claim()
        if (!oldCacheKeys.length) return
        const clients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        })
        await Promise.all(
          clients.map((client) => {
            if (!client.url) return undefined
            return client.navigate(client.url)
          }),
        )
      }),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  if (['script', 'style'].includes(request.destination)) {
    event.respondWith(networkFirst(request))
    return
  }

  if (['image', 'font', 'manifest'].includes(request.destination)) {
    event.respondWith(cacheFirst(request))
  }
})

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    const cache = await caches.open(CACHE_NAME)
    await cache.put(request, response.clone())
    return response
  } catch {
    return (
      (await caches.match(request)) ||
      (await caches.match('/')) ||
      (await caches.match('/offline.html'))
    )
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  const cache = await caches.open(CACHE_NAME)
  await cache.put(request, response.clone())
  return response
}
