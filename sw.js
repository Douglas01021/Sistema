/* sw.js — service worker: guarda todos os arquivos do app para uso offline.
   Ao publicar uma nova versão, altere VERSAO. O IndexedDB (dados do usuário) não é tocado. */
const VERSAO = 'pp-v1.0.0';
const ARQUIVOS = [
  './', './index.html', './styles.css', './app.js', './calc.js', './seed.js', './db.js',
  './manifest.json', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Cache primeiro (app funciona offline); atualiza o cache em segundo plano quando há rede.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cached) => {
      const rede = fetch(e.request).then((resp) => {
        if (resp && resp.ok) caches.open(VERSAO).then((c) => c.put(e.request, resp.clone()));
        return resp;
      }).catch(() => cached);
      return cached || rede;
    })
  );
});
