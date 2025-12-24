import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/database';
import { runMigrations } from './config/migrations';
import authRoutes from './routes/auth';
import vehicleRoutes from './routes/vehicles';
import visitorRoutes from './routes/visitors';
import managersRoutes from './routes/managers';
import incidentsRoutes from './routes/incidents';
import fireAlarmsRoutes from './routes/fireAlarms';
import sgkRoutes from './routes/sgk';
import equipmentCheckRoutes from './routes/equipmentCheck';
import { generalRateLimiter, writeRateLimiter } from './middleware/rateLimiter';

dotenv.config();

// Türkiye saat dilimi ayarı (Node.js için)
process.env.TZ = 'Europe/Istanbul';

const app: Application = express();
const PORT = process.env.PORT || 5000;

// GÜVENLİK: Request body boyutu sınırlaması (DoS koruması)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// GÜVENLİK: Temel güvenlik başlıkları
app.use((_req: Request, res: Response, next: NextFunction) => {
    // XSS koruması
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Clickjacking koruması
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    // HSTS (HTTPS zorunluluğu - production'da)
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// GÜVENLİK: CORS yapılandırması
// CORS_ORIGIN="*" ayarlandığında tüm originlere izin verir (yerel ağ paylaşımı için)
const corsOriginSetting = process.env.CORS_ORIGIN;

const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5174',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost',       // Docker frontend (port 80)
    'http://localhost:80'     // Docker frontend (explicit port)
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Eğer CORS_ORIGIN="*" ise tüm originlere izin ver (yerel ağ paylaşımı)
        if (corsOriginSetting === '*') {
            callback(null, true);
            return;
        }
        // API istekleri (origin olmadan) veya izin verilen originler
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Yerel ağ IP'leri için de izin ver (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
            const localNetworkPattern = /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/;
            if (origin && localNetworkPattern.test(origin)) {
                callback(null, true);
            } else {
                console.warn(`Reddedilen CORS isteği: ${origin}`);
                callback(new Error('CORS policy violation'));
            }
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400 // 24 saat önbellekleme
}));

// GÜVENLİK: Request logging (audit trail)
app.use((req: Request, _res: Response, next: NextFunction) => {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.socket.remoteAddress;
    console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${ip}`);
    next();
});

// GÜVENLİK: Global rate limiting
app.use(generalRateLimiter);

// GÜVENLİK: Yazma işlemleri için ek rate limiting
app.use(writeRateLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/managers', managersRoutes);
app.use('/api/incidents', incidentsRoutes);
app.use('/api/fire-alarms', fireAlarmsRoutes);
app.use('/api/sgk', sgkRoutes);
app.use('/api/equipment-check', equipmentCheckRoutes);

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
        status: 'OK',
        message: 'Security Management API is running',
        timestamp: new Date().toISOString()
    });
});

// Test database connection
app.get('/api/db-test', async (_req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            status: 'OK',
            message: 'Database connected',
            timestamp: result.rows[0].now
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: 'Database connection failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// 404 handler
app.use((_req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        message: 'İstenen kaynak bulunamadı'
    });
});

// GÜVENLİK: Global error handler - Hassas bilgi sızıntısını önle
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    // Hata logla (sadece sunucu tarafında)
    console.error('=== HATA DETAYI ===');
    console.error('Zaman:', new Date().toISOString());
    console.error('Path:', req.path);
    console.error('Method:', req.method);
    console.error('IP:', req.ip || req.socket.remoteAddress);
    console.error('Hata:', err.message);
    console.error('Stack:', err.stack);
    console.error('==================');

    // CORS hatası
    if (err.message === 'CORS policy violation') {
        return res.status(403).json({
            success: false,
            message: 'Erişim reddedildi'
        });
    }

    // JSON parse hatası (büyük payload) - err'i any'e cast et
    const errorWithType = err as Error & { type?: string };
    if (errorWithType.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            message: 'İstek boyutu çok büyük'
        });
    }

    // Genel hata - detay VERME (güvenlik)
    res.status(500).json({
        success: false,
        message: 'Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.'
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM sinyali alındı, bağlantılar kapatılıyor...');
    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT sinyali alındı, bağlantılar kapatılıyor...');
    await pool.end();
    process.exit(0);
});

// Uygulama başlatma fonksiyonu
const startServer = async () => {
    try {
        // Migration'ları çalıştır
        await runMigrations();

        // Sunucuyu başlat
        app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            console.log(`📝 Environment: ${process.env.NODE_ENV}`);
            console.log(`🔗 API URL: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Sunucu başlatma hatası:', error);
        process.exit(1);
    }
};

// Sunucuyu başlat
startServer();

export default app;
