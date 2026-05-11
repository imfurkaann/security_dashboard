# Kayıt İndir Butonunu Farklı Sayfalara Ekleme Rehberi

## 📋 Özet
Bu rehber, Excel export işlevini yeni sayfalara ekleme adımlarını detaylı olarak açıklamaktadır. Limit dolduğunda bu MD dosyasına bakarak hızlıca uygulanabilecek işlemlerdir.

---

## 🎯 Eklenen Sayfalar (Mevcut Durum)

| Sayfa | Yol | Dosya |
|-------|-----|-------|
| Araç Kayıtları (User) | `/vehicle-records` | `VehicleRecords.tsx` |
| Araç Kayıtları (Admin) | `/admin/vehicle-records` | `AdminVehicleRecords.tsx` |
| Ziyaretçi Kayıtları (Admin) | `/admin/visitor-records` | `AdminVisitorRecords.tsx` |
| Müdür Kayıtları (Admin) | `/admin/manager-records` | `AdminManagerRecords.tsx` |

---

## 🔧 Adım Adım Ekleme Süreci

### **1️⃣ IMPORT'LAR EKLEME** (Dosyanın başı, line ~1-15)

```typescript
// Mevcut import'lar:
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { formatDate, formatTime } from '../utils/dateUtils';
// ...

// ➕ EKLENECEK:
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
```

**Dikkat Noktaları:**
- `ExcelJS` - Excel dosyası oluşturma
- `JSZip` - Çoklu dosyaları ZIP'leme
- Bu import'lar `axios` ve `formatDate`'den sonra gelmeli

---

### **2️⃣ STATE EKLE** (Default states'den sonra, line ~20-40)

Mevcut:
```typescript
const [records, setRecords] = useState<T[]>([]);
const [loading, setLoading] = useState(true);
const [textPreview, setTextPreview] = useState<...>(null);
```

**Eklenecek:**
```typescript
const [isExporting, setIsExporting] = useState(false);
```

**Neden?**
- Export işlemi sırasında butonu disable etmek için
- Race condition'u engellemek için
- Loading spinner göstermek için

---

### **3️⃣ EXPORT HANDLER FONKSIYONU EKLE** (groupedByDay useMemo'dan sonra, line ~180-220)

#### **3.1 - Handler İçeriği Şablonu**

```typescript
const handleDownloadRecords = useCallback(async () => {
    // ✅ ADIM 1: Race condition guard
    if (isExporting) {
        return;
    }

    // ✅ ADIM 2: Silinmiş kayıtları filtrele
    const exportableRecords = filteredRecords.filter(record => !record.deleted_at);

    if (exportableRecords.length === 0) {
        alert('İndirilecek kayıt bulunamadı.');
        return;
    }

    // ✅ ADIM 3: Export state'ini true yap
    setIsExporting(true);

    try {
        // ✅ ADIM 4: Gün bazında grupla
        const exportGroupsMap = new Map<string, T[]>();
        exportableRecords.forEach((record) => {
            const dayKey = dayjs(record.entry_date).format('YYYY-MM-DD');
            // veya: const dayKey = dayjs(record.given_date).format('YYYY-MM-DD');
            if (!exportGroupsMap.has(dayKey)) {
                exportGroupsMap.set(dayKey, []);
            }
            exportGroupsMap.get(dayKey)!.push(record);
        });

        // ✅ ADIM 5: Grupları sırala ve formatla
        const exportGroups = Array.from(exportGroupsMap.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([dayKey, items]) => ({
                dayKey,
                dayLabel: dayjs(dayKey).format('DD MMMM YYYY dddd'),
                records: [...items].sort((a, b) => {
                    const dateCompare = a.entry_date.localeCompare(b.entry_date);
                    if (dateCompare !== 0) return dateCompare;
                    return a.entry_time.localeCompare(b.entry_time);
                })
            }));

        // ✅ ADIM 6: Excel başlık satırını tanımla
        const headerRow = [
            'Sütun1',
            'Sütun2',
            'Sütun3',
            // ... sayfaya uygun sütunlar
        ];

        // ✅ ADIM 7: Sütun genişliklerini tanımla
        const worksheetColumnWidths = [18, 16, 20, ...];

        // ✅ ADIM 8: Dosya adı suffixini oluştur
        const plateSuffix = filters.vehicle_plate
            ? `_${filters.vehicle_plate.replace(/[^a-zA-Z0-9_-]/g, '')}`
            : '';

        // ✅ ADIM 9: Her gün için Excel oluştur
        const dayFiles: Array<{ fileName: string; data: ArrayBuffer }> = [];

        for (const dayGroup of exportGroups) {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sheet Adı');

            worksheet.columns = worksheetColumnWidths.map(width => ({ width }));

            // ✅ ADIM 10: Header satırını stillendir
            const header = worksheet.addRow(headerRow);
            header.height = 24;
            header.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1D4ED8' } // Blue
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
                };
            });

            // ✅ ADIM 11: Veri satırlarını ekle
            dayGroup.records.forEach((record) => {
                const row = worksheet.addRow([
                    record.field1 || '-',
                    record.field2 || '-',
                    formatDate(record.date_field),
                    // ... kayıtlara uygun alanlar
                ]);

                row.eachCell((cell) => {
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                    };
                });
            });

            // ✅ ADIM 12: Workbook'u buffer'a çevir
            const formattedDayForFileName = dayjs(dayGroup.dayKey).format('DD-MM-YYYY');
            const fileName = `Adi_${formattedDayForFileName}.xlsx`;
            const workbookBuffer = await workbook.xlsx.writeBuffer();
            dayFiles.push({ fileName, data: workbookBuffer as ArrayBuffer });
        }

        // ✅ ADIM 13: Download helper fonksiyonu
        const triggerDownload = (blob: Blob, fileName: string) => {
            return new Promise<void>((resolve) => {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                
                // ⚠️ 500ms delay: Tarayıcının download başlamasını bekleme
                setTimeout(() => {
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                    resolve();
                }, 500);
            });
        };

        // ✅ ADIM 14: Single file veya ZIP'leme
        if (dayFiles.length === 1) {
            const [singleFile] = dayFiles;
            const blob = new Blob([singleFile.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            await triggerDownload(blob, singleFile.fileName);
            return;
        }

        const zip = new JSZip();
        dayFiles.forEach((file) => {
            zip.file(file.fileName, file.data);
        });

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const timestamp = dayjs().format('DD-MM-YYYY_HH-mm');
        await triggerDownload(zipBlob, `Dosya_Adi_Toplu_${timestamp}.zip`);

    } catch (error) {
        console.error('Export hatası:', error);
        alert('Kayıtlar indirilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
    } finally {
        setIsExporting(false);
    }

    // ✅ DEPENDENCY ARRAY (ÇOK ÖNEMLİ!)
}, [filteredRecords, filters.vehicle_plate, isExporting]);
// 📌 NOT: filters.vehicle_plate yerine sayfaya uygun filter ekle
```

---

### **4️⃣ HEADER'A BUTON EKLE** (Header section'da)

#### **4.1 - Buton JSX Kodu**

```typescript
<button
    onClick={handleDownloadRecords}
    disabled={isExporting || loading || filteredRecords.length === 0}
    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg transition shadow-md hover:shadow-lg text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
>
    {isExporting ? (
        <>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            İndiriliyor...
        </>
    ) : (
        <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Kayıt İndir
        </>
    )}
</button>
```

**Styling:**
- `bg-emerald-600` → Yeşil (standart)
- `hover:bg-emerald-700` → Hover durumu
- `disabled:opacity-50` → Disabled when exporting/loading
- `gap-2` → Icon ve text arası boşluk

**Butonun Yerleşimi:**
- Admin pages: Header'ın `flex lg:flex-row` sectionında, diğer butonlarla aynı hizada
- User pages: Header'ın sağ üstü

---

## ⚠️ DİKKAT EDİLECEK NOKTALAR

### **1. Date Field İsmi**
Her sayfanın farklı date field'ı vardır:
- **Vehicles/AdminVehicles**: `given_date` + `given_time`
- **Visitors**: `entry_date` + `entry_time`
- **Managers**: `entry_date` + `entry_time`

```typescript
// Kullanmadan ÖNCE kontrol et:
const dayKey = dayjs(record.DOĞRU_FIELD_ADI).format('YYYY-MM-DD');
```

### **2. Deleted Records Filtering**
```typescript
// MUTLAKA include et:
const exportableRecords = filteredRecords.filter(record => !record.deleted_at);
```

### **3. Race Condition Guard**
```typescript
// Handler'ın en başında:
if (isExporting) {
    return;
}
```

### **4. Dependency Array**
```typescript
// ⚠️ ÇOK ÖNEMLİ: Yapılandırmayı kontrol et
}, [filteredRecords, filters.RELEVANT_FILTER, isExporting]);
```

### **5. Browser Download Policy**
```typescript
// 500ms delay ŞART:
setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    resolve();
}, 500); // ← Bu delay tarayıcının download policy'si için gerekli
```

### **6. Excel Kolon Formatı**
- Header satırını sayfaya uygun sütunlarla tanımla
- `worksheetColumnWidths` dizisi kolon sayısıyla eşleş
- Her record row'unda field sırasını doğru tut

---

## 📊 Sayfa Özelleştirmesi Örneği

### **AdminVisitorRecords için:**

```typescript
// 1. Date field'ı
const dayKey = dayjs(record.entry_date).format('YYYY-MM-DD');

// 2. Header satırı
const headerRow = [
    'Kapı',
    'Araç Plakası',
    'İsim Soyisim',
    'Firma Adı',
    'Giriş Tarihi',
    'Çıkış Tarihi',
    // ...
];

// 3. Column widths (header sayısına eşit)
const worksheetColumnWidths = [14, 14, 18, 18, 14, 14, ...];

// 4. Row data
const row = worksheet.addRow([
    record.gate || '-',
    record.vehicle_plate || '-',
    record.full_name || '-',
    record.company_name || '-',
    formatDate(record.entry_date),
    formatDate(record.exit_date),
    // ...
]);

// 5. File adı
const fileName = `Ziyaretci_Kayitlari_${formattedDayForFileName}.xlsx`;

// 6. Dependency array
}, [filteredRecords, isExporting]); // visitor-records'ta filter yok
```

---

## 🔍 Test Adımları

Yeni sayfaya ekledikten sonra:

```bash
# 1. Build
npm run build

# 2. Tarayıcı açıp sayfaya git
http://localhost:5173/admin/sayfa-adi

# 3. Filtrele ve "Kayıt İndir" butonuna tıkla
# 4. Tek gün → .xlsx, Çok gün → .zip indirilmeli

# 5. Console'da hata var mı kontrol et (F12)

# 6. Excel dosyasını aç ve format doğru mu kontrol et
```

---

## 📝 Checklist (Yeni Sayfa İçin)

- [ ] ExcelJS ve JSZip import'larını ekle
- [ ] `isExporting` state'ini ekle
- [ ] `handleDownloadRecords()` fonksiyonunu ekle (şablondan)
- [ ] Date field ismini doğrula (`given_date` vs `entry_date`)
- [ ] Header satırını sayfaya uygun yap
- [ ] Column widths sayısını eşleştir
- [ ] Row data'sını doğru field'larla doldur
- [ ] File adını anlamlı yap
- [ ] Dependency array'i kontrol et
- [ ] Header'a buton JSX'ini ekle (konum uygun mu?)
- [ ] `npm run build` yap
- [ ] Tarayıcıda test et (filtrele + indir)
- [ ] Excel dosyasında format ve data doğru mu kontrol et

---

## 🎨 Dosya Adı Standardı

```
Araç Kayıtları:           Arac_Kayitlari_DD-MM-YYYY.xlsx
Ziyaretçi Kayıtları:      Ziyaretci_Kayitlari_DD-MM-YYYY.xlsx
Müdür Kayıtları:          Mudir_Kayitlari_DD-MM-YYYY.xlsx
Çoklu gün ZIP:           Dosya_Adi_Toplu_DD-MM-YYYY_HH-mm.zip
```

---

## 🚀 Hızlı Referans Komutu

Yeni sayfa için eksik olan `handleDownloadRecords` fonksiyonunu bulmak:

```bash
# Tamamlanan bir sayfaya (AdminVisitorRecords) bak:
grep -n "handleDownloadRecords" frontend/src/pages/AdminVisitorRecords.tsx

# Output'tan fonksiyonun başlangıç satırını bul
# O satırdan başlayarak kopyala ve yeni sayfaya yapıştır
```

---

## 📚 Bağlantılı Dosyalar

- **Tamamlanan Örnekler:**
  - `VehicleRecords.tsx` (User page)
  - `AdminVehicleRecords.tsx` (Admin page - araç)
  - `AdminVisitorRecords.tsx` (Admin page - ziyaretçi)
  - `AdminManagerRecords.tsx` (Admin page - müdür)

- **Eklenmesi Gereken Dosyalar:**
  - `AdminIncidentRecords.tsx`
  - `AdminFireAlarmRecords.tsx`
  - Diğer record sayfaları

---

## 💾 Kaydedilecek Bilgiler

Limit dolduğunda bu dosya üzerine gelen sayfalara bakarak:
1. ✅ Aynı import'ları ekle
2. ✅ Aynı state ekle
3. ✅ Şablondan fonksiyonu al ve özelleştir (date field + header + widths)
4. ✅ Header'a buton ekle
5. ✅ Build + test yap

**HER SAYFAYA EKLEMEK ~15-20 dakika alıyor. Bu rehber sayesinde hızlı halledebileceksin!**
