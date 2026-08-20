const SERVICE_WORKER_VERSION = 'security-pwa-1.0.0';

self.addEventListener('install', () => {
    // Bilinçli olarak cache oluşturulmaz. Güvenlik kayıtları ve uygulama
    // dosyaları her zaman canlı yerel sunucudan alınır.
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        void self.skipWaiting();
    }
});

self.addEventListener('fetch', () => {
    // respondWith kullanılmadığı için API, WebSocket, belge ve sayfa istekleri
    // service worker tarafından önbelleğe alınmaz veya değiştirilmez.
});

void SERVICE_WORKER_VERSION;
