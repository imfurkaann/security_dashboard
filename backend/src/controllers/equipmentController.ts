import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database';
import { getClientIp } from '../middleware/rateLimiter';

/**
 * Equipment check validation rules
 */
export const equipmentCheckValidation = [
    body('television_status').isBoolean().withMessage('Televizyon durumu gereklidir'),
    body('monitor_status').isBoolean().withMessage('Monitör durumu gereklidir'),
    body('phone_status').isBoolean().withMessage('Telefon durumu gereklidir'),
    body('breathalyzer_status').isBoolean().withMessage('Alkol metre durumu gereklidir'),
    body('television_reason').optional().isString().trim(),
    body('monitor_reason').optional().isString().trim(),
    body('phone_reason').optional().isString().trim(),
    body('breathalyzer_reason').optional().isString().trim(),
];

/**
 * Submit equipment check
 * POST /api/equipment-check
 */
export const submitEquipmentCheck = async (req: Request, res: Response): Promise<void> => {
    const client = await pool.connect();

    try {
        // Validate input
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

        const {
            television_status,
            monitor_status,
            phone_status,
            breathalyzer_status,
            television_reason,
            monitor_reason,
            phone_reason,
            breathalyzer_reason,
        } = req.body;

        await client.query('BEGIN');

        // Get the latest personnel_record for this user
        const recordQuery = `
            SELECT id, login_time
            FROM personnel_records
            WHERE personnel_id = $1
            ORDER BY login_time DESC
            LIMIT 1
        `;
        const recordResult = await client.query(recordQuery, [userId]);

        if (recordResult.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(400).json({
                success: false,
                message: 'Giriş kaydı bulunamadı',
            });
            return;
        }

        const personnelRecordId = recordResult.rows[0].id;

        // Check if equipment check already exists for this record
        const existingCheckQuery = `
            SELECT id FROM equipment_checks
            WHERE personnel_record_id = $1
        `;
        const existingCheck = await client.query(existingCheckQuery, [personnelRecordId]);

        if (existingCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            res.status(400).json({
                success: false,
                message: 'Ekipman kontrolü zaten yapılmış',
            });
            return;
        }

        // Get user info for WhatsApp message
        const userQuery = `
            SELECT first_name, last_name
            FROM personnel
            WHERE id = $1
        `;
        const userResult = await client.query(userQuery, [userId]);
        const user = userResult.rows[0];
        const fullName = `${user.first_name} ${user.last_name}`;

        // Create WhatsApp message
        const equipmentStatuses = [
            { name: 'Televizyon', status: television_status, reason: television_reason },
            { name: 'Monitör', status: monitor_status, reason: monitor_reason },
            { name: 'Telefon', status: phone_status, reason: phone_reason },
            { name: 'Alkol Metre', status: breathalyzer_status, reason: breathalyzer_reason },
        ];

        const approvedItems = equipmentStatuses.filter(item => item.status).map(item => item.name);
        const rejectedItems = equipmentStatuses.filter(item => !item.status);

        let whatsappMessage = `🔐 *Ekipman Teslim Alma Raporu*\n\n`;
        whatsappMessage += `👤 *Personel:* ${fullName}\n`;
        whatsappMessage += `📅 *Tarih:* ${new Date().toLocaleDateString('tr-TR')}\n`;
        whatsappMessage += `⏰ *Saat:* ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}\n\n`;

        if (approvedItems.length > 0) {
            whatsappMessage += `✅ *Sağlam Teslim Alınan Ekipmanlar:*\n`;
            approvedItems.forEach(item => {
                whatsappMessage += `  • ${item}\n`;
            });
            whatsappMessage += '\n';
        }

        if (rejectedItems.length > 0) {
            whatsappMessage += `⚠️ *Sorunlu Ekipmanlar:*\n`;
            rejectedItems.forEach(item => {
                whatsappMessage += `  • ${item.name}\n`;
                if (item.reason) {
                    whatsappMessage += `    _Açıklama: ${item.reason}_\n`;
                }
            });
        }

        // Insert equipment check record
        const insertQuery = `
            INSERT INTO equipment_checks (
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
                whatsapp_message
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
        `;

        await client.query(insertQuery, [
            personnelRecordId,
            userId,
            television_status,
            monitor_status,
            phone_status,
            breathalyzer_status,
            television_reason || null,
            monitor_reason || null,
            phone_reason || null,
            breathalyzer_reason || null,
            whatsappMessage,
        ]);

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

        // Get the latest personnel_record for this user
        const recordQuery = `
            SELECT pr.id, ec.id as equipment_check_id
            FROM personnel_records pr
            LEFT JOIN equipment_checks ec ON ec.personnel_record_id = pr.id
            WHERE pr.personnel_id = $1 AND pr.logout_time IS NULL
            ORDER BY pr.login_time DESC
            LIMIT 1
        `;
        const result = await pool.query(recordQuery, [userId]);

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
