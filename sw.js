// Service Worker — офлайн-режим и установка SOZYKIN Плагиат на телефон.
//
// Раньше воркер создавался из blob-ссылки внутри страницы, а браузеры такие
// воркеры не регистрируют («The URL protocol… is not supported») — офлайн-
// режим не работал никогда. Теперь это отдельный файл рядом с сайтом.
//
// Стратегии:
//   — страницы сайта: сначала сеть (чтобы обновления доходили сразу),
//     без сети — копия из кеша;
//   — библиотеки с cdnjs, шрифты, иконки: сначала кеш — они не меняются;
//   — запросы к базам источников и ИИ-провайдерам не трогаем вовсе:
//     результаты поиска должны быть свежими, а API-ключ не должен попасть в кеш.

const CACHE = 'sozykin-v9';

const SHELL = [
  './', './index.html', './app.html', './accuracy.html', './site.css',
  './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];
// Сторонние хосты, ответы которых можно кешировать
const CACHEABLE_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // Библиотеки — по одной: если CDN недоступен, сайт всё равно установится
    await Promise.all(CDN.map(url => cache.add(new Request(url, { mode: 'cors' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for(const key of await caches.keys()) if(key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if(request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if(!sameOrigin && !CACHEABLE_HOSTS.includes(url.hostname)) return;   // базы, API — мимо кеша

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
    return (await cache.match(request, { ignoreSearch: true })) ||
           (await cache.match('./app.html')) || Response.error();
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
