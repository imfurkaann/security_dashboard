# 📢 Profesyonel Bildirim Sistemi - Entegrasyon Rehberi

## 🎯 Sistem Özeti

Merkezi, ölçeklenebilir ve profesyonel bildirim sistemi. 4 farklı channel (Toast, Modal, Banner, Audio), 4 öncelik seviyesi, WebSocket entegrasyonu.

## 🏗️ Dosya Yapısı

```
frontend/src/
├── types/
│   └── notifications.ts              # Tip tanımları
├── config/
│   └── notificationConfigs.ts        # Bildirim konfigürasyonları
├── context/
│   └── NotificationContext.tsx       # Merkezi state
├── hooks/
│   ├── useNotification.ts            # Ana hook
│   └── useWebSocketNotifications.ts  # WebSocket entegrasyonu
├── components/
│   ├── NotificationManager.tsx       # Ana renderer
│   └── notifications/
│       ├── NotificationToast.tsx     # Toast component
│       ├── NotificationModal.tsx     # Modal component
│       └── NotificationBanner.tsx    # Banner component
```

## 📦 Kurulum Adımları

### 1️⃣ App.tsx'de Provider ve Manager Ekle

```tsx
import { NotificationProvider } from './context/NotificationContext';
import NotificationManager from './components/NotificationManager';

function App() {
  return (
    <NotificationProvider maxHistorySize={100}>
      <ConfigProvider locale={trTR}>
        <ThemeProvider>
          <NotificationManager />  {/* ← Ekle */}
          <Router>
            {/* Routes... */}
          </Router>
        </ThemeProvider>
      </ConfigProvider>
    </NotificationProvider>
  );
}
```

### 2️⃣ WebSocket Notifikasyonlarını Etkinleştir

Herhangi bir layout'ta (AdminSidebarLayout veya UserSidebarLayout):

```tsx
import { useWebSocketNotifications } from '../hooks/useWebSocketNotifications';

export default function AdminSidebarLayout() {
  // ← Bu satırı ekle
  useWebSocketNotifications();

  return (
    // ... JSX
  );
}
```

## 🎨 Kullanım Örnekleri

### Temel Kullanım

```tsx
import { useNotification } from '../hooks/useNotification';
import { NotificationType } from '../types/notifications';

export default function MyComponent() {
  const { notify, success, error, warning, info, critical } = useNotification();

  return (
    <button
      onClick={() => success('Başarılı!', 'Kayıt oluşturuldu')}
    >
      Kayıt Oluştur
    </button>
  );
}
```

### Önceden Tanımlanmış Tipli Bildirim

```tsx
const { notify } = useNotification();

// QR Ziyaretçi Kaydı
notify({
  type: NotificationType.QR_VISITOR_CHECKIN,
  title: 'Ziyaretçi Girişi',
  message: 'Ali Veli giriş yaptı',
});

// Sistem Hatası
notify({
  type: NotificationType.SYSTEM_ERROR,
  title: 'Hata!',
  message: 'Veritabanı bağlantısı kesildi',
});
```

### Aksiyonlu Bildirim

```tsx
const { notify } = useNotification();

notify({
  type: NotificationType.RECORD_CREATED,
  title: 'Yeni Kayıt',
  message: 'Araç kaydı oluşturuldu',
  action: {
    label: 'Gör',
    callback: () => {
      console.log('Kayda git');
      navigate(`/vehicles/${vehicleId}`);
    }
  }
});
```

### Kritik Bildirim (Acknowledge Gerekli)

```tsx
const { critical } = useNotification();

critical(
  'Sistem Hatası!',
  'Veritabanı bağlantısı kaybedildi. Sistem çalışmıyor.',
  () => {
    console.log('Kullanıcı anladığını onayladı');
    // Aksiyon al
  }
);
```

## 🎯 Bildirim Tipleri ve Otomatik Konfigürasyonlar

| Tip | Öncelik | Kanallar | Auto-Dismiss | Ses |
|-----|---------|----------|--------------|-----|
| `QR_VISITOR_CHECKIN` | Normal | Toast | 8s | ❌ |
| `QR_SGK_UPLOAD` | Normal | Toast | 8s | ❌ |
| `SYSTEM_ERROR` | Kritik | Modal, Banner, Audio | ❌ (Ack gerekli) | ✅ |
| `SYSTEM_WARNING` | Yüksek | Banner, Toast | 6s | ✅ |
| `SYSTEM_INFO` | Normal | Toast | 4s | ❌ |
| `RECORD_CREATED` | Normal | Toast | 5s | ❌ |
| `RECORD_UPDATED` | Normal | Toast | 5s | ❌ |
| `RECORD_DELETED` | Yüksek | Toast, Banner | 5s | ❌ |
| `DATA_SYNC` | Düşük | Toast | 3s | ❌ |
| `DATA_CONFLICT` | Yüksek | Modal, Banner | ❌ (Ack gerekli) | ❌ |
| `WHATSAPP_SENT` | Normal | Toast | 5s | ❌ |
| `WHATSAPP_FAILED` | Yüksek | Toast, Banner | 8s | ❌ |
| `ADMIN_ACTION` | Yüksek | Toast, Banner | 6s | ❌ |

## 🔧 Yeni Bildirim Tipi Ekleme

### 1. Type'ı tanımla

```tsx
// types/notifications.ts
export enum NotificationType {
  // ... mevcut tipiler
  MY_NEW_NOTIFICATION = 'my_new_notification',
}
```

### 2. Konfigürasyonu belirle

```tsx
// config/notificationConfigs.ts
export const notificationConfigs: Record<NotificationType, NotificationConfig> = {
  [NotificationType.MY_NEW_NOTIFICATION]: {
    type: NotificationType.MY_NEW_NOTIFICATION,
    priority: NotificationPriority.HIGH,
    channels: [NotificationChannel.TOAST, NotificationChannel.BANNER],
    autoDismissMs: 6000,
    icon: '🎯',
    sound: true,
    persistInHistory: true,
  },
};
```

### 3. WebSocket listener'a ekle (opsiyonel)

```tsx
// hooks/useWebSocketNotifications.ts
} else if (event.path.includes('/my-endpoint') && event.method === 'POST') {
  notify({
    type: NotificationType.MY_NEW_NOTIFICATION,
    title: 'Başlık',
    message: 'Mesaj',
  });
}
```

## 📊 Bildirim Kanalları

### Toast (Sağ üst)
- **Kullanım**: Düzenli, az önemli bildirimler
- **Özellik**: Sessiz, auto-dismiss, küçük

### Modal (Ortada)
- **Kullanım**: Kritik, uyarı veya onay gereken bildirimler
- **Özellik**: Backdrop, acknowledge gerekli, yapışkan

### Banner (Üstte)
- **Kullanım**: Önemli uyarılar, sistem durumu
- **Özellik**: Tam genişlik, dik, göze çarpıcı

### Audio
- **Kullanım**: Kritik bildirimlerde ses uyarısı
- **Özellik**: Web Audio API ile otomatik

## 🎨 Stil Kustomizasyonu

Bildirim rengini önceliğe göre otomatik olarak ayarlandığından, `getPriorityColorClasses` kullanıyor:

```tsx
const colors = getPriorityColorClasses(priority);
// Döner: { bg, border, text, icon } CSS sınıfları
```

## 🚀 İleri Seviye Özellikler

### Bildirim Geçmişi

```tsx
const { getHistory } = useNotification();

const allNotifications = getHistory();
// Kapatılan/eski bildirimleri göster
```

### Tüm Bildirimleri Temizle

```tsx
const { clearAll } = useNotification();

clearAll(); // Tüm bildirimleri sil
```

### Direktbildirim Ekleme

```tsx
const { addNotification } = useNotification();

const notificationId = addNotification({
  type: NotificationType.CUSTOM,
  priority: NotificationPriority.HIGH,
  channels: [NotificationChannel.MODAL],
  title: 'Custom Title',
  message: 'Custom Message',
  requiresAcknowledge: true,
  // ... diğer alanlar
});

// Daha sonra kaldır
removeNotification(notificationId);
```

## 🐛 Troubleshooting

### Bildirim görünmüyor
1. `NotificationProvider` App.tsx'de sarımlı mı?
2. `NotificationManager` render ediliyor mu?
3. Browser Console'da hata var mı?

### WebSocket bildirimleri gelmiyor
1. `useWebSocketNotifications()` hook'u layout'ta çalışıyor mu?
2. WebSocket bağlantısı aktif mi (tarayıcı F12 Network sekmesi)
3. Backend event emit ediyor mu (`emitApiMutation`)

### Ses çalmıyor
- Web Audio API tarayıcı tarafından bloke edilebilir
- Kullanıcı etkileşiminden sonra ses oynatmayı dene

## 📝 En İyi Uygulamalar

✅ **DOs:**
- Önemli işlemler için `notify()` kullan
- Kritik hatalar için `critical()` kullan
- Bildirim tiplerini merkezi olarak tutUn

❌ **DON'Ts:**
- Her eylem için Modal gösterme (kullanıcı deneyimini bozar)
- Ses bildirimleri çok sık oynatma
- Bildirimi manuel olarak barındırma (sistem zaten handle ediyor)

---

✨ **Sistem hazır!** Artık ölçeklenebilir, profesyonel bildirimler kullan!
