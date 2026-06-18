# Profesyonel Modal Tasarım Dili ve Algoritması

Bu plan, web uygulamasındaki tüm modalları modern web standartlarına (Stripe, Vercel, Linear gibi) uygun hale getirmek için geliştirilen ortak tasarım dilini ve modal algoritmasını tanımlar.

---

## 💎 Profesyonel Modal Algoritması ve Standartları

Profesyonel bir modal deneyimi sadece "güzel görünmek" değil, kusursuz bir kullanıcı deneyimi (UX) ve hatasız bir kod yapısı sunmaktır. Tasarladığımız bileşen şu standartlara sahip olacaktır:

1. **Gövde Kaydırma Kilidi (Scroll Lock)**:
   - *Algoritma*: Modal açıldığında ana sayfanın arka planda kaydırılması engellenecektir (`document.body.style.overflow = 'hidden'`). Modal kapatıldığında bu kilit kaldırılacaktır.
   
2. **Klavye Erişilebilirliği (Keyboard Navigation)**:
   - *Algoritma*: `Escape` tuşuna basıldığında modal otomatik olarak kapanacaktır. Ancak veri kaybını önlemek için form modallarında bir uyarı veya koruma parametresi bulunacaktır.

3. **Odak Yönetimi (Focus Trap)**:
   - *Algoritma*: Modal açıldığında odak (focus) modal içindeki ilk aktif elemana (örneğin ilk input) geçecektir. Kullanıcı `Tab` tuşuna bastığında odak modalın dışına çıkamayacaktır.

4. **Akıllı Arka Plan Kapatma (Backdrop Click Protection)**:
   - *Algoritma*: Veri girişi veya form içeren modallarda yanlışlıkla dışarı tıklayarak formun kapanıp verilerin kaybolmasını önlemek için arka plana tıklama ile kapatma devre dışı bırakılacaktır. Bilgi veya WhatsApp paylaşım modallarında ise arka plana tıklanarak kolayca kapatılabilecektir.

5. **Donanım Hızlandırmalı Animasyonlar**:
   - *Tasarım*: CSS geçişleri (`transition`) ve dönüşümleri (`transform`) GPU tarafından işlenerek 60FPS akıcılık sağlanacaktır (Arka plan için yumuşak opaklık artışı, modal kutusu için `scale-95` -> `scale-100` büyüme etkisi).

6. **Duyarlılık (Responsive Layout)**:
   - Mobilde ekranı kaplayacak veya alt taraftan yukarı kayan (bottom-sheet) tarza yaklaşacak, masaüstünde ise ekranın ortasında şık bir kart görünümü alacaktır.

---

## User Review Required

> [!IMPORTANT]
> **Erişilebilirlik ve Standardizasyon**: Bu modal bileşeni, tüm sayfaların kolayca geçiş yapabileceği genel bir API sunacaktır. Modalı entegre ederken Lucide React ikon kütüphanesini kullanarak görsel kaliteyi zirveye taşıyacağız.

---

## Open Questions

> [!NOTE]
> 1. **Müdür Listesi Girişi**: Araç teslim formunda listede olmayan müdürler için "Elle Gir" seçeneği var. Bu tasarımı modal içinde akıcı bir geçişle (slide animation veya inline form) daha modern hale getireceğiz. Bu konuda bir tercihiniz var mı?
> 2. **WhatsApp Modal**: WhatsApp modalı başarılı bir şekilde araç kaydı yapıldığında açılıyor. Bu modalın sağ üstünde kapatma ikonu olsun mu, yoksa sadece altındaki "Kapat" butonu yeterli mi?

---

## Proposed Changes

### Frontend Components

#### [NEW] [Modal.tsx](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/components/Modal.tsx)
- Profesyonel modal standartlarını barındıran React bileşeni.
- Props tanımı:
  ```typescript
  interface ModalProps {
      isOpen: boolean;
      onClose: () => void;
      title: string;
      subtitle?: string;
      icon?: React.ReactNode;
      size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
      closeOnBackdropClick?: boolean;
      children: React.ReactNode;
  }
  ```

---

### Frontend Pages

#### [MODIFY] [Vehicles.tsx](file:///c:/Users/imfurkaann/Documents/projects/security/frontend/src/pages/Vehicles.tsx)
- Sayfadaki tüm modal div blokları (`showModal`, `showEditModal`, `showWhatsAppModal`, `textPreview`) kaldırılarak yeni `Modal` bileşenine geçirilecektir.
- Form alanları (Select kutuları, inputlar, textarea ve zaman seçiciler) modern Tailwind sınıfları ile sıfırdan tasarlanacaktır.
- Butonlar ve geri alma aksiyonları için micro-hover animasyonları eklenecektir.

---

## Verification Plan

### Automated Tests
- Projenin TypeScript tipleri ve build durumunu kontrol etmek için:
  ```powershell
  npm run build
  ```

### Manual Verification
- `http://localhost:5173/vehicles` adresinde:
  1. Araç Teslim Et modalı açıldığında Esc tuşu ve backdrop tıklama davranışlarını kontrol edeceğiz.
  2. Form focus durumlarındaki mavi/mor gölgeli halkaları (glow effect) inceleyeceğiz.
  3. Koyu ve Açık temalarda kontrast oranının kusursuzluğunu doğrulayacağız.
