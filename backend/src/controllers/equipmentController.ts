import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database';
import { getGateFromRequest } from '../utils/gate';
import { getWhatsAppConnectionStatus, listWhatsAppGroups, sendWhatsAppTextMessage } from '../services/whatsappBaileys';

interface EquipmentStatusItem {
    name: string;
    status: boolean;
    reason?: string;
}

interface GateRow {
    id: number;
    code: string;
    name: string;
    description: string | null;
    is_active: boolean;
}

interface GateEquipmentRow {
    id: number;
    gate_id: number;
    name: string;
    sort_order: number;
    is_active: boolean;
}

const normalizeText = (value: string): string =>
    value
        .trim()
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const toGateCode = (name: string): string =>
    normalizeText(name)
        .replace(/[^a-z0-9\s_-]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 64);

const mapStatusesFromLegacyPayload = (payload: Record<string, unknown>): EquipmentStatusItem[] => {
    const mapping = [
        { name: 'Televizyon', statusKey: 'television_status', reasonKey: 'television_reason' },
        { name: 'Monitör', statusKey: 'monitor_status', reasonKey: 'monitor_reason' },
        { name: 'Telefon', statusKey: 'phone_status', reasonKey: 'phone_reason' },
        { name: 'Alkol Metre', statusKey: 'breathalyzer_status', reasonKey: 'breathalyzer_reason' },
    ];

    return mapping.map(item => ({
        name: item.name,
        status: Boolean(payload[item.statusKey]),
        reason: typeof payload[item.reasonKey] === 'string' ? String(payload[item.reasonKey]) : '',
    }));
};

const sanitizeStatusItems = (items: unknown): EquipmentStatusItem[] => {
    if (!Array.isArray(items)) return [];

    return items
        .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;

            const item = entry as Record<string, unknown>;
            const name = typeof item.name === 'string' ? item.name.trim() : '';
            if (!name) return null;

            return {
                name,
                status: Boolean(item.status),
                reason: typeof item.reason === 'string' ? item.reason.trim() : '',
            } as EquipmentStatusItem;
        })
        .filter((entry): entry is EquipmentStatusItem => Boolean(entry));
};

const buildLegacyStatusMap = (statuses: EquipmentStatusItem[]): Record<string, { status: boolean; reason: string }> => {
    const legacyNames = {
        television: ['televizyon'],
        monitor: ['monitor', 'monitör'],
        phone: ['telefon'],
        breathalyzer: ['alkol metre', 'alkolmetre'],
    };

    const result = {
        television: { status: false, reason: '' },
        monitor: { status: false, reason: '' },
        phone: { status: false, reason: '' },
        breathalyzer: { status: false, reason: '' },
    };

    statuses.forEach((item) => {
        const normalized = normalizeText(item.name);

        if (legacyNames.television.includes(normalized)) {
            result.television = { status: item.status, reason: item.reason || '' };
        }
        if (legacyNames.monitor.includes(normalized)) {
            result.monitor = { status: item.status, reason: item.reason || '' };
        }
        if (legacyNames.phone.includes(normalized)) {
            result.phone = { status: item.status, reason: item.reason || '' };
        }
        if (legacyNames.breathalyzer.includes(normalized)) {
            result.breathalyzer = { status: item.status, reason: item.reason || '' };
        }
    });

    return result;
};

const getGateConfigFromDb = async (activeOnly: boolean) => {
    const gateParams: Array<boolean> = [];
    let gateWhere = '';
    if (activeOnly) {
        gateWhere = 'WHERE is_active = $1';
        gateParams.push(true);
    }

    const gatesResult = await pool.query<GateRow>(
        `SELECT id, code, name, description, is_active
         FROM equipment_gates
         ${gateWhere}
         ORDER BY name ASC`,
        gateParams
    );

    const equipmentParams: Array<boolean> = [];
    let equipmentWhere = '';
    if (activeOnly) {
        equipmentWhere = 'WHERE ge.is_active = $1';
        equipmentParams.push(true);
    }

    const equipmentsResult = await pool.query<GateEquipmentRow>(
        `SELECT ge.id, ge.gate_id, ge.name, ge.sort_order, ge.is_active
         FROM gate_equipments ge
         ${equipmentWhere}
         ORDER BY ge.gate_id ASC, ge.sort_order ASC, ge.name ASC`,
        equipmentParams
    );

    return gatesResult.rows.map((gate) => ({
        id: gate.id,
        code: gate.code,
        name: gate.name,
        description: gate.description,
        isActive: gate.is_active,
        equipments: equipmentsResult.rows
            .filter(item => item.gate_id === gate.id)
            .map(item => ({
                id: item.id,
                name: item.name,
                sortOrder: item.sort_order,
                isActive: item.is_active,
            })),
    }));
};

const resolveGateLabel = async (rawGateValue: string): Promise<string> => {
    const byCode = await pool.query<{ name: string }>(
        'SELECT name FROM equipment_gates WHERE code = $1 LIMIT 1',
        [rawGateValue]
    );

    if (byCode.rows.length > 0) {
        return byCode.rows[0].name;
    }

    const byName = await pool.query<{ name: string }>(
        'SELECT name FROM equipment_gates WHERE LOWER(name) = LOWER($1) LIMIT 1',
        [rawGateValue]
    );

    if (byName.rows.length > 0) {
        return byName.rows[0].name;
    }

    return rawGateValue;
};

/**
 * Equipment check validation rules
 */
export const equipmentCheckValidation = [
    body('television_status').optional().isBoolean(),
    body('monitor_status').optional().isBoolean(),
    body('phone_status').optional().isBoolean(),
    body('breathalyzer_status').optional().isBoolean(),
    body('television_reason').optional().isString().trim(),
    body('monitor_reason').optional().isString().trim(),
    body('phone_reason').optional().isString().trim(),
    body('breathalyzer_reason').optional().isString().trim(),
    body('equipmentStatuses').optional().isArray(),
    body('equipmentStatuses.*.name').optional().isString().trim().isLength({ min: 1 }),
    body('equipmentStatuses.*.status').optional().isBoolean(),
    body('equipmentStatuses.*.reason').optional().isString().trim(),
    body('gate').optional().isString().trim(),
];

/**
 * GET /api/equipment-check/config
 * Return active gates and active equipment list per gate for personnel flow
 */
export const getEquipmentConfig = async (_req: Request, res: Response): Promise<void> => {
    try {
        const data = await getGateConfigFromDb(true);

        res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        console.error('Equipment config fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Ekipman yapılandırması alınırken hata oluştu',
        });
    }
};

/**
 * GET /api/admin/equipment-config
 * Admin management list (includes passive rows)
 */
export const getAdminEquipmentConfig = async (_req: Request, res: Response): Promise<void> => {
    try {
        const data = await getGateConfigFromDb(false);

        res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        console.error('Admin equipment config fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Yönetim yapılandırması alınırken hata oluştu',
        });
    }
};

/**
 * POST /api/admin/equipment-config/gates
 */
export const createEquipmentGate = async (req: Request, res: Response): Promise<void> => {
    const client = await pool.connect();

    try {
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
        const codeInput = typeof req.body?.code === 'string' ? req.body.code.trim() : '';

        if (!name) {
            res.status(400).json({ success: false, message: 'Kapı adı gereklidir' });
            return;
        }

        const code = toGateCode(codeInput || name);
        if (!code) {
            res.status(400).json({ success: false, message: 'Geçerli bir kapı kodu üretilemedi' });
            return;
        }

        await client.query('BEGIN');

        const existing = await client.query('SELECT id FROM equipment_gates WHERE code = $1', [code]);
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            res.status(400).json({ success: false, message: 'Bu kapı kodu zaten kullanılıyor' });
            return;
        }

        const insertGate = await client.query<GateRow>(
            `INSERT INTO equipment_gates (code, name, description, is_active)
             VALUES ($1, $2, $3, TRUE)
             RETURNING id, code, name, description, is_active`,
            [code, name, description || null]
        );

        const gateId = insertGate.rows[0].id;
        const requestedEquipments = Array.isArray(req.body?.equipments)
            ? req.body.equipments.filter((item: unknown) => typeof item === 'string').map((item: string) => item.trim()).filter(Boolean)
            : [];

        for (let i = 0; i < requestedEquipments.length; i += 1) {
            await client.query(
                `INSERT INTO gate_equipments (gate_id, name, sort_order, is_active)
                 VALUES ($1, $2, $3, TRUE)
                 ON CONFLICT (gate_id, name) DO NOTHING`,
                [gateId, requestedEquipments[i], i + 1]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Kapı başarıyla oluşturuldu',
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create equipment gate error:', error);
        res.status(500).json({
            success: false,
            message: 'Kapı oluşturulurken hata oluştu',
        });
    } finally {
        client.release();
    }
};

/**
 * PUT /api/admin/equipment-config/gates/:gateId
 */
export const updateEquipmentGate = async (req: Request, res: Response): Promise<void> => {
    try {
        const gateId = Number(req.params.gateId);
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
        const isActive = req.body?.isActive;

        if (!Number.isInteger(gateId) || gateId <= 0) {
            res.status(400).json({ success: false, message: 'Geçersiz kapı kimliği' });
            return;
        }

        // Yeni kural: Kapı pasif yapılmak istenirse doğrudan sil.
        if (isActive === false) {
            const deleteResult = await pool.query('DELETE FROM equipment_gates WHERE id = $1', [gateId]);

            if (deleteResult.rowCount === 0) {
                res.status(404).json({ success: false, message: 'Kapı bulunamadı' });
                return;
            }

            res.status(200).json({ success: true, message: 'Kapı pasif olduğu için silindi' });
            return;
        }

        if (!name) {
            res.status(400).json({ success: false, message: 'Kapı adı gereklidir' });
            return;
        }

        const result = await pool.query(
            `UPDATE equipment_gates
             SET name = $1,
                 description = $2,
                 is_active = COALESCE($3::boolean, is_active),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [name, description || null, typeof isActive === 'boolean' ? isActive : null, gateId]
        );

        if (result.rowCount === 0) {
            res.status(404).json({ success: false, message: 'Kapı bulunamadı' });
            return;
        }

        res.status(200).json({ success: true, message: 'Kapı güncellendi' });
    } catch (error) {
        console.error('Update equipment gate error:', error);
        res.status(500).json({ success: false, message: 'Kapı güncellenirken hata oluştu' });
    }
};

/**
 * DELETE /api/admin/equipment-config/gates/:gateId
 */
export const deleteEquipmentGate = async (req: Request, res: Response): Promise<void> => {
    try {
        const gateId = Number(req.params.gateId);
        if (!Number.isInteger(gateId) || gateId <= 0) {
            res.status(400).json({ success: false, message: 'Geçersiz kapı kimliği' });
            return;
        }

        const result = await pool.query('DELETE FROM equipment_gates WHERE id = $1', [gateId]);

        if (result.rowCount === 0) {
            res.status(404).json({ success: false, message: 'Kapı bulunamadı' });
            return;
        }

        res.status(200).json({ success: true, message: 'Kapı silindi' });
    } catch (error) {
        console.error('Delete equipment gate error:', error);
        res.status(500).json({ success: false, message: 'Kapı silinirken hata oluştu' });
    }
};

/**
 * POST /api/admin/equipment-config/gates/:gateId/equipments
 */
export const addGateEquipment = async (req: Request, res: Response): Promise<void> => {
    try {
        const gateId = Number(req.params.gateId);
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

        if (!Number.isInteger(gateId) || gateId <= 0) {
            res.status(400).json({ success: false, message: 'Geçersiz kapı kimliği' });
            return;
        }

        if (!name) {
            res.status(400).json({ success: false, message: 'Ekipman adı gereklidir' });
            return;
        }

        const gateExists = await pool.query('SELECT id FROM equipment_gates WHERE id = $1', [gateId]);
        if (gateExists.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Kapı bulunamadı' });
            return;
        }

        const orderResult = await pool.query<{ max_order: number | null }>(
            'SELECT MAX(sort_order) as max_order FROM gate_equipments WHERE gate_id = $1',
            [gateId]
        );
        const nextOrder = (orderResult.rows[0]?.max_order || 0) + 1;

        await pool.query(
            `INSERT INTO gate_equipments (gate_id, name, sort_order, is_active)
             VALUES ($1, $2, $3, TRUE)
             ON CONFLICT (gate_id, name) DO NOTHING`,
            [gateId, name, nextOrder]
        );

        res.status(201).json({ success: true, message: 'Ekipman eklendi' });
    } catch (error) {
        console.error('Add gate equipment error:', error);
        res.status(500).json({ success: false, message: 'Ekipman eklenirken hata oluştu' });
    }
};

/**
 * PUT /api/admin/equipment-config/equipments/:equipmentId
 */
export const updateGateEquipment = async (req: Request, res: Response): Promise<void> => {
    try {
        const equipmentId = Number(req.params.equipmentId);
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        const isActive = req.body?.isActive;

        if (!Number.isInteger(equipmentId) || equipmentId <= 0) {
            res.status(400).json({ success: false, message: 'Geçersiz ekipman kimliği' });
            return;
        }

        if (!name) {
            res.status(400).json({ success: false, message: 'Ekipman adı gereklidir' });
            return;
        }

        const result = await pool.query(
            `UPDATE gate_equipments
             SET name = $1,
                 is_active = COALESCE($2::boolean, is_active),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [name, typeof isActive === 'boolean' ? isActive : null, equipmentId]
        );

        if (result.rowCount === 0) {
            res.status(404).json({ success: false, message: 'Ekipman bulunamadı' });
            return;
        }

        res.status(200).json({ success: true, message: 'Ekipman güncellendi' });
    } catch (error) {
        console.error('Update gate equipment error:', error);
        res.status(500).json({ success: false, message: 'Ekipman güncellenirken hata oluştu' });
    }
};

/**
 * DELETE /api/admin/equipment-config/equipments/:equipmentId
 */
export const deleteGateEquipment = async (req: Request, res: Response): Promise<void> => {
    try {
        const equipmentId = Number(req.params.equipmentId);
        if (!Number.isInteger(equipmentId) || equipmentId <= 0) {
            res.status(400).json({ success: false, message: 'Geçersiz ekipman kimliği' });
            return;
        }

        const result = await pool.query('DELETE FROM gate_equipments WHERE id = $1', [equipmentId]);

        if (result.rowCount === 0) {
            res.status(404).json({ success: false, message: 'Ekipman bulunamadı' });
            return;
        }

        res.status(200).json({ success: true, message: 'Ekipman silindi' });
    } catch (error) {
        console.error('Delete gate equipment error:', error);
        res.status(500).json({ success: false, message: 'Ekipman silinirken hata oluştu' });
    }
};

/**
 * Submit equipment check
 * POST /api/equipment-check
 */
export const submitEquipmentCheck = async (req: Request, res: Response): Promise<void> => {
    const client = await pool.connect();

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz form bilgileri',
                errors: errors.array(),
            });
            return;
        }

        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Yetkilendirme gerekli',
            });
            return;
        }

        const dynamicStatuses = sanitizeStatusItems(req.body?.equipmentStatuses);
        
        // Only fall back to legacy format if new format is empty AND legacy fields exist
        const hasLegacyFields = ['television_status', 'monitor_status', 'phone_status', 'breathalyzer_status'].some(
            key => key in (req.body || {})
        );
        
        const equipmentStatuses =
            dynamicStatuses.length > 0
                ? dynamicStatuses
                : hasLegacyFields
                    ? mapStatusesFromLegacyPayload(req.body as Record<string, unknown>)
                    : [];

        const rejectedWithoutReason = equipmentStatuses.some(item => item.status === false && !item.reason?.trim());
        if (rejectedWithoutReason) {
            res.status(400).json({
                success: false,
                message: 'Teslim alınmayan ekipmanlar için açıklama zorunludur',
            });
            return;
        }

        await client.query('BEGIN');

        const recordResult = await client.query<{ id: number }>(
            `SELECT id
             FROM personnel_records
             WHERE personnel_id = $1
             ORDER BY login_time DESC
             LIMIT 1`,
            [userId]
        );

        if (recordResult.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(400).json({
                success: false,
                message: 'Giriş kaydı bulunamadı',
            });
            return;
        }

        const personnelRecordId = recordResult.rows[0].id;

        const existingCheck = await client.query(
            `SELECT id FROM equipment_checks
             WHERE personnel_record_id = $1`,
            [personnelRecordId]
        );

        if (existingCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            res.status(400).json({
                success: false,
                message: 'Ekipman kontrolü zaten yapılmış',
            });
            return;
        }

        const userResult = await client.query<{ first_name: string; last_name: string }>(
            `SELECT first_name, last_name
             FROM personnel
             WHERE id = $1`,
            [userId]
        );

        const user = userResult.rows[0];
        const fullName = `${user.first_name} ${user.last_name}`;

        const rawGateValue = getGateFromRequest(req) || 'Belirtilmedi';
        const selectedGate = await resolveGateLabel(rawGateValue);

        const approvedItems = equipmentStatuses.filter(item => item.status).map(item => item.name);
        const rejectedItems = equipmentStatuses.filter(item => !item.status);

        let whatsappMessage = `🕒 VARDİYA BAŞLANGIÇ BİLDİRİMİ 🕒\n\n`;
        whatsappMessage += `Personel: ${fullName}\n`;
        whatsappMessage += `Tarih: ${new Date().toLocaleDateString('tr-TR')}\n`;
        whatsappMessage += `Saat: ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}\n`;
        whatsappMessage += `Kapı: ${selectedGate}\n\n`;

        if (approvedItems.length > 0) {
            whatsappMessage += `Sağlam Teslim Alınan Ekipmanlar:\n`;
            approvedItems.forEach(item => {
                whatsappMessage += `  • ${item}\n`;
            });
            whatsappMessage += '\n';
        }

        if (rejectedItems.length > 0) {
            whatsappMessage += `Sorunlu Ekipmanlar:\n`;
            rejectedItems.forEach(item => {
                whatsappMessage += `  • ${item.name}\n`;
                if (item.reason) {
                    whatsappMessage += `    _Açıklama: ${item.reason}_\n`;
                }
            });
        }

        const legacyMap = buildLegacyStatusMap(equipmentStatuses);

        await client.query(
            `INSERT INTO equipment_checks (
                personnel_record_id,
                personnel_id,
                television_status,
                monitor_status,
                phone_status,
                breathalyzer_status,
                television_reason,
                monitor_reason,
                phone_reason,
                breathalyzer_reason,
                whatsapp_message,
                equipment_details
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
            RETURNING id`,
            [
                personnelRecordId,
                userId,
                legacyMap.television.status,
                legacyMap.monitor.status,
                legacyMap.phone.status,
                legacyMap.breathalyzer.status,
                legacyMap.television.reason || null,
                legacyMap.monitor.reason || null,
                legacyMap.phone.reason || null,
                legacyMap.breathalyzer.reason || null,
                whatsappMessage,
                JSON.stringify(equipmentStatuses),
            ]
        );

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Ekipman kontrolü kaydedildi',
            data: {
                whatsappMessage,
            },
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Equipment check error:', error);
        res.status(500).json({
            success: false,
            message: 'Ekipman kontrolü kaydedilirken hata oluştu',
        });
    } finally {
        client.release();
    }
};

/**
 * Check if equipment check is completed for current session
 * GET /api/equipment-check/status
 */
export const getEquipmentCheckStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Yetkilendirme gerekli',
            });
            return;
        }

        const result = await pool.query(
            `SELECT pr.id, ec.id as equipment_check_id
             FROM personnel_records pr
             LEFT JOIN equipment_checks ec ON ec.personnel_record_id = pr.id
             WHERE pr.personnel_id = $1 AND pr.logout_time IS NULL
             ORDER BY pr.login_time DESC
             LIMIT 1`,
            [userId]
        );

        if (result.rows.length === 0) {
            res.status(200).json({
                success: true,
                data: {
                    hasActiveSession: false,
                    equipmentCheckCompleted: false,
                },
            });
            return;
        }

        const hasEquipmentCheck = result.rows[0].equipment_check_id !== null;

        res.status(200).json({
            success: true,
            data: {
                hasActiveSession: true,
                equipmentCheckCompleted: hasEquipmentCheck,
            },
        });
    } catch (error) {
        console.error('Get equipment check status error:', error);
        res.status(500).json({
            success: false,
            message: 'Durum kontrolü yapılırken hata oluştu',
        });
    }
};

/**
 * GET /api/equipment-check/whatsapp-status
 * Return current Baileys connection state for test operations
 */
export const getEquipmentWhatsAppStatus = async (_req: Request, res: Response): Promise<void> => {
    try {
        const status = getWhatsAppConnectionStatus();
        res.status(200).json({
            success: true,
            data: status,
        });
    } catch (error) {
        console.error('Get equipment WhatsApp status error:', error);
        res.status(500).json({
            success: false,
            message: 'WhatsApp bağlantı durumu alınırken hata oluştu',
        });
    }
};

/**
 * GET /api/equipment-check/whatsapp-groups
 * List joined WhatsApp groups to select target JID
 */
export const getEquipmentWhatsAppGroups = async (_req: Request, res: Response): Promise<void> => {
    try {
        const groups = await listWhatsAppGroups();
        res.status(200).json({
            success: true,
            data: groups,
        });
    } catch (error) {
        console.error('Get equipment WhatsApp groups error:', error);
        res.status(500).json({
            success: false,
            message: 'WhatsApp grup listesi alınırken hata oluştu',
        });
    }
};

/**
 * POST /api/equipment-check/send-whatsapp-message
 * Send a WhatsApp message manually (triggered from frontend)
 */
export const sendWhatsAppMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { message } = req.body;

        if (!message || typeof message !== 'string' || message.trim() === '') {
            res.status(400).json({
                success: false,
                message: 'Mesaj içeriği gereklidir.',
            });
            return;
        }

        const result = await sendWhatsAppTextMessage(message.trim());

        res.status(200).json(result);
    } catch (error) {
        console.error('Send WhatsApp message error:', error);
        res.status(500).json({
            success: false,
            message: 'WhatsApp mesajı gönderilirken hata oluştu.',
        });
    }
};
