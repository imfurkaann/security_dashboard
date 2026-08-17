import 'dotenv/config';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { MulterError } from 'multer';
import type { Server as HttpServer } from 'http';
import pool from './config/database';
import { runMigrations } from './config/migrations';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import vehicleRoutes from './routes/vehicles';
import visitorRoutes from './routes/visitors';
import visitorPublicRoutes from './routes/visitorPublic';
import managersRoutes from './routes/managers';
import incidentsRoutes from './routes/incidents';
import fireAlarmsRoutes from './routes/fireAlarms';
import sgkRoutes from './routes/sgk';
import equipmentCheckRoutes from './routes/equipmentCheck';
import personnelRoutes from './routes/personnel';
import exportRoutes from './routes/export';
import statisticsRoutes from './routes/statistics';
import guestRegistryRoutes from './routes/guestRegistry';
import predefinedVisitorRoutes from './routes/predefinedVisitors';
import { generalRateLimiter, writeRateLimiter } from './middleware/rateLimiter';
import { csrfProtection } from './middleware/csrf';
import {
    SGK_MAX_FILE_COUNT,
    SGK_MAX_FILE_SIZE_MB,
    collectUploadedFiles,
    deleteFile
} from './utils/fileUpload';
import { setWhatsAppTargetJid, warmupWhatsAppConnection, shutdownWhatsAppConnection } from './services/whatsappBaileys';
import { loadPersistedWhatsAppTargetJid } from './services/whatsappSettingsStore';
import { initRealtime, emitApiMutation, resolveMutationTopics } from './realtime/socket';
import { initTempCleanupService } from './services/tempCleanupService';
import { assertSecureHttpConfiguration, isAllowedOrigin } from './config/httpSecurity';
import { adminAuthMiddleware } from './middleware/adminAuth';

// Türkiye saat dilimi ayarı (Node.js için)
process.env.TZ = 'Europe/Istanbul';

const app: Application = express();
app.disable('x-powered-by');
assertSecureHttpConfiguration();

const configuredProxyHops = Number(process.env.TRUST_PROXY_HOPS || '0');
if (Number.isInteger(configuredProxyHops) && configuredProxyHops >= 0 && configuredProxyHops <= 5) {
    app.set('trust proxy', configuredProxyHops);
} else {
    console.warn('TRUST_PROXY_HOPS geçersiz; proxy güveni devre dışı bırakıldı.');
    app.set('trust proxy', false);
}

const PRIMARY_PORT = Number(process.env.PORT || 5000);
const FALLBACK_PORT = Number(process.env.PORT_FALLBACK || PRIMARY_PORT + 1);
const PORT_ATTEMPT_COUNT = Number(process.env.PORT_ATTEMPT_COUNT || 10);

const UNLIMITED_LOGIN_PATHS = new Set(['/api/auth/login', '/api/admin/login']);
const isUnlimitedLoginRequest = (req: Request): boolean => {
    const requestPath = req.path;
    return req.method === 'POST' && UNLIMITED_LOGIN_PATHS.has(requestPath);
};

// GÜVENLİK: Request body boyutu sınırlaması (DoS koruması)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// GÜVENLİK: Temel güvenlik başlıkları
app.use((_req: Request, res: Response, next: NextFunction) => {
    // XSS koruması
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    // HSTS (HTTPS zorunluluğu - production'da)
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
        } else {
            console.warn(`Reddedilen CORS isteği: ${origin}`);
            callback(new Error('CORS policy violation'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Selected-Gate', 'X-Realtime-Client-Id', 'X-CSRF-Token'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400 // 24 saat önbellekleme
}));

// Cookie-authenticated write requests require CSRF validation.
app.use(csrfProtection);

// Query stringleri filtrelerde kişisel veri içerebilir; uygulama loguna yazılmaz.
app.use((req: Request, _res: Response, next: NextFunction) => {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.socket.remoteAddress;
    console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${ip}`);
    next();
});

// HTTP mutasyonlarını merkezi olarak websocket üzerinden yayınla
app.use((req: Request, res: Response, next: NextFunction) => {
    const isMutationMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const clientIdHeader = req.header('x-realtime-client-id');
    const normalizedClientId = clientIdHeader?.trim() || '';
    const clientId = /^[a-zA-Z0-9_-]{1,64}$/.test(normalizedClientId) ? normalizedClientId : null;

    res.on('finish', () => {
        if (!isMutationMethod) return;
        if (res.statusCode >= 400) return;
        if (!req.path.startsWith('/api/')) return;

        const topics = resolveMutationTopics(req.path);
        console.log('[realtime] HTTP mutation finished', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            topics,
            clientId,
        });

        emitApiMutation({
            method: req.method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
            path: req.path,
            statusCode: res.statusCode,
            timestamp: new Date().toISOString(),
            clientId,
            topics,
        });
    });

    next();
});

// GÜVENLİK: Global rate limiting (login endpointleri hariç)
app.use((req: Request, res: Response, next: NextFunction) => {
    if (isUnlimitedLoginRequest(req)) {
        next();
        return;
    }

    generalRateLimiter(req, res, next);
});

// GÜVENLİK: Yazma işlemleri için ek rate limiting (login endpointleri hariç)
app.use((req: Request, res: Response, next: NextFunction) => {
    if (isUnlimitedLoginRequest(req)) {
        next();
        return;
    }

    writeRateLimiter(req, res, next);
});

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/visitor-public', visitorPublicRoutes);
app.use('/api/managers', managersRoutes);
app.use('/api/incidents', incidentsRoutes);
app.use('/api/fire-alarms', fireAlarmsRoutes);
app.use('/api/sgk', sgkRoutes);
app.use('/api/equipment-check', equipmentCheckRoutes);
app.use('/api/personnel', personnelRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/guest-registry', guestRegistryRoutes);
app.use('/api/predefined-visitors', predefinedVisitorRoutes);

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
        status: 'OK',
        message: 'Security Management API is running',
        timestamp: new Date().toISOString()
    });
});

// Ayrıntılı DB tanısı yalnızca açıkça etkinleştirildiğinde ve admin oturumuyla kullanılabilir.
app.get('/api/db-test', adminAuthMiddleware, async (_req: Request, res: Response) => {
    if (process.env.ENABLE_DB_DIAGNOSTICS !== 'true') {
        res.status(404).json({ success: false, message: 'İstenen kaynak bulunamadı' });
        return;
    }
    try {
        await pool.query('SELECT 1');
        res.json({
            status: 'OK',
            message: 'Database connected'
        });
    } catch {
        res.status(500).json({
            status: 'ERROR',
            message: 'Database connection failed'
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

    // Multipart dosya limit hataları
    const isSgkUpload = req.path.startsWith('/api/sgk/') || req.path === '/api/visitor-public/sgk-records';
    if (isSgkUpload && (err instanceof MulterError || err.message.includes('PDF, JPG, JPEG ve PNG'))) {
        collectUploadedFiles(req).forEach((file) => {
            if (!file.filename) return;
            try {
                deleteFile(file.filename);
            } catch (cleanupError) {
                console.error('Rejected SGK multipart cleanup error:', cleanupError);
            }
        });

        if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                success: false,
                message: `Dosya boyutu çok büyük. Her bir dosya en fazla ${SGK_MAX_FILE_SIZE_MB}MB olabilir.`
            });
        }

        if (err instanceof MulterError && err.code === 'LIMIT_FILE_COUNT') {
            return res.status(413).json({
                success: false,
                message: `Tek seferde en fazla ${SGK_MAX_FILE_COUNT} belge yüklenebilir.`
            });
        }

        return res.status(400).json({
            success: false,
            message: 'Sadece PDF, JPG, JPEG ve PNG dosyaları yüklenebilir.'
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
    await shutdownWhatsAppConnection();
    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT sinyali alındı, bağlantılar kapatılıyor...');
    await shutdownWhatsAppConnection();
    await pool.end();
    process.exit(0);
});

// Uygulama başlatma fonksiyonu
const startServer = async () => {
    try {
        // Migration'ları çalıştır
        await runMigrations();

        // Persist edilen WhatsApp hedef grubunu yükle (Docker restart/update sonrası kalıcılık)
        const persistedTargetJid = await loadPersistedWhatsAppTargetJid();
        if (persistedTargetJid) {
            setWhatsAppTargetJid(persistedTargetJid);
            console.log('✅ WhatsApp hedef grubu DBden yüklendi.');
        }

        // WhatsApp warmup migration ve ayar yükleme sonrası başlatılır
        warmupWhatsAppConnection();

        // Test ortamında sunucuyu başlatma (Jest supertest kendi yönetiyor)
        if (process.env.NODE_ENV === 'test') {
            console.log('🧪 Test ortamı - sunucu supertest tarafından yönetiliyor');
            return;
        }

        const startListening = (port: number): Promise<{ port: number; server: HttpServer }> => {
            return new Promise((resolve, reject) => {
                const server = app.listen(port, () => resolve({ port, server }));
                server.once('error', (error: NodeJS.ErrnoException) => reject(error));
            });
        };

        const candidatePorts: number[] = [PRIMARY_PORT];
        if (FALLBACK_PORT !== PRIMARY_PORT) {
            candidatePorts.push(FALLBACK_PORT);
        }

        let nextPort = Math.max(PRIMARY_PORT, FALLBACK_PORT) + 1;
        while (candidatePorts.length < PORT_ATTEMPT_COUNT) {
            candidatePorts.push(nextPort);
            nextPort += 1;
        }

        let runningPort: number | null = null;
        let runningServer: HttpServer | null = null;
        let lastError: NodeJS.ErrnoException | null = null;

        for (const port of candidatePorts) {
            try {
                if (port !== PRIMARY_PORT) {
                    console.warn(`⚠️ Port ${port - 1} kullanımda. Port ${port} deneniyor...`);
                }

                const started = await startListening(port);
                runningPort = started.port;
                runningServer = started.server;
                break;
            } catch (error) {
                const listenError = error as NodeJS.ErrnoException;
                lastError = listenError;

                if (listenError.code !== 'EADDRINUSE') {
                    throw error;
                }
            }
        }

        if (!runningPort) {
            throw lastError || new Error('Uygun port bulunamadı');
        }

        if (runningServer) {
            initRealtime(runningServer);
        }

        // Initialize temporary file/record cleanup background service
        initTempCleanupService();

        console.log(`🚀 Server is running on port ${runningPort}`);
        console.log(`📝 Environment: ${process.env.NODE_ENV}`);
        console.log(`🔗 API URL: http://localhost:${runningPort}`);
    } catch (error) {
        console.error('❌ Sunucu başlatma hatası:', error);
        process.exit(1);
    }
};

// Sunucuyu başlat
startServer();

export default app;
