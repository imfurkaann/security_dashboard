# WhatsApp Bildirim Entegrasyonu

Bu döküman, Güvenlik Yönetim Sistemi'ne WhatsApp bildirimlerini nasıl entegre edeceğinizi açıklar.

## 🎯 Özellikler

WhatsApp bildirimleri aşağıdaki durumlarda otomatik olarak gönderilir:

1. **Araç Kayıtları** - Her araç teslim edildiğinde (ZORUNLU)
2. **Ziyaretçi Kayıtları** - Sadece "WhatsApp Bildirimi Gönder" checkbox'ı işaretliyse (OPSİYONEL)
3. **Yangın Alarmı** - Her yangın alarmı kaydedildiğinde (ZORUNLU)

## 📋 Gereksinimler

1. **Twilio Hesabı** - WhatsApp Business API için
2. **WhatsApp Business Onayı** - Twilio üzerinden
3. **Grup Numarası** - Bildirimlerin gönderileceği WhatsApp grubu

## 🚀 Kurulum Adımları

### 1. Twilio Hesabı Oluşturma

1. [Twilio Console](https://www.twilio.com/console) adresine gidin
2. Ücretsiz hesap oluşturun (trial hesap test için yeterli)
3. Dashboard'dan şu bilgileri alın:
   - `Account SID`
   - `Auth Token`

### 2. WhatsApp Sandbox Kurulumu (Test İçin)

**Test aşaması için Twilio Sandbox kullanabilirsiniz:**

1. Twilio Console → **Messaging** → **Try it out** → **Send a WhatsApp message**
2. QR kodu telefonunuzla okutun veya verilen numaraya belirtilen kodu gönderin
3. Sandbox numaranızı not edin (örn: `whatsapp:+14155238886`)

### 3. Production İçin WhatsApp Business API

**Gerçek kullanım için WhatsApp Business API gereklidir:**

1. Twilio Console → **Messaging** → **WhatsApp** → **Senders**
2. İşletme bilgilerinizi doldurun
3. Facebook Business Manager ile entegre edin
4. Onay bekleyin (1-2 hafta sürebilir)

### 4. Backend Konfigürasyonu

**`.env` dosyasını güncelleyin:**

```bash
# WhatsApp Bildirimleri
WHATSAPP_ENABLED=true
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
WHATSAPP_GROUP_NUMBER=whatsapp:+905xxxxxxxxx
```

**Açıklamalar:**

- `WHATSAPP_ENABLED`: `true` yaparak bildirimleri aktifleştirin
- `TWILIO_ACCOUNT_SID`: Twilio Dashboard'dan Account SID
- `TWILIO_AUTH_TOKEN`: Twilio Dashboard'dan Auth Token
- `TWILIO_WHATSAPP_FROM`: Twilio Sandbox numarası (veya onaylanmış numara)
- `WHATSAPP_GROUP_NUMBER`: Bildirimlerin gönderileceği WhatsApp numarası

### 5. Twilio Paketini Yükleme

```bash
cd backend
npm install twilio
```

### 6. Docker ile Kullanım

**`.env` dosyasını Docker compose ile kullanmak için:**

```bash
# Docker compose'u başlatın
docker-compose down
docker-compose up -d --build
```

Docker ortamı otomatik olarak `.env` dosyasındaki değişkenleri kullanır.

## 📱 Test Etme

### Test Mesajı Gönderme

Backend'e test endpoint'i eklenmiştir:

```bash
# Test mesajı gönder
curl -X POST http://localhost:5000/api/test/whatsapp \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Manuel Test

1. **Araç Teslimi**: Vehicles sayfasından yeni araç kaydı oluşturun
2. **Ziyaretçi Girişi**: Visitors sayfasından "WhatsApp Bildirimi Gönder" checkbox'ını işaretleyin
3. **Yangın Alarmı**: Incidents sayfasından Fire Alarm kaydı oluşturun

## 📄 Mesaj Formatları

### Araç Kaydı

```
🚗 *YENİ ARAÇ KAYDI*

📌 Plaka: 34ABC123
👤 Alan Müdür: Ahmet Yılmaz
📅 Tarih: 2024-01-15
🕐 Saat: 14:30:00

_Güvenlik Yönetim Sistemi_
```

### Ziyaretçi Kaydı

```
👤 *YENİ ZİYARETÇİ KAYDI*

📌 Ad Soyad: Mehmet Demir
🏢 Firma: ABC Ltd.
👥 Ziyaret Edilen: Fatma Kaya
🚗 Plaka: 06XYZ789
📅 Tarih: 2024-01-15
🕐 Saat: 09:00:00

_Güvenlik Yönetim Sistemi_
```

### Yangın Alarmı

```
🚨 *YANGIN ALARMI KAYDI*

⚠️ ALARM NUMARASI: A-123
📍 Konum: Bina A - 3. Kat
🕐 Alarm Saati: 2024-01-15 16:45:00
📝 Notlar: Test alarmı

_Güvenlik Yönetim Sistemi_
```

## ⚙️ İleri Düzey Ayarlar

### Grup Yerine Bireysel Numaralara Gönderme

Birden fazla kişiye ayrı ayrı gönderim için `whatsapp.ts` dosyasını düzenleyin:

```typescript
const recipients = [
    'whatsapp:+905xxxxxxxxx',
    'whatsapp:+905yyyyyyyyy'
];

for (const recipient of recipients) {
    await client.messages.create({
        from: TWILIO_WHATSAPP_FROM,
        to: recipient,
        body: message
    });
}
```

### Hata Yönetimi

WhatsApp hataları kayıt işlemlerini engellemez. Hatalar sadece console'a loglanır:

```typescript
try {
    await sendVehicleRecordNotification(data);
} catch (error) {
    console.error('WhatsApp bildirim hatası:', error);
    // İşlem devam eder
}
```

## 💰 Maliyet

### Twilio Sandbox (Test)

- **Ücretsiz** - Sınırlı kullanım
- 24 saat oturum süresi (her 24 saatte bir yeniden bağlanma gerekir)

### Twilio WhatsApp Business API

- **Conversation-based pricing**
- İlk 1000 conversation/ay: Ücretsiz
- Sonrası: ~$0.005 - $0.01 per conversation
- [Detaylı Fiyatlandırma](https://www.twilio.com/whatsapp/pricing)

## 🔒 Güvenlik

1. **API Anahtarları**: `.env` dosyasını asla commit etmeyin
2. **Environment Variables**: Production'da güvenli değişken yönetimi kullanın
3. **Rate Limiting**: Twilio otomatik rate limiting uygular
4. **Logging**: Hassas bilgileri loglara yazmayın

## 🐛 Sorun Giderme

### "WhatsApp bildirimi gönderilemedi" Hatası

1. `.env` dosyasındaki değerleri kontrol edin
2. `WHATSAPP_ENABLED=true` olduğundan emin olun
3. Twilio credentials'ları doğrulayın
4. Sandbox kullanıyorsanız 24 saatlik sürenin dolup dolmadığını kontrol edin

### "Twilio yüklenemedi" Hatası

```bash
cd backend
npm install twilio
```

### Mesaj Gönderilmiyor

1. Console loglarını kontrol edin: `docker-compose logs -f backend`
2. Twilio Console → **Monitor** → **Logs** kısmından hataları görüntüleyin
3. WhatsApp numarasının doğru formatta olduğundan emin olun (`whatsapp:+905xxxxxxxxx`)

## 📚 Kaynaklar

- [Twilio WhatsApp Docs](https://www.twilio.com/docs/whatsapp)
- [Twilio Node.js SDK](https://www.twilio.com/docs/libraries/node)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)

## 🎯 Devre Dışı Bırakma

WhatsApp bildirimlerini devre dışı bırakmak için:

```bash
WHATSAPP_ENABLED=false
```

Bu durumda backend mesaj göndermeyi atlar ve normal işlemlere devam eder.
