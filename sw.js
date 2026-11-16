// 電波が弱いときでも画面が開くようにするための仕組み。
// いつもは新しいものを取りに行き、つながらないときだけ前回の控えを使います。
const CACHE = 'uketsuke-v2';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'icon.svg', 'manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))) // 古い控えを捨てる
    .then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    // cache: 'no-cache' = ブラウザの手元の控えを使わず、毎回サーバーに新しい版があるか確かめる
    fetch(e.request.url, { cache: 'no-cache' }).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
