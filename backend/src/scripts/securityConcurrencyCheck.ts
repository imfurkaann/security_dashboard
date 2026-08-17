import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from '../config/database';

type Session = {
    cookieHeader: string;
    csrfToken: string;
};

const baseUrl = process.env.SECURITY_TEST_BASE_URL || 'http://127.0.0.1:5000';
const testId = crypto.randomUUID();
const userId = crypto.randomUUID();
const username = `security_audit_${testId.replace(/-/g, '').slice(0, 18)}`;
const password = crypto.randomBytes(32).toString('base64url');
let fireAlarmId: string | null = null;

const assertStatus = (actual: number, expected: number, label: string): void => {
    if (actual !== expected) {
        throw new Error(`${label}: HTTP ${expected} bekleniyordu, ${actual} alındı`);
    }
};

const sessionFromLoginResponse = (response: Response): Session => {
    const setCookieHeader = response.headers.get('set-cookie') || '';
    const cookiePairs = Array.from(
        setCookieHeader.matchAll(/(?:^|,\s*)(security_(?:session|csrf))=([^;,\s]+)/g)
    ).map((match) => `${match[1]}=${match[2]}`);

    const csrfPair = cookiePairs.find((cookie) => cookie.startsWith('security_csrf='));
    if (cookiePairs.length < 2 || !csrfPair) {
        throw new Error('Giriş yanıtında güvenli oturum çerezleri bulunamadı');
    }

    return {
        cookieHeader: cookiePairs.join('; '),
        csrfToken: decodeURIComponent(csrfPair.slice('security_csrf='.length)),
    };
};

const login = async (): Promise<Session> => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    assertStatus(response.status, 200, 'Eşzamanlı oturum açma');
    return sessionFromLoginResponse(response);
};

const authenticatedRequest = async (
    session: Session,
    path: string,
    method = 'GET',
    body?: Record<string, unknown>
): Promise<Response> => fetch(`${baseUrl}${path}`, {
    method,
    headers: {
        Cookie: session.cookieHeader,
        'X-CSRF-Token': session.csrfToken,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
});

const cleanup = async (): Promise<void> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (fireAlarmId) {
            await client.query('DELETE FROM fire_alarms WHERE id = $1', [fireAlarmId]);
        }
        await client.query('DELETE FROM personnel_records WHERE personnel_id = $1', [userId]);
        await client.query('DELETE FROM personnel WHERE id = $1', [userId]);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const run = async (): Promise<void> => {
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
        `INSERT INTO personnel (id, first_name, last_name, username, password, role, is_active)
         VALUES ($1, $2, $3, $4, $5, 'personnel', TRUE)`,
        [userId, 'Security', 'Concurrency Audit', username, passwordHash]
    );

    const [sessionA, sessionB] = await Promise.all([login(), login()]);
    const openSessions = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM personnel_records
         WHERE personnel_id = $1 AND logout_time IS NULL`,
        [userId]
    );
    if (Number(openSessions.rows[0]?.count) !== 2) {
        throw new Error('İki bağımsız açık oturum atomik olarak oluşturulamadı');
    }

    assertStatus((await authenticatedRequest(sessionA, '/api/auth/me')).status, 200, 'Birinci oturum');
    assertStatus((await authenticatedRequest(sessionB, '/api/auth/me')).status, 200, 'İkinci oturum');

    assertStatus((await authenticatedRequest(sessionA, '/api/auth/logout', 'POST', {})).status, 200, 'Birinci oturum çıkışı');
    assertStatus((await authenticatedRequest(sessionA, '/api/auth/me')).status, 401, 'Kapatılmış oturum reddi');
    assertStatus((await authenticatedRequest(sessionB, '/api/auth/me')).status, 200, 'Diğer oturumun korunması');

    const sessionC = await login();
    const createResponse = await authenticatedRequest(sessionB, '/api/fire-alarms/records', 'POST', {
        alarm_number: `SEC-${testId.slice(0, 8)}`,
        location: 'SECURITY CONCURRENCY TEST',
        false_alarm: true,
        resolution_notes: 'Geçici otomatik test kaydı',
    });
    assertStatus(createResponse.status, 201, 'Geçici alarm kaydı');
    const created = await createResponse.json() as { data?: { id?: string } };
    fireAlarmId = created.data?.id || null;
    if (!fireAlarmId) throw new Error('Geçici alarm kimliği alınamadı');

    const resolveResponses = await Promise.all([
        authenticatedRequest(sessionB, `/api/fire-alarms/records/${fireAlarmId}/resolve`, 'POST', {
            resolution_notes: 'Eşzamanlı test A',
            false_alarm: true,
        }),
        authenticatedRequest(sessionC, `/api/fire-alarms/records/${fireAlarmId}/resolve`, 'POST', {
            resolution_notes: 'Eşzamanlı test B',
            false_alarm: true,
        }),
    ]);
    const transitionStatuses = resolveResponses.map((response) => response.status).sort();
    if (transitionStatuses[0] !== 200 || transitionStatuses[1] !== 409) {
        throw new Error(`Atomik durum geçişi beklenen [200,409] yerine [${transitionStatuses.join(',')}] döndürdü`);
    }

    const auditRows = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM audit_log
         WHERE table_name = 'fire_alarms' AND record_id = $1`,
        [fireAlarmId]
    );
    if (Number(auditRows.rows[0]?.count) < 2) {
        throw new Error('Kritik kayıt oluşturma/güncelleme işlemleri denetim günlüğüne yazılmadı');
    }

    assertStatus((await authenticatedRequest(sessionB, '/api/auth/logout', 'POST', {})).status, 200, 'İkinci oturum çıkışı');
    assertStatus((await authenticatedRequest(sessionC, '/api/auth/logout', 'POST', {})).status, 200, 'Üçüncü oturum çıkışı');

    console.log(JSON.stringify({
        success: true,
        independentSessions: true,
        logoutRevocation: true,
        atomicRecordTransition: true,
        auditTrail: true,
        expectedConflictStatus: 409,
    }));
};

run()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : 'Güvenlik/eşzamanlılık testi başarısız');
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await cleanup();
        } catch (cleanupError) {
            console.error('Geçici güvenlik testi verileri temizlenemedi:', cleanupError instanceof Error ? cleanupError.message : 'unknown');
            process.exitCode = 1;
        }
        await pool.end();
    });
