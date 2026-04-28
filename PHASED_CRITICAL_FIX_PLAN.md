# Faz Bazli Kritik Duzeltme Plani

Tarih: 28 Nisan 2026
Kapsam: Kayit akislarindaki 5 kritik konu icin asamali uygulama plani
Durum: Sadece plan, kod degisikligi yapilmadi

---

## Hedef

Bu dokuman, asagidaki kritik basliklari risk sirasina gore fazlara boler:

1. Ziyaretci kaydi transaction/try-catch guvenligi
2. Yangin alarmi transaction guvenligi
3. QR ziyaretci kaydi transaction ve tutarlilik guvenligi
4. Arac kaydi transaction akisi duzeltmesi
5. SGK dosya yukleme cleanup ve orphan-file riski

---

## Faz 0 - Hazirlik ve Guvenli Cikis Plani

Amac: Uygulama degisikliginden once guvenli uygulama zemini hazirlamak.

Yapilacaklar:
- Etkilenen endpointleri ve controller fonksiyonlarini dondur:
  - `visitorController.createVisitorRecord`
  - `fireAlarmController.createFireAlarm`
  - `visitorPublicController.createQrVisitorRecord`
  - `vehicleController.createVehicleRecord`
  - `sgkController.createSgkRecord` ve ilgili update/upload akislar
- Mevcut hata ve basari log formatlarini not et (karsilastirma icin baseline).
- DB ve upload klasoru icin geri donus plani netlestir:
  - DB rollback stratejisi
  - Dosya sistemi cleanup stratejisi
- Kisa bir smoke test checklist hazirla (her endpoint icin 1 basarili + 1 hatali senaryo).

Cikti:
- Baseline checklist
- Deploy sonrasi kontrol listesi

Tamamlanma Kriteri:
- Tum etkilenen endpointler icin mevcut davranis yazili halde var.

---

## Faz 1 - Transaction Cekirdegi (En Kritik)

Amac: Veri tutarliligini bozabilecek transaction acikliklarini kapatmak.

Yapilacaklar:
- `createVisitorRecord` icinde tam `try/catch/finally` transaction sarmali uygula.
- `createFireAlarm` icin transaction yapisi ekle.
- `createQrVisitorRecord` icin transaction + hata yakalama + rollback ekle.
- Her birinde su akisi zorunlu olsun:
  1. `client = await pool.connect()`
  2. `BEGIN`
  3. Tum DB write islemleri
  4. `COMMIT`
  5. Hata durumunda `ROLLBACK`
  6. `finally` icinde `client.release()`

Cikti:
- Uc endpointte standart transaction deseni
- Acik transaction riskinin kapatilmasi

Tamamlanma Kriteri:
- Bilincli hata enjekte edildiginde rollback calisiyor.
- Open transaction birikimi gozukmuyor.

---

## Faz 2 - Arac Kaydi Transaction Akis Sertlestirme

Amac: `BEGIN/COMMIT/ROLLBACK` sirasini deterministik hale getirmek.

Yapilacaklar:
- `createVehicleRecord` icindeki transaction baslangic noktasi `try` icine alinacak.
- `COMMIT` sonrasi olasi hatalar rollback tetiklemeyecek sekilde akis ayrilacak.
- DB write adimlari ile DB disi adimlar (mesaj olusturma, event gibi) net ayrilacak.

Cikti:
- Arac kaydinda tek ve guvenli transaction yolu
- Yan etkiler nedeniyle rollback karmasasinin engellenmesi

Tamamlanma Kriteri:
- COMMIT sonrasi hata olussa bile DB tarafi tutarli kaliyor.

---

## Faz 3 - SGK Upload Dosya Tutarliligi

Amac: DB rollback ile dosya sistemi cleanup arasindaki yarim kalmis durumlari onlemek.

Yapilacaklar:
- Basarisiz transactionda dosya cleanup akisini idempotent hale getir.
- Cleanup adimlarina guvenli kontrol ekle:
  - Dosya var mi kontrolu
  - Cift silme durumunda hatayi yutmayan ama akisi bozmayan loglama
- Gerekirse gecici dosya/kalici dosya gecis modeli tanimla:
  - Once temp klasore yaz
  - COMMIT sonrasi final klasore tasi

Cikti:
- Orphan dosya riskinde belirgin azalma
- Hata durumunda on gorulebilir cleanup davranisi

Tamamlanma Kriteri:
- Yukleme ortasinda hata simulasyonunda diskte beklenmeyen dosya kalmiyor.

---

## Faz 4 - Event, Audit ve Islemsel Tutarlilik

Amac: DB yazimi, audit ve websocket olaylari arasinda tutarli siralama kurmak.

Yapilacaklar:
- Audit log yazim sirasini standartlastir:
  - Kritik durumda transaction ile birlikte veya garanti mekanizmasiyla
- Websocket/event emit adimlarini veri commit sonrasinda tek ve kontrollu noktaya cek.
- "DB'de yok ama bildirim geldi" sinifindaki tutarsizliklari engelle.

Cikti:
- Bildirimler ile DB kaydi arasinda guvenilir uyum
- Operasyon ekrani ve raporlar arasinda fark azalmasi

Tamamlanma Kriteri:
- Basarili kayitlarda event duzenli geliyor, basarisiz kayitlarda gelmiyor.

---

## Faz 5 - Test, Dogrulama, Canary Yayini

Amac: Degisikliklerin guvenli sekilde canliya alinmasi.

Yapilacaklar:
- Her endpoint icin minimum test matrisi:
  - Basarili write
  - Validation hatasi
  - DB hatasi (zorunlu rollback)
  - Eszamanli istek (race kontrolu)
- Loglardan su metrikleri izle:
  - Transaction rollback sayisi
  - 500 hata orani
  - Ortalama yanit suresi
  - SGK orphan dosya sayisi
- Kademeli yayin:
  - Once gelistirme
  - Sonra sinirli canary
  - Sonra tam gecis

Cikti:
- Yayin onayi ve takip metrik raporu

Tamamlanma Kriteri:
- Kritik endpointlerde regresyon yok
- Hata oranlari kabul esiginin altinda

---

## Oncelik Sirasi (Uygulama Tavsiyesi)

1. Faz 1 (Ziyaretci + Yangin + QR Ziyaretci)
2. Faz 2 (Arac)
3. Faz 3 (SGK dosya)
4. Faz 4 (Event/Audit tutarliligi)
5. Faz 5 (Test + canary)

---

## Kisa Not

Bu plan, "once guvenlik ve tutarlilik" prensibiyle yazildi.
Kod degisikligine gecildiginde her faz ayri pull request olarak ilerletilmeli ve faz sonunda smoke test zorunlu olmalidir.
