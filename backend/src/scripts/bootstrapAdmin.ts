import pool from '../config/database';
import { hashPassword, validateNewPassword } from '../utils/password';

type BootstrapInput = {
    username?: unknown;
    password?: unknown;
    firstName?: unknown;
    lastName?: unknown;
};

const readStdin = async (): Promise<string> => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    for await (const chunk of process.stdin) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buffer.length;
        if (totalBytes > 8192) throw new Error('İlk yönetici girdisi çok büyük');
        chunks.push(buffer);
    }

    return Buffer.concat(chunks).toString('utf8');
};

const decodeBootstrapInput = (input: string): string => {
    const trimmedInput = input.trim();
    if (!trimmedInput.startsWith('base64:')) return trimmedInput;

    const encodedPayload = trimmedInput.slice('base64:'.length);
    if (
        encodedPayload.length === 0 ||
        encodedPayload.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedPayload)
    ) {
        throw new Error('İlk yönetici girdisi güvenli biçimde çözülemedi');
    }

    const decodedPayload = Buffer.from(encodedPayload, 'base64').toString('utf8');
    if (Buffer.byteLength(decodedPayload, 'utf8') > 8192) {
        throw new Error('İlk yönetici girdisi çok büyük');
    }
    return decodedPayload;
};

const cleanName = (value: unknown, fieldName: string): string => {
    if (typeof value !== 'string') throw new Error(`${fieldName} zorunludur`);
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (normalized.length < 1 || normalized.length > 100 || /[\u0000-\u001f\u007f]/.test(normalized)) {
        throw new Error(`${fieldName} geçersizdir`);
    }
    return normalized;
};

const run = async (): Promise<void> => {
    const input = JSON.parse(decodeBootstrapInput(await readStdin())) as BootstrapInput;
    const username = typeof input.username === 'string' ? input.username.trim() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    const firstName = cleanName(input.firstName, 'Ad');
    const lastName = cleanName(input.lastName, 'Soyad');

    if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) {
        throw new Error('Kullanıcı adı 3-50 karakter olmalı ve yalnızca harf, rakam, nokta, tire veya alt çizgi içermelidir');
    }

    const passwordValidation = validateNewPassword(password, username);
    if (!passwordValidation.valid) throw new Error(passwordValidation.message);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock(hashtext('security-bootstrap-admin'))");

        const existingAdmin = await client.query(
            `SELECT 1
             FROM personnel
             WHERE role = 'admin' AND is_active = TRUE AND deleted_at IS NULL
             LIMIT 1`
        );
        if (existingAdmin.rows.length > 0) {
            await client.query('COMMIT');
            console.log(JSON.stringify({ success: true, created: false, reason: 'active_admin_exists' }));
            return;
        }

        const passwordHash = await hashPassword(password);
        const result = await client.query<{ id: number }>(
            `INSERT INTO personnel (first_name, last_name, username, password, role, is_active)
             VALUES ($1, $2, $3, $4, 'admin', TRUE)
             RETURNING id`,
            [firstName, lastName, username, passwordHash]
        );

        await client.query('COMMIT');
        console.log(JSON.stringify({ success: true, created: true, id: result.rows[0].id, username }));
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

run()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : 'İlk yönetici oluşturulamadı');
        process.exitCode = 1;
    })
    .finally(() => pool.end());
