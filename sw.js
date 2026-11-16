// Service worker: lưu giao diện để mở nhanh/khi mạng chập chờn; không lưu dữ liệu gọi máy chủ (POST) hay tài nguyên ngoài.
const VERSION = 'hs-shell-v2';
const SHELL = ['./', 'index.html', 'app.css', 'speaking.css', 'config.js', 'icon.svg', 'manifest.webmanifest',
  'js/lib.js', 'js/legal.js', 'js/app.js', 'js/result.js', 'js/practice.js', 'js/test.js', 'js/manage.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Mạng trước, mất mạng thì dùng bản đã lưu.
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api') || url.pathname.startsWith('/dev')) return;
  e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })
    .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
