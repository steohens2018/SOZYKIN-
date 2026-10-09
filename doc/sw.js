// Приложение «Документы» переехало на https://steohens2018.github.io/dokumenty/.
// Этот воркер заменяет старый: удаляет кеши старой версии (doc-…) и снимает себя,
// чтобы по старому адресу открывалась страница переезда, а не копия из кеша.
// Кеши нового адреса (dokumenty-…) и сайта проверки (sozykin-…) не трогает.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for(const key of await caches.keys()) if(key.startsWith('doc-')) await caches.delete(key);
    await self.registration.unregister();
    for(const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
  })());
});
