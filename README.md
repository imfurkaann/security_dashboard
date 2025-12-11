# Güvenlik Yönetim Paneli

Otel güvenlik personeli için geliştirilmiş modern yönetim sistemi.

## Özellikler

- 👥 Personel ve Müdür Yönetimi
- 🚗 Araç Kayıt Sistemi
- 👤 Ziyaretçi Takibi
- 📝 Olay Kayıtları
- 🔐 Güvenli Authentication (JWT)
- 🛡️ Role-Based Access Control
- 📊 Gelişmiş Filtreleme
- 🗄️ Audit Trail (Tüm işlemler loglanır)
- ♻️ Soft Delete (Veri kaybı yok)

## Teknoloji Stack

### Backend

- Node.js + Express
- TypeScript
- PostgreSQL
- JWT Authentication

### Frontend

- Vite + React
- TypeScript
- Tailwind CSS

## Kurulum

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Database

PostgreSQL 14+ gereklidir.

```bash
# Database oluştur
createdb security_management

# Migration'ları çalıştır
cd backend
npm run migrate
```

## Geliştirici

Furkan - Security Management System
