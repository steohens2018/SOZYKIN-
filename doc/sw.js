// Service Worker приложения «Документы»: работа без сети.
//
//   — страница приложения: сначала сеть (чтобы обновления доходили сразу),
//     без сети — копия из кеша;
//   — скрипт приложения: сначала сеть, как и страница (обновления доходят сразу);
//   — иконки, модуль распознавания (ocr/), pdf.js (vendor/): сначала кеш;
//   — ИИ и вход Pollinations — мимо кеша: ключ не должен попасть в кеш.
//
// Свои кеши — с префиксом «doc-»: кеши сайта проверки (sozykin-…) не трогаем.

const CACHE = 'doc-v7';
const SHELL = ['./', './index.html', './app.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
// Модуль распознавания (~11 МБ) кешируется при первом распознавании, а не при установке


self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for(const key of await caches.keys()) if(key.startsWith('doc-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if(request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if(!sameOrigin) return;                       // ИИ, справочник индексов — мимо кеша
  const isPage = request.mode === 'navigate' || /\.html$|\/app\.js$/.test(url.pathname);
  event.respondWith(isPage ? networkFirst(request) : cacheFirst(request));
});

async function networkFirst(request){
  const cache = await caches.open(CACHE);
  try{
    const response = await fetch(request);
    if(response.ok) cache.put(request, response.clone());
    return response;
  }catch(e){
    return (await cache.match(request, { ignoreSearch: true })) || (await cache.match('./index.html')) || Response.error();
  }
}

async function cacheFirst(request){
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if(cached) return cached;
  const response = await fetch(request);
  if(response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}
