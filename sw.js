// Service Worker di GamePulse AI
// Gestisce: cache dell'app shell per l'avvio offline, cache "network-first" per i feed
// (così l'ultimo aggiornamento riuscito resta leggibile anche senza connessione),
// e un gestore "push" già pronto per quando/se in futuro collegherai un vero server di notifiche push
// (da solo non fa nulla: serve un backend che invii le notifiche tramite il servizio push del browser).

const CACHE_NAME = "gamepulse-cache-v1";
const APP_SHELL = [
  "./gamepulse-ai.html",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = event.request.url;

  // Feed RSS/API: prova prima la rete, altrimenti usa l'ultima risposta salvata in cache.
  if(url.includes("api.rss2json.com")){
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Tutto il resto (pagina, font, icone...): cache-first con aggiornamento in background.
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request)
        .then(res => {
          if(res && res.ok){
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "GamePulse AI", {
      body: data.body || "Nuove notizie disponibili.",
      icon: "icon-192.png"
    })
  );
});
