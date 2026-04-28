# Veritabanı Kayıt İşlemleri Analiz Raporu

**Rapor Tarihi:** 28 Nisan 2026  
**Analiz Kapsamı:** Araç, Ziyaretçi, Yangın Alarmı, Misafir, Müdür, SGK Belge, Vardiya Raporları kayıt işlemleri

---

## 📋 Özet

Proje tamamında **7 ana kayıt işlemi** incelenmiştir. Toplam **5 KRITIK sorun** ve **8 UYARI** tespit edilmiştir.

| Modül | Durum | Try-Catch | Transaction | Risk |
|-------|-------|-----------|-------------|------|
| Ziyaretçi Kaydı | ⚠️ KRİTİK | ❌ YOK | ⚠️ Sorunlu | Yüksek |
| Araç Kaydı | ⚠️ UYARI | ✅ VAR | ⚠️ Sorunlu | Orta |
| Yangın Alarmı | ⚠️ KRİTİK | ✅ VAR | ❌ YOK | Yüksek |
| Misafir Kaydı | ✅ İYİ | ✅ VAR | ✅ İYİ | Düşük |
| Müdür Kaydı | ✅ İYİ | ✅ VAR | ✅ İYİ | Düşük |
| SGK Belge | ✅ İYİ | ✅ VAR | ✅ İYİ | Orta |
| QR Ziyaretçi | ⚠️ KRİTİK | ❌ YOK | ❌ YOK | Yüksek |

---

## 🚨 KRİTİK SORUNLAR (Acil Çözülmesi Gerekli)

### 1. **Ziyaretçi Kaydı - Try-Catch Eksikliği ve Transaction Yönetimi**

**Dosya:** `backend/src/controllers/visitorController.ts` (satırlar: 160-250)

**Sorun:**
```typescript
await pool.query('BEGIN');
const insertResult = await pool.query(insertQuery, values);
await pool.query('COMMIT');
// ❌ Try-catch YOOOOOOOK!
```

**Risk:**
- ❌ Eğer INSERT sırasında error oluşursa, transaction açık kalmaya devam eder
- ❌ ROLLBACK otomatik olarak yapılmaz → database lock'lanabilir
- ❌ Connection pool tükenebilir
- ❌ Sonraki istekler timeout'a girebilir

**Senaryo:**
1. Kullanıcı ziyaretçi kaydı oluşturmaya çalışıyor
2. Plaka formatı validation başarısız → INSERT failure
3. ROLLBACK yapılmıyor
4. BEGIN transaction açık kalıyor
5. Database locks tükenip sistem donuyor

**Çözüm Gerekli:** Try-catch-finally bloğu ile transaction yönetimi yapılmalı.

---

### 2. **Yangın Alarmı - Transaction Yapısı Eksikliği**

**Dosya:** `backend/src/controllers/fireAlarmController.ts` (satırlar: 50-120)

**Sorun:**
```typescript
try {
    const result = await pool.query(`INSERT INTO fire_alarms (...)`);
    // ❌ Hiç transaction BEGIN/COMMIT/ROLLBACK yok!
} catch (error) {
    // Error handling ama transaction yok
}
```

**Risk:**
- ❌ Concurrent requests sırasında race condition
- ❌ Partial inserts mümkün
- ❌ Data consistency issues
- ❌ Audit log record failed ama veri database'de → inconsistency

**Senaryo:**
1. Aynı anda 2 request yangın alarmı oluşturmak istiyor
2. İkinci request birinciyi overwrite edebilir
3. Audit log 1. request'e yazıldı ama veri 2. request tarafından değiştirildi
4. İstatistikler tutarsız hale geldi

**Çözüm Gerekli:** Transaction wrapper eklenip, dependent operations atomically execute edilmeli.

---

### 3. **QR Ziyaretçi Kaydı - Transaction ve Error Handling Eksikliği**

**Dosya:** `backend/src/controllers/visitorPublicController.ts` (satırlar: 200-270)

**Sorun:**
```typescript
// ❌ Try-catch YOK
// ❌ Transaction BEGIN/COMMIT/ROLLBACK YOK
await pool.query(`INSERT INTO visitor_records (...)`);

// Sonra
emitApiMutation({...}); // WebSocket event
```

**Risk:**
- ❌ QR kaydı başarısız olsa bile event emit'lenirse → dashboard'a fake data gider
- ❌ No transaction protection
- ❌ Connection errors'da orphaned records
- ❌ Entry_by_name field'ının tutarsız set edilmesi

**Senaryo:**
1. QR endpoint'ine request geliyor
2. INSERT database'e yazılamıyor (FK constraint failed vs.)
3. Error response gidiyor ama emit zaten fired
4. Dashboard notification gösteriyor ama veri database'de değil
5. Kullanıcı refresh ederse veri kaybolmuş görünüyor

**Çözüm Gerekli:** Try-catch ve transaction management eklenip, success'ten sonra event emit'lenme.

---

### 4. **Araç Kaydı - Sorunlu Transaction Yapısı**

**Dosya:** `backend/src/controllers/vehicleController.ts` (satırlar: 300-390)

**Sorun:**
```typescript
// BEGIN dışında try block!
await pool.query('BEGIN');

try {
    await pool.query(insertQuery, queryParams);
    await pool.query('UPDATE vehicles SET...');
    await pool.query('COMMIT');
} catch (error) {
    await pool.query('ROLLBACK'); // ⚠️ Problem!
}
```

**Risk:**
- ⚠️ Eğer BEGIN başarısız olursa? → try-catch'e girecek, sorun
- ⚠️ Eğer COMMIT başarısız olursa? → catch'deki ROLLBACK error'a girebilir
- ⚠️ Race condition: COMMIT'len sonra ROLLBACK çağrılabilir
- ⚠️ Vehicle status inconsistency

**Senaryo:**
1. INSERT başarılı, UPDATE başarılı, COMMIT edildi
2. Hemen sonra async WhatsApp message creation error
3. Catch'deki ROLLBACK çağrılıyor ama data zaten COMMIT'lenmiş!
4. Status update'i veri kalıyor, backend rollback etmeye çalışıyor

**Çözüm Gerekli:** Proper try-catch-finally kullanarak BEGIN'i try içinde çağırmalı ve resource management yapılmalı.

---

### 5. **SGK Belge Upload - File Deletion Race Condition**

**Dosya:** `backend/src/controllers/sgkController.ts` (satırlar: 300-420)

**Sorun:**
```typescript
try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO sgk_records ...`);
    
    for (let i = 0; i < uploadedFiles.length; i++) {
        await client.query(`INSERT INTO sgk_record_files ...`);
    }
    
    await client.query('COMMIT');
} catch (txError) {
    await client.query('ROLLBACK');
    throw txError;
} finally {
    client.release();
}

// ⚠️ Sonra error catch'de:
const uploadedFiles = extractUploadedFiles(req);
uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
```

**Risk:**
- ⚠️ Eğer 10 file upload'u yapılırsa ve 5'inci file insert fail olursa?
- ⚠️ ROLLBACK yapıldı, ama uploaded files cleanup'tan geçti
- ⚠️ Error response gidip catch bloğu file'ları delete ediyor
- ⚠️ İlk 4 file'ı successful şekilde uploaded ama delete'lenmiş!
- ⚠️ File cleanup double yapılabilir → filesystem error

**Senaryo:**
1. 10 tane PDF upload ediliyor
2. 7'inci INSERT database'e fail oluyor
3. ROLLBACK, finally client.release()
4. Main catch bloğu ALL files'ı delete ediyor
5. Ilk 4 file delete oluyor (hatalı!)
6. Cleanup code yeniden çalışırsa file not found error

**Çözüm Gerekli:** File deletion logic'i retry'lı olmalı veya transaction başarıdan sonra yapılmalı.

---

## ⚠️ UYARI SEVİYESİ SORUNLAR

### 6. **Audit Log Transaction'ı Dışında Yapılıyor**

**Etkilenen Dosyalar:**
- `visitorController.ts` (line 240)
- `vehicleController.ts` (line 330)
- `fireAlarmController.ts` (line 100)

**Sorun:**
```typescript
await pool.query('BEGIN');
const insertResult = await pool.query(insertQuery, values);
await pool.query('COMMIT');

// ❌ Transaction'ın DIŞINDA!
await logDataChange('visitor_records', id, 'INSERT', null, {...});
```

**Risk:**
- ⚠️ Eğer audit log write başarısız olursa, veri zaten commit'lenmiş
- ⚠️ Audit trail'de kayıp oluşabilir
- ⚠️ Compliance issues (müdür raporlarında hata)

**Çözüm:** Audit log, transaction'ın IÇINDE yapılmalı veya compensation logic'i olmalı.

---

### 7. **WebSocket Event Emit Timing Issue**

**Etkilenen Dosyalar:**
- `visitorController.ts` (line 230)
- `vehicleController.ts` (line 360)
- `fireAlarmController.ts` (line 110)

**Sorun:**
```typescript
res.status(201).json({success: true, ...});

// ❌ Response gitmek üzere, emit'leniyor - timing guarantee yok!
emitApiMutation({
    method: 'POST',
    path: '/api/visitors/records',
    ...
});
```

**Risk:**
- ⚠️ Event'in response'dan önce mi sonra mı gideceği garantili değil
- ⚠️ Socket.io'nun emit'lemesi sırasında server crash'lerse event kayboluyor
- ⚠️ Client side duplicate notification'lar olabilir

**Çözüm:** Event emit'lemesi res.json()'den ÖNCE yapılmalı veya queue'ye eklenmeliy.

---

### 8. **COALESCE vs NULL Handling Tutarsızlığı**

**Dosya:** `visitorController.ts` (line 200)

**Sorun:**
```typescript
// ❌ Bazı field'lar COALESCE'le, bazıları null veriliyor
INSERT INTO visitor_records (
    ...
    COALESCE($15::time, CURRENT_TIME),  // ✓ Doğru
    ...
)
VALUES (
    ...,
    entry_time || null,  // ❌ Sorunlu
    ...
)
```

**Risk:**
- ⚠️ Inconsistent NULL handling
- ⚠️ NULL vs empty string ambiguity
- ⚠️ Sorting ve filtering'de beklenmedik sonuçlar

---

### 9. **Input Validation Eksiklikleri**

**Etkilenen Dosyalar:**
- `visitorController.ts`: person_count < 1 check var ✓ AMA children_count = 0 açık bırakılmış
- `fireAlarmController.ts`: alarm_number optional ✓ AMA nullable value check'lenmiyor
- `guestRegistryController.ts`: Excel parsing'de malformed data check minimal

**Risk:**
- ⚠️ Edge case'lerde unexpected behavior
- ⚠️ Report'larda inconsistent data

---

### 10. **Error Messages Consistency**

**Sorun:** Hata mesajları Türkçe'de tutarsız yazılış
- `Ziyaretçi Kaydı`: "Giriş saati HH:MM formatında olmalıdır"
- `Yangın Alarmı`: "Alarm saati HH:MM formatında olmalıdır"
- `SGK`: "TC Kimlik No 11 haneli olmalıdır" (biçim farklı)

**Risk:**
- ⚠️ Client side error parsing'de problem olabilir
- ⚠️ User experience inconsistent

---

## 📊 Detaylı Modül Analizi

### **ZİYARETÇİ KAYDI** (visitorController.ts)

```
Status: ⚠️ KRİTİK
├── Try-Catch: ❌ YOK
├── Transaction: ⚠️ Sorunlu (try-catch yok)
├── Resource Management: ❌ No connection pool handling
├── Audit Log: ✓ Yapılıyor (ama transaction dışında)
└── Error Recovery: ❌ Kötü
```

**Flows:**
1. ✅ Input validation - Ayrıntılı
2. ❌ Database işlem - try-catch yok
3. ⚠️ Audit log - transaction dışında
4. ✓ WebSocket emit - sonrasında
5. ⚠️ WhatsApp - async, ama fail silent

**Issues:**
- Line 180-240: No try-catch wrapping transaction
- Line 230-240: Audit log outside transaction
- Line 220-250: Scope of final response handler

**Database Changes:**
```sql
-- visitor_records 
-- • id (PK)
-- • entry_by (FK personnel.id) - Required after insert
-- • entry_date - CURRENT_DATE
-- • entry_time - CURRENT_TIME or provided
-- • status - 'inside' hardcoded
-- • send_whatsapp - boolean flag
```

---

### **ARAÇ KAYDI** (vehicleController.ts)

```
Status: ⚠️ UYARI (Sorunlu Transaction)
├── Try-Catch: ✅ VAR
├── Transaction: ⚠️ Sorunlu (BEGIN dışında)
├── Resource Management: ❌ No pool.connect()
├── Audit Log: ✓ Yapılıyor
└── Error Recovery: ⚠️ Risky ROLLBACK
```

**Issues:**
- Line 305: BEGIN outside try block
- Line 335: After COMMIT, separate UPDATE query outside transaction
- Line 345: ROLLBACK can fail if COMMIT already done

**Database Changes:**
```sql
-- vehicle_records
-- • id (PK)
-- • vehicle_id (FK vehicles.id) - Validated
-- • given_by (FK personnel.id) - Required
-- • given_date - CURRENT_DATE
-- • given_time - Provided or CURRENT_TIME
-- • status - 'in_use'

-- vehicles
-- • status - Updated to 'in_use'
```

---

### **YANGIN ALARMI** (fireAlarmController.ts)

```
Status: ⚠️ KRİTİK (Transaction Yok!)
├── Try-Catch: ✅ VAR
├── Transaction: ❌ YOK
├── Resource Management: ⚠️ No explicit management
├── Audit Log: ✓ Yapılıyor
└── Error Recovery: ⚠️ No rollback capability
```

**Issues:**
- Line 90-100: Direct insert without transaction
- Line 80-100: No concurrent write protection
- Line 95-110: Audit log after direct insert (not in transaction)

**Database Changes:**
```sql
-- fire_alarms
-- • id (PK)
-- • alarm_number - Optional, sanitized
-- • location - Required, sanitized
-- • alarm_time - Validated HH:MM format
-- • recorded_by (FK personnel.id)
-- • gate - Resolved from request
```

---

### **MÜDÜr KAYDI** (managerController.ts)

```
Status: ✅ İYİ (Best Practice)
├── Try-Catch: ✅ VAR
├── Transaction: ✅ İYİ (client.connect pattern)
├── Resource Management: ✅ finally block
├── Audit Log: ✓ Transaction içinde
└── Error Recovery: ✅ Proper ROLLBACK
```

**Pattern (BEST):**
```typescript
const client = await pool.connect();
try {
    await client.query('BEGIN');
    await client.query(insertQuery);
    await client.query('COMMIT');
} catch (error) {
    await client.query('ROLLBACK');
} finally {
    client.release();
}
```

---

### **MİSAFİR KAYDI** (guestRegistryController.ts)

```
Status: ✅ İYİ (Proper Transaction)
├── Try-Catch: ✅ VAR
├── Transaction: ✅ İYİ
├── Resource Management: ✅ finally block
├── Audit Log: ✓ Yapılıyor
└── Error Recovery: ✅ Full Rollback
```

**Pattern:** Manager pattern'ı follow ediyor - GOOD

**Potential Issues:**
- Line 360-380: 1000+ row'lu Excel parse'leme timeout riski
- Line 400: cleanup after transaction (File management yok - JSON veri)

---

### **SGK BELGE** (sgkController.ts + visitorPublicController.ts)

```
Status: ✅ İYİ (Proper Transaction)
├── Try-Catch: ✅ VAR
├── Transaction: ✅ İYİ
├── Resource Management: ✅ finally block
├── Audit Log: ✓ Yapılıyor
├── File Management: ⚠️ Cleanup risky
└── Error Recovery: ✅ Full Rollback
```

**Issues:**
- Line 310-420: File delete in catch block after rollback
  ```typescript
  // Risk: Files uploaded but rollback happened, cleanup now
  // But what if cleanup itself fails?
  uploadedFiles.forEach((file) => deleteFile(file.filename));
  ```

**Database Changes:**
```sql
-- sgk_records
-- • id (PK)
-- • hashed_tc - Unique, nullable
-- • hashed_passport - Unique, nullable
-- • personnel_id (FK) - QR users

-- sgk_record_files (1:Many)
-- • id (PK)
-- • sgk_record_id (FK)
-- • stored_file_name
-- • sort_order
```

**File System Risk:** Multiple file upload fail'ında partial files orphaned olabilir

---

### **QR ZİYARETÇİ** (visitorPublicController.ts)

```
Status: ⚠️ KRİTİK (No Protection)
├── Try-Catch: ❌ YOK
├── Transaction: ❌ YOK
├── Resource Management: ❌ None
├── Audit Log: ✓ Yapılıyor (ama dışında)
└── Error Recovery: ❌ None
```

**Issues:**
- Line 200-270: No try-catch, no transaction
- Line 265: emitApiMutation can fail silently
- Line 250-260: No connection pool management

**Risk Scenario:**
```
1. QR scan → POST /visitor-public/records
2. Guest personnel auto-create
3. INSERT visitor_records - FAIL (constraint)
4. No rollback - guest personnel created
5. emitApiMutation fired anyway
6. Dashboard shows record but DB doesn't have it
7. Inconsistent state
```

---

## 🔍 Database Constraint Analizi

### Tespit Edilen Constraint'ler:

1. **visitor_records**
   - PK: id
   - FK: entry_by → personnel.id (visitor data varsa)
   - FK: exit_by → personnel.id (optional)
   - Unique: None explicit - duplicate records possible
   - Check: person_count >= 1 (application-level)

2. **vehicle_records**
   - PK: id
   - FK: vehicle_id → vehicles.id
   - FK: given_by → personnel.id
   - Check: status in ('in_use', 'returned', ...)

3. **sgk_records**
   - PK: id
   - Unique: hashed_tc (if not null)
   - Unique: hashed_passport (if not null)
   - FK: personnel_id → personnel.id

4. **fire_alarms**
   - PK: id
   - FK: recorded_by → personnel.id

### Constraint Violations Riski:

- ⚠️ **No explicit NOT NULL checks** - application level'de yapılıyor
- ⚠️ **FK constraints fail silenttly** - error not always handled
- ⚠️ **No unique constraint** on visitor combinations - duplicates possible

---

## 📋 Concurrent Access Analizi

### Race Condition Senaryoları:

#### Scenario 1: Vehicle Status Update Race

```
T1: POST /vehicles/records (Vehicle A)
    ├─ INSERT vehicle_records
    ├─ UPDATE vehicles SET status='in_use'
    └─ COMMIT

T2: POST /vehicles/records (Vehicle A) [concurrent]
    └─ SELECT vehicles WHERE id=A
        └─ Status still 'available' (T1 not committed yet)
    ├─ INSERT vehicle_records (OK, different record)
    └─ UPDATE vehicles SET status='in_use' (OK)

Result: Vehicle A has 2 concurrent records!
```

**Fix Needed:** Vehicle'da advisory lock veya transaction isolation level increase

#### Scenario 2: QR Guest Personnel Creation

```
T1: POST /qr/visitor-checkin
    └─ getOrCreateGuestPersonnelId()
        └─ SELECT from personnel WHERE username='qr_misafir'
            └─ Not found
        └─ INSERT personnel (qr_misafir) - PENDING

T2: POST /qr/visitor-checkin [concurrent]
    └─ getOrCreateGuestPersonnelId()
        └─ SELECT from personnel WHERE username='qr_misafir'
            └─ Not found (T1 not committed yet)
        └─ INSERT personnel (qr_misafir)
            └─ DUPLICATE KEY ERROR!

Result: One request fails with PK violation
```

**Fix Needed:** Better duplicate handling, advisory locks, ON CONFLICT clause

---

## 🛠️ Önerilen Düzeltmeler (Öncelik Sırası)

### P0 (Acil - 24 Saat):

1. ✅ **Ziyaretçi Kaydı** - Try-catch-finally wrapper ekle
   ```typescript
   const client = await pool.connect();
   try {
       await client.query('BEGIN');
       // ... INSERT, UPDATE
       await client.query('COMMIT');
   } catch (error) {
       await client.query('ROLLBACK');
       throw error;
   } finally {
       client.release();
   }
   ```

2. ✅ **Yangın Alarmı** - Transaction wrapper ekle
3. ✅ **QR Ziyaretçi** - Try-catch ve transaction ekle

### P1 (Yüksek - 1 Hafta):

4. ✅ Araç Kaydı - Transaction pattern düzelt (BEGIN'i try içine al)
5. ✅ SGK File Cleanup - Retry logic'i ekle veya transaction içine al
6. ✅ Audit Log - Transaction scope'u doğru yap

### P2 (Orta - 2 Hafta):

7. ✅ WebSocket Event Timing - Response'dan önce emit et
8. ✅ Concurrent Access - Advisory locks veya SERIALIZABLE isolation
9. ✅ Error Messages - Consistent format

### P3 (Düşük - İleride):

10. ✅ Input Validation - Centralized validation layer
11. ✅ Connection Pool Monitoring - Metrics add
12. ✅ Database Constraints - Explicit NOT NULL, UNIQUE definitions

---

## 🧪 Test Senariyoları (Recommend)

### Critical Test Cases:

```
1. Ziyaretçi Kaydı
   ├─ Normal flow (OK)
   ├─ Database error simulation (should rollback)
   ├─ Timeout scenario (should handle)
   └─ Concurrent requests (should not duplicate)

2. Araç Kaydı
   ├─ Normal flow (OK)
   ├─ Vehicle not found (should fail early)
   ├─ Status update fail (should rollback INSERT too)
   └─ Manager not found (should fail)

3. Yangın Alarmı
   ├─ Normal flow (OK)
   ├─ Database error (should rollback)
   ├─ Concurrent alarms same location (should not duplicate)
   └─ Invalid time format (should fail)

4. SGK Upload
   ├─ Normal flow (OK)
   ├─ File upload fail (should cleanup files)
   ├─ Database constraint fail (should rollback)
   ├─ 1000+ row Excel (should handle timeout)
   └─ Malformed Excel (should skip rows)

5. Misafir Upload
   ├─ Normal flow (OK)
   ├─ Empty Excel (should skip)
   ├─ Database error mid-transaction (should rollback all)
   └─ Duplicate header columns (should handle)
```

---

## 📈 Sağlık Metrikleri

### Monitör Edilmesi Gereken:

1. **Connection Pool Utilization**
   - Max connections: ?
   - Current active: ?
   - Waiting queue: ?

2. **Transaction Abort Rate**
   - Rollbacks/min: ?
   - Long-running transactions: ?

3. **Error Rate by Endpoint**
   - /visitors/records: ? errors/day
   - /vehicles/records: ? errors/day
   - /fire-alarms/records: ? errors/day

4. **File Upload Failures**
   - Partial uploads: ? 
   - Orphaned files: ?

---

## 🎯 Sonuç

**Genel Durum:** ⚠️ **UYARI** - Bazı kritik path'ler korunmasız

**Riskler:**
- 🔴 Database lock'lanma riski (high)
- 🔴 Veri inconsistency riski (medium-high)
- 🟠 Concurrent access sorunları (medium)
- 🟡 File orphaning (low-medium)

**Immediate Actions:**
1. P0 sorunları fix et
2. Load testing yap (concurrent requests)
3. Monitoring setup et
4. Error handling test et (network failures, timeouts)

**Best Practice Patterns:**
- Always use `client.connect()` for transactions
- Always wrap with try-catch-finally
- Always ROLLBACK in catch block
- Always release() in finally
- Emit events BEFORE response (or use queue)
- Validate inputs comprehensively
- Use explicit NOT NULL, UNIQUE, FK constraints

---

**Rapor Hazırlayan:** Code Analysis System  
**Analiz Tarihi:** 28 Nisan 2026  
**Kapsam:** Backend Controllers - Create/Insert Operations
