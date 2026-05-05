# 🔒 WebSocket Entegrasyonu & Sistem Geneli Güvenlik Denetim Raporu

## Kapsam

Tüm frontend sayfaları, backend altyapısı, WebSocket/Realtime katmanı, Auth middleware'leri ve API istemcisi dosya dosya incelenmiştir.

---

## Önem Seviyeleri

| Seviye | Anlamı |
|--------|--------|
| 🔴 KRİTİK | Doğrudan sızma/veri kaybı riski |
| 🟠 YÜKSEK | Ciddi güvenlik zayıflığı |
| 🟡 ORTA | Profesyonellik ihlali / potansiyel risk |
| 🔵 DÜŞÜK | İyileştirme önerisi |

---

## BÖLÜM 1 — BACKEND GÜVENLİK AÇIKLARI

---

### 🔴 B-01: Socket.IO CORS `origin: '*'`

**Dosya:** [socket.ts](file:///c:/Users/imfurkaann/Documents/projects/security/backend/src/realtime/socket.ts#L40-L48)

```typescript
// MEVCUT — GÜVENSİZ
cors: { origin: '*', methods: ['GET', 'POST'], credentials: false }
```

**Risk:** Herhangi bir domain WebSocket bağlantısı açıp tüm `api:mutation` olaylarını dinleyebilir. CSRF benzeri saldırılar için vektör oluşturur.

**Düzeltme:**
```typescript
cors: {
    origin: process.env.CORS_ORIGIN === '*'
        ? true
        : (process.env.FRONTEND_URL || 'http://localhost:5174'),
    methods: ['GET', 'POST'],
    credentials: true,
}
```

> [!CAUTION]
> Bu açık, üretim ortamında herkesin gerçek zamanlı veri akışını dinlemesine izin verir.

---

### 🔴 B-02: WebSocket Bağlantılarında Authentication Yok

**Dosya:** [socket.ts](file:///c:/Users/imfurkaann/Documents/projects/security/backend/src/realtime/socket.ts#L50-L55)

```typescript
// MEVCUT — Auth kontrolü yok
io.on('connection', (socket) => {
    socket.emit('realtime:connected', { socketId: socket.id, timestamp: ... });
});
```

**Risk:** Kimlik doğrulaması olmadan herkes WebSocket'e bağlanıp tüm mutasyon olaylarını dinleyebilir.

**Düzeltme:**
```typescript
io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Authentication required'));
    const decoded = verifyToken(token);
    if (!decoded) return next(new Error('Invalid token'));
    (socket as any).user = decoded;
    next();
});
```

---

### 🟠 B-03: Admin Auth Middleware — Debug Logları Token Bilgisi Sızdırıyor

**Dosya:** [adminAuth.ts](file:///c:/Users/imfurkaann/Documents/projects/security/backend/src/middleware/adminAuth.ts#L42-L49)

```typescript
console.log('Admin auth - Token received:', token ? 'yes' : 'no');
console.log('Admin auth - Token length:', token?.length);
console.log('Admin auth - Decoded token:', decoded);  // ← KRİTİK: Decoded payload loglanıyor!
```

**Risk:** `decoded` objesi `userId`, `username`, `role`, `isAdmin` gibi hassas bilgileri içerir. Log dosyalarına erişen birisi bu bilgileri ele geçirebilir.

**Düzeltme:** Tüm debug loglarını kaldırın veya `NODE_ENV !== 'production'` koşuluna alın:
```typescript
if (process.env.NODE_ENV !== 'production') {
    console.debug('Admin auth - token valid:', !!decoded);
}
```

---

### 🟠 B-04: `emitApiMutation` Her Mutasyonu Detaylı Logluyor

**Dosya:** [socket.ts](file:///c:/Users/imfurkaann/Documents/projects/security/backend/src/realtime/socket.ts#L63-L69)

```typescript
console.log('[realtime] emitApiMutation', { method, path, statusCode, topics, clientId });
```

**Risk:** Yoğun trafik altında gereksiz I/O, log dosyası şişmesi. `clientId` gibi izleme verileri kalıcı logda saklanmamalı.

**Düzeltme:** `console.log` → `console.debug` ve production guard ekleyin.

---

### 🟠 B-05: Request Logging IP Adresi Açık Metin

**Dosya:** [server.ts](file:///c:/Users/imfurkaann/Documents/projects/security/backend/src/server.ts#L108-L113)

```typescript
console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${ip}`);
```

**Risk:** KVKK/GDPR uyumu açısından IP adreslerinin düz metin loglanması sorunlu olabilir. Ayrıca yüksek trafikte performans etkisi var.

**Düzeltme:** Yapılandırılmış logger (Winston/Pino) kullanın, production'da `info` seviyesinde minimal log tutun.

---

### 🟡 B-06: JWT Token Süresi 30 Gün — Çok Uzun

**Dosya:** [jwt.ts](file:///c:/Users/imfurkaann/Documents/projects/security/backend/src/utils/jwt.ts#L14)

```typescript
const JWT_EXPIRE = process.env.JWT_EXPIRE || '30d';
```

**Risk:** Token çalınması durumunda 30 gün boyunca yetkisiz erişim devam eder. Token iptal (revocation) mekanizması da yok.

**Düzeltme:** Access token süresini 1-4 saat yapın, refresh token mekanizması ekleyin. Veya en azından server-side token blacklist uygulayın.

---

### 🟡 B-07: Rate Limiter In-Memory — Çoklu Sunucu Desteği Yok

**Dosya:** [rateLimiter.ts](file:///c:/Users/imfurkaann/Documents/projects/security/backend/src/middleware/rateLimiter.ts#L38-L39)

```typescript
const rateLimitStore = new Map<string, RateLimitRecord>();
```

**Risk:** Load balancer arkasında birden fazla instance çalıştırılırsa rate limit bypass edilebilir. Sunucu yeniden başlatıldığında tüm limitler sıfırlanır.

**Düzeltme:** Redis tabanlı store'a geçiş yapın (örn: `rate-limiter-flexible` + Redis).

---

### 🟡 B-08: `visitorPublic` Rotası — Rate Limit Var Ama CAPTCHA Yok

**Dosya:** [visitorPublic.ts](file:///c:/Users/imfurkaann/Documents/projects/security/backend/src/routes/visitorPublic.ts)

Public endpoint'ler (`/form-token`, `/records`, `/sgk-records`) authentication gerektirmez. Rate limit global olarak uygulanıyor ancak form spam'ine karşı CAPTCHA koruması yok.

**Düzeltme:** reCAPTCHA veya hCaptcha entegrasyonu, ya da en azından rate limit'i bu rotalar için daha agresif ayarlayın.

---

### 🔵 B-09: `X-Forwarded-For` Header Spoofing Riski

**Dosya:** [rateLimiter.ts](file:///c:/Users/imfurkaann/Documents/projects/security/backend/src/middleware/rateLimiter.ts#L62-L78)

`X-Forwarded-For` header'ı doğrudan ilk IP olarak alınıyor. Proxy olmadan doğrudan erişimde sahte IP gönderilebilir.

**Düzeltme:** Express'te `app.set('trust proxy', 1)` veya `trust proxy` konfigürasyonunu ortam bazlı ayarlayın.

---

## BÖLÜM 2 — FRONTEND GÜVENLİK AÇIKLARI

---

### 🟠 F-01: `localStorage`'da Hassas Veri — Token ve Kullanıcı Bilgisi

**Dosyalar:** [ProtectedRoute.tsx](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/components/ProtectedRoute.tsx#L30), [AdminProtectedRoute.tsx](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/components/AdminProtectedRoute.tsx#L14), [api.ts](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/utils/api.ts#L36-L41)

```typescript
localStorage.getItem('token')
localStorage.getItem('adminToken')
localStorage.getItem('adminUser')  // JSON.parse ile kullanılıyor
```

**Risk:** XSS saldırısı durumunda `localStorage`'daki tüm tokenlar çalınabilir. `httpOnly` cookie'ler JavaScript ile erişilemez.

**Düzeltme (Uzun Vadeli):** Token'ları `httpOnly`, `Secure`, `SameSite=Strict` cookie'lerde saklayın. Kısa vadede mevcut CSP politikasını güçlendirin.

---

### 🟠 F-02: AdminProtectedRoute — Client-Side Role Kontrolü

**Dosya:** [AdminProtectedRoute.tsx](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/components/AdminProtectedRoute.tsx#L32-L36)

```typescript
const user = JSON.parse(adminUser);
if (user.role !== 'admin') {
    setIsAuthenticated(false);
    return;
}
```

**Risk:** `localStorage`'daki `adminUser` değeri tarayıcı DevTools ile manipüle edilebilir. Backend `/admin/me` çağrısı yapılıyor (satır 39) ama JSON.parse kontrolü önceden çalışarak gereksiz güvenlik illüzyonu yaratıyor.

**Düzeltme:** Client-side role kontrolünü kaldırın, yalnızca backend yanıtına güvenin:
```typescript
try {
    const response = await api.get('/admin/me');
    if (response.data.success && response.data.data?.role === 'admin') {
        setIsAuthenticated(true);
    }
} catch { ... }
```

---

### 🟠 F-03: WebSocket Client — Authentication Bilgisi Göndermiyor

**Dosya:** [socket.ts](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/realtime/socket.ts#L34-L39)

```typescript
socket = io(SOCKET_SERVER_URL, {
    path: '/api/socket.io/',
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    // ← auth bilgisi YOK
});
```

**Düzeltme:** B-02 ile birlikte:
```typescript
socket = io(SOCKET_SERVER_URL, {
    path: '/api/socket.io/',
    transports: ['websocket', 'polling'],
    auth: { token: localStorage.getItem('token') || localStorage.getItem('adminToken') },
    autoConnect: true,
    reconnection: true,
});
```

---

### 🟡 F-04: Debug Console Logları Production'da Açık

**Dosyalar:**
- [socket.ts (frontend)](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/realtime/socket.ts#L54) — `console.debug('[realtime] api:mutation received', event)`
- [useWebSocketNotifications.ts](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/hooks/useWebSocketNotifications.ts#L27) — `console.debug('[useWebSocketNotifications] api:mutation event', event)`
- [useWebSocketNotifications.ts](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/hooks/useWebSocketNotifications.ts#L46) — `console.debug('fetched visitors records', ...)`

**Risk:** Mutasyon eventlerinin tüm detayı (path, method, statusCode, clientId) tarayıcı konsolunda görünür. Bilgi ifşası riski.

**Düzeltme:** Tüm `console.debug`/`console.log` çağrılarını kaldırın veya Vite environment variable ile guard altına alın:
```typescript
if (import.meta.env.DEV) { console.debug(...); }
```

---

### 🟡 F-05: API Response Interceptor 401'de Auto-Logout Yapmıyor

**Dosya:** [api.ts](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/utils/api.ts#L104-L108)

```typescript
case HTTP_STATUS.UNAUTHORIZED:
    console.warn('[API] 401 Unauthorized - Token geçersiz veya süresi dolmuş');
    // NOT: Kullanıcı manuel olarak çıkış yapmalı
    break;
```

**Risk:** Geçersiz tokenla oturum açık kalır. Kullanıcı farkında olmadan yetkisiz istekler göndermeye devam eder.

**Düzeltme:** 401 alındığında token'ı temizleyip login sayfasına yönlendirin (en azından opsiyonel olarak).

---

### 🟡 F-06: `useLocalStorage` Hook'u — JSON.parse XSS Vektörü

**Dosya:** [hooks/index.ts](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/hooks/index.ts#L98-L119)

```typescript
const item = localStorage.getItem(key);
return item ? JSON.parse(item) : initialValue;
```

**Risk:** Manipüle edilmiş localStorage değeri prototype pollution'a yol açabilir.

**Düzeltme:** Parse edilen verinin tipini doğrulayan bir schema validation ekleyin (zod veya basit type guard).

---

### 🔵 F-07: `withCredentials: false` — Cookie Tabanlı Auth İmkansız

**Dosya:** [api.ts](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/utils/api.ts#L29)

```typescript
withCredentials: false,
```

Bu ayar, httpOnly cookie kullanımını engeller. F-01'deki localStorage sorunuyla doğrudan bağlantılıdır.

---

## BÖLÜM 3 — SAYFA BAZLI GÜVENLİK ANALİZİ

---

### 🟡 S-01: Dashboard — `localStorage` Üzerinden Konfigürasyon

**Dosya:** [Dashboard.tsx](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/pages/Dashboard.tsx)

Dashboard, `selectedGate`, `weeklyRankingCelebration` gibi değerleri localStorage'dan okuyor. Gate değeri `X-Selected-Gate` header'ı olarak backend'e gönderiliyor. Manipüle edilirse farklı kapının verilerine erişim sağlanabilir (backend'de gate yetki kontrolü yoksa).

**Düzeltme:** Backend'de gate erişim yetkisini kullanıcı bazlı kontrol edin.

---

### 🟡 S-02: Tüm Sayfalar — `alert()` Kullanımı

**Dosyalar:** Managers.tsx, Incidents.tsx, ve benzeri sayfalarda:
```typescript
alert('Lütfen listeden bir müdür seçin.');
alert(err?.response?.data?.message || 'İşlem başarısız');
```

**Risk:** Backend hata mesajı doğrudan `alert()` ile gösterildiğinde, saldırgan kontrollü mesajlar UI'da görünebilir (stored XSS benzeri durum, mesaj DB'den geliyorsa). Ayrıca `alert()` kullanımı profesyonel değildir.

**Düzeltme:** Ant Design `message.error()` veya mevcut `NotificationManager` sistemini kullanın.

---

### 🟡 S-03: Incidents — Vardiya Erişim Kontrolü Sadece Client-Side

**Dosya:** [Incidents.tsx](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/pages/Incidents.tsx#L15-L62)

`getShiftAccess()` fonksiyonu saat kontrolünü yalnızca frontend'de yapıyor. API'ye doğrudan istek atılarak vardiya kısıtlaması bypass edilebilir.

**Düzeltme:** Backend'de de vardiya saati kontrolü ekleyin.

---

### 🟡 S-04: Incidents — Kategoriler Tekrarlanan Hardcoded Obje

**Dosya:** [Incidents.tsx](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/pages/Incidents.tsx)

Aynı 22 alanlık kategori objesi dosya içinde **6 kez** (satır 70-94, 177-201, 222-246, 248-272, 278-302, 308-332) tekrarlanmış. Bu DRY prensibine aykırıdır.

**Düzeltme:** `DEFAULT_CATEGORIES` sabitini bir kez tanımlayıp yeniden kullanın:
```typescript
const DEFAULT_CATEGORIES = { theft_guest_property: false, ... } as const;
// Kullanım: setCategories({ ...DEFAULT_CATEGORIES });
```

---

### 🔵 S-05: Managers — `confirm()` Kullanımı

**Dosya:** [Managers.tsx](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/pages/Managers.tsx#L167-L179)

```typescript
if (!confirm('Seçili müdür için çıkış kaydı oluşturulsun mu?')) return;
```

Tarayıcı native `confirm()` dialog'u profesyonel değil. Ant Design `Modal.confirm()` kullanılmalı.

---

### 🔵 S-06: NotificationManager — `window.location.pathname` Kontrolü

**Dosya:** [NotificationManager.tsx](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/components/NotificationManager.tsx#L17-L19)

```typescript
if (window.location.pathname.startsWith('/qr')) { return null; }
```

React Router'ın `useLocation()` hook'u yerine doğrudan `window.location` kullanılması, SPA navigasyonlarında stale değer riski yaratır.

---

## BÖLÜM 4 — WEBSOCKET MİMARİSİ SORUNLARI

---

### 🟠 W-01: Mutation Event Broadcast — Tüm Client'lara Gönderim

**Dosya:** [socket.ts (backend)](file:///c:/Users/imfurkaann/Documents/projects/security/backend/src/realtime/socket.ts#L76-L79)

```typescript
io.emit('api:mutation', { ...event, topics });
```

**Risk:** Tüm bağlı client'lar tüm mutation eventlerini alıyor. Admin paneli eventleri normal kullanıcılara da gidiyor. Path bilgisi (örn: `/api/admin/whatsapp`) bile bilgi ifşası oluşturur.

**Düzeltme:** Socket.IO room'ları kullanın:
```typescript
// Bağlantıda role bazlı room'a ekle
socket.join(`role:${decoded.role}`);
// Yayında hedefli gönderim
io.to('role:admin').emit('api:mutation', adminEvent);
```

---

### 🟡 W-02: Self-Echo Kasıtlı Olarak Açık

**Dosya:** [useRealtimeRefetch.ts](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/realtime/useRealtimeRefetch.ts#L58-L61)

```typescript
// Self-echo suppression is intentionally disabled
```

Yorumda açıklanmış ancak bu, gereksiz API çağrılarına neden olur. Kendi mutasyonunuz tamamlandığında zaten local state güncellenmiştir.

**Düzeltme:** Self-echo filtrelemeyi uygulayıp, Dashboard gibi çoklu-tab senaryoları için ayrı bir `force-refresh` mekanizması ekleyin.

---

### 🟡 W-03: useWebSocketNotifications — Tüm Mutation'ları Dinliyor

**Dosya:** [useWebSocketNotifications.ts](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/hooks/useWebSocketNotifications.ts#L18)

Her gelen mutation event'i için `subscribeToApiMutations` çağrılıyor, ardından bildirim türüne göre ek API çağrıları yapılıyor (satır 41: `api.get('/visitors/records')`). Bu, her QR girişinde tüm ziyaretçi kayıtlarını çeken gereksiz bir network çağrısıdır.

**Düzeltme:** Event payload'una özet bilgi ekleyin (backend tarafında), ek API çağrısı ihtiyacını ortadan kaldırın.

---

## BÖLÜM 5 — DÜZELTME ROTASI (ÖNCELİK SIRASI)

---

### Faz 1 — Acil (KRİTİK) — 1-2 Gün

| # | Bulgu | Dosya | Eylem |
|---|-------|-------|-------|
| 1 | B-01 | `backend/realtime/socket.ts` | Socket.IO CORS'u ortam değişkenine bağla |
| 2 | B-02 + F-03 | Backend + Frontend socket | WebSocket auth middleware ekle |
| 3 | B-03 | `backend/middleware/adminAuth.ts` | Debug loglarını kaldır |

### Faz 2 — Yüksek Öncelik — 3-5 Gün

| # | Bulgu | Dosya | Eylem |
|---|-------|-------|-------|
| 4 | W-01 | `backend/realtime/socket.ts` | Room-based broadcast uygula |
| 5 | F-04 | Frontend socket + hooks | Tüm debug loglarını temizle |
| 6 | F-02 | `AdminProtectedRoute.tsx` | Client-side role kontrolünü kaldır |
| 7 | B-04 | `backend/realtime/socket.ts` | emitApiMutation logunu guard altına al |
| 8 | F-05 | `frontend/utils/api.ts` | 401'de auto-logout ekle |

### Faz 3 — Orta Vadeli — 1-2 Hafta

| # | Bulgu | Dosya | Eylem |
|---|-------|-------|-------|
| 9 | S-02 | Tüm sayfalar | `alert()`/`confirm()` → Ant Design |
| 10 | S-03 | Incidents + Backend | Vardiya kontrolünü backend'e taşı |
| 11 | S-04 | `Incidents.tsx` | Tekrarlanan objeyi sabit olarak çıkar |
| 12 | B-05 | `server.ts` | Structured logger (Pino/Winston) |
| 13 | W-02/W-03 | Realtime hooks | Self-echo + notification optimizasyonu |

### Faz 4 — Uzun Vadeli — 2-4 Hafta

| # | Bulgu | Dosya | Eylem |
|---|-------|-------|-------|
| 14 | F-01 | Tüm auth akışı | httpOnly cookie'ye geçiş |
| 15 | B-06 | `jwt.ts` | Refresh token mekanizması |
| 16 | B-07 | `rateLimiter.ts` | Redis-backed rate limiting |
| 17 | B-08 | `visitorPublic.ts` | CAPTCHA entegrasyonu |

---

## Referanslar

- [OWASP WebSocket Security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#websockets)
- [Socket.IO Authentication](https://socket.io/docs/v4/middlewares/#sending-credentials)
- [OWASP JWT Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [MDN: httpOnly Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#security)

---

## Onay Bekleniyor

> [!IMPORTANT]
> Bu rapordaki düzeltmelere başlamadan önce hangi faz(lar)dan başlanması gerektiğini onaylayınız.
> Faz 1 düzeltmeleri mevcut iş akışını bozmadan uygulanabilir. Faz 4 (cookie geçişi) ise mimari değişiklik gerektirir.
