// Service Worker приложения «Документы»: работа без сети.
//
//   — страница приложения: сначала сеть (чтобы обновления доходили сразу),
//     без сети — копия из кеша;
//   — иконки, модуль распознавания (ocr/), pdf.js с cdnjs: сначала кеш;
//   — ИИ и вход Pollinations — мимо кеша: ключ не должен попасть в кеш.
//
// Свои кеши — с префиксом «doc-»: кеши сайта проверки (sozykin-…) не трогаем.

const CACHE = 'doc-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
// Модуль распознавания (~11 МБ) кешируется при первом распознавании, а не при установке
const CACHEABLE_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

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
  if(!sameOrigin && !CACHEABLE_HOSTS.includes(url.hostname)) return;
  const isPage = request.mode === 'navigate' || (sameOrigin && url.pathname.endsWith('.html'));
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
