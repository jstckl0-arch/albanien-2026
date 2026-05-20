// ── SERVICE WORKER — GitHub Pages kompatibel ──────────────────────────────────
// Erkennt automatisch den korrekten Basispfad (z.B. /albanien-2026/)
const CACHE = 'albanien-2026-v3';

// Alle Assets die offline verfügbar sein sollen
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// Install: alle Assets cachen
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      return Promise.allSettled(
        ASSETS.map(asset => c.add(asset).catch(() => console.log('Could not cache:', asset)))
      );
    })
  );
  self.skipWaiting();
});

// Activate: alte Caches löschen
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Cache-first Strategie für App-Assets, Network-first für externe APIs
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Externe APIs (Wechselkurs) — immer online versuchen, kein Cache
  if (url.hostname === 'api.exchangerate-api.com') {
    e.respondWith(
      fetch(e.request).catch(() => new Response(
        JSON.stringify({rates: {ALL: 98.5}, date: 'offline'}),
        {headers: {'Content-Type': 'application/json'}}
      ))
    );
    return;
  }

  // Map Tiles — Network-first mit Cache-Fallback (für Offline-Karte)
  if (url.hostname.includes('tile.openstreetmap.org') ||
      url.hostname.includes('arcgisonline.com') ||
      url.hostname.includes('cartocdn.com')) {
    e.respondWith(
      fetch(e.request).then(r => {
        // Tile in Cache speichern
        const clone = r.clone();
        caches.open(CACHE + '-tiles').then(c => c.put(e.request, clone));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Alle anderen Requests — Cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        // Lokale Ressourcen cachen
        if (e.request.method === 'GET' && url.origin === self.location.origin) {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return r;
      }).catch(() => {
        // Offline-Fallback: App-Shell zurückgeben
        return caches.match('./index.html');
      });
    })
  );
});
