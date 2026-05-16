# Kayıt Filtreleme, Sonsuz Kaydırma ve Excel İndirme Rehberi

Bu rehber, kayıt listesi olan sayfalarda aynı davranışı tekrar kurmak için hazırlanmıştır. Amaç, ziyaretçi sayfasında çalışan mantığı araç ve benzeri kayıt sayfalarına birebir taşımaktır.

## Kapsam

Bu yapı şu sayfalarda uygulanır:

- User ziyaretçi kayıtları: `frontend/src/pages/VisitorRecords.tsx`
- User araç kayıtları: `frontend/src/pages/VehicleRecords.tsx`
- Admin araç kayıtları: `frontend/src/pages/AdminVehicleRecords.tsx`
- Gerekirse diğer kayıt sayfaları

## Temel Davranış

1. İlk yüklemede tüm kayıtlar tek seferde çekilmez.
2. Kayıtlar parça parça gelir, genelde `PAGE_SIZE = 200` kullanılır.
3. Kullanıcı aşağı kaydırdıkça yeni kayıtlar yüklenir.
4. Filtre varsa sayfa, eksik veri problemi olmaması için tüm veriyi çeker veya doğru backend parametresi ile geniş set ister.
5. Kayıt indirme işlemi, seçilen tarih aralığına bağlı çalışır.

## Backend Sözleşmesi

Listeleme endpoint’i şu parametreleri desteklemelidir:

- `limit`
- `offset`
- `unlimited=true`
- `includeDeleted=true` veya ilgili sayfanın ihtiyacına göre benzeri

Örnek:

```text
GET /api/vehicles/records?includeDeleted=true&limit=200&offset=0
GET /api/vehicles/records?includeDeleted=true&unlimited=true
```

Backend tarafında sıralama, sayfanın beklediği mantıkla yapılmalıdır. Örneğin:

- ziyaretçi kayıtlarında `entry_date DESC, entry_time DESC`
- araç kayıtlarında `given_date DESC, given_time DESC`

Bu sıralama değişirse sonsuz kaydırma beklenmeyen tekrarlar veya eksik sayfalar üretebilir.

## Frontend Veri Çekme Mantığı

### 1. State yapısı

Bu state’ler genelde gerekir:

```tsx
const [records, setRecords] = useState<T[]>([]);
const [loading, setLoading] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);
const [hasMore, setHasMore] = useState(true);
const [isExporting, setIsExporting] = useState(false);
```

### 2. Sayfa boyutu

```tsx
const PAGE_SIZE = 200;
```

Bu değer küçük tutulursa scroll daha sık çalışır, büyük tutulursa ilk yükleme ağırlaşır.

### 3. `fetchData` imzası

Önerilen yapı:

```tsx
const fetchData = useCallback(async (offset = 0, append = false) => {
  // ...
}, [filters]);
```

Davranış:

- `offset = 0` ilk yükleme için kullanılır.
- `append = true` eski kayıtların sonuna ekleme yapar.
- Filtre aktifse çoğu senaryoda `unlimited=true` ile tam veri alınır.

### 4. Filtre aktif mi kontrolü

Filtre alanlarının içinde boş olmayan veya `all` olmayan değer varsa filtre aktif sayılır:

```tsx
const anyFilterApplied = Object.values(filters).some((value) => value !== '' && value !== 'all');
```

Bu kontrolün amacı şudur:

- Filtre uygulandığında sayfalama ile eksik sonuç göstermemek
- Filtrelenmiş görünümde doğru sıralamayı korumak

### 5. Veri çekme akışı

Genel akış:

```tsx
if (anyFilterApplied) {
  const res = await api.get('/.../records?includeDeleted=true&unlimited=true');
  setRecords(res.data || []);
  setHasMore(false);
  return;
}

const res = await api.get(`/.../records?includeDeleted=true&limit=${PAGE_SIZE}&offset=${offset}`);
const fetched = res.data || [];

if (append) {
  setRecords(prev => [...prev, ...fetched]);
} else {
  setRecords(fetched);
}

setHasMore(fetched.length === PAGE_SIZE);
```

## Sonsuz Kaydırma Mantığı

### 1. Scroll alanı

Listeyi saran ana container `ref` ile izlenir:

```tsx
const tableScrollRef = useRef<HTMLDivElement>(null);
```

### 2. Container scroll event

Scroll aşağıya yaklaşınca yeni veri yüklenir:

```tsx
const threshold = 300;
const remaining = node.scrollHeight - node.clientHeight - node.scrollTop;

if (remaining < threshold) {
  setLoadingMore(true);
  void fetchData(records.length, true);
}
```

### 3. Window scroll fallback

Bazı sayfalarda ana sayfa scroll’u daha baskın olur. Bu yüzden fallback eklenir:

```tsx
window.addEventListener('scroll', onWindowScroll);
```

Bu yaklaşım özellikle sayfa yüksekliği container’dan bağımsızsa işe yarar.

### 4. Guard kuralları

Yeni yükleme başlamadan önce kontrol et:

- `loadingMore` true ise tekrar yükleme başlatma
- `hasMore` false ise yeni istek atma

Bu, aynı sayfanın tekrar tekrar yüklenmesini önler.

## Filtreleme Mantığı

Filtreleme client-side yapılır, ancak veri kaybı olmaması için gerekli durumlarda backend’den geniş set istenir.

Örnek filtre türleri:

- isim / firma / telefon / plaka arama
- durum filtresi
- kapı filtresi
- tarih aralığı filtresi
- etiket veya özel alan filtresi

Tarih filtreleri için pratik yaklaşım:

- tarih değerini `YYYY-MM-DD` formatına çevir
- başlangıç ve bitiş arasında karşılaştır
- sınır tarihleri dahil et

Örnek:

```tsx
const dateOnly = record.given_date ? dayjs(record.given_date).format('YYYY-MM-DD') : '';
if (filters.givenDateStart && dateOnly < filters.givenDateStart) return false;
if (filters.givenDateEnd && dateOnly > filters.givenDateEnd) return false;
```

## Excel İndirme Mantığı

### 1. Tarih aralığı zorunluluğu

Kayıt indirme butonu için kullanıcı önce bir tarih aralığı seçmelidir.

Bu kuralın amacı:

- yanlışlıkla çok büyük export almamak
- eksik client-side veri yüzünden yarım export üretmemek
- kullanıcıya net kapsam sunmak

Kural:

- giriş/geliş tarihi aralığı yoksa uyarı ver
- çıkış/iade tarihi aralığı yoksa uyarı ver
- iki aralık da boşsa export başlatma

### 2. Export için tam veri çekme

Export yaparken genelde aşağıdaki istek kullanılır:

```tsx
await api.get('/.../records?includeDeleted=true&unlimited=true');
```

Neden:

- Sayfada o anda yüklenmiş kayıtlar tüm aralığı temsil etmeyebilir.
- Export, görünür listeyle sınırlı kalmamalıdır.

### 3. Export filtresi

Seçilen tarih tipine göre filtre uygula:

- giriş/teslim tarihi seçildiyse `entry_date` veya `given_date`
- çıkış/iade tarihi seçildiyse `exit_date` veya `return_date`

Örnek inclusive karşılaştırma (kesin dahil etme için gün sınırlarını normalize edin):

```tsx
const d = dayjs(dateValue);
const start = dayjs(rangeStart).startOf('day');
const end = dayjs(rangeEnd).endOf('day');
// Millisaniye düzeyinde karşılaştırma ve '[]' ile sınır günlerini dahil et
return d.isBetween(start, end, 'millisecond', '[]');
```

Not: `startOf('day')` ve `endOf('day')` kullanmak, zaman dilimi kaynaklı uç durumları engeller ve seçilen bitiş tarihinin tüm gün boyunca dahil edilmesini garanti eder.

### 4. Excel oluşturma standardı

Her kayıt günü için ayrı workbook veya gerekirse zip üret:

- tek gün varsa `.xlsx`
- birden fazla gün varsa `.zip`

Standart adımlar:

1. `ExcelJS.Workbook()` oluştur
2. Sheet ekle
3. Kolon genişliklerini ayarla
4. Header satırını stillendir
5. Veri satırlarını ekle
6. `writeBuffer()` ile binary al
7. Tek dosya ise indir
8. Çok dosya varsa `JSZip` ile paketle

## Realtime Güncelleme

Kayıt ekleme / silme / güncelleme sonrası liste otomatik yenilenmelidir.

Önerilen yapı:

```tsx
useRealtimeRefetch({
  topics: ['vehicles'],
  onMutation: () => void fetchData(0, false),
  enabled: true,
});
```

Bu sayede manuel refresh ihtiyacı azalır.

## Diğer Sayfalara Uygulama Checklist’i

Yeni bir kayıt sayfasına bu mantığı taşırken şunları kontrol et:

- `records` state’i var mı
- `PAGE_SIZE` tanımlı mı
- `loadingMore` ve `hasMore` var mı
- `fetchData(offset, append)` modeli kullanılıyor mu
- filtre aktifse `unlimited=true` gerekiyor mu
- scroll container `ref` ile izleniyor mu
- window scroll fallback gerekli mi
- export için tarih aralığı zorunlu mu
- export tam veri üzerinden mi yapılıyor
- sınır tarihleri dahil ediyor mu
- realtime refetch doğru topic ile bağlı mı

## Dosya Referansları

- [Ziyaretçi kullanıcı sayfası](frontend/src/pages/VisitorRecords.tsx)
- [Araç kullanıcı sayfası](frontend/src/pages/VehicleRecords.tsx)
- [Araç admin sayfası](frontend/src/pages/AdminVehicleRecords.tsx)
- [Ziyaretçi backend controller](backend/src/controllers/visitorController.ts)
- [Araç backend controller](backend/src/controllers/vehicleController.ts)

## Kısa Özet

Bu yaklaşımın özü şudur:

- listeyi parça parça çek
- aşağı kaydırdıkça daha eski kayıtları getir
- filtre varken tam veriyle çalış
- export için kullanıcıdan tarih aralığı iste
- export’u sadece ekranda görünen veriyle sınırlama

Bu rehber, diğer agentların aynı modeli diğer sayfalara hızlıca uygulaması için referans olarak kullanılabilir.