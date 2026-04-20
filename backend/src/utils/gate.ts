import { Request } from 'express';
import pool from '../config/database';

export type GateLabel = string;

const normalizeGateValue = (value: unknown): GateLabel | null => {
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    const raw = trimmed.toLowerCase();

    if (raw === 'ana_kapi' || raw === 'ana kapı' || raw === 'ana kapi' || raw === 'ana_kap' || raw === 'ana kap') {
        return 'Ana Kapı';
    }

    if (raw === 'sahil_kapi' || raw === 'sahil kapı' || raw === 'sahil kapi' || raw === 'sahil_kap' || raw === 'sahil kap') {
        return 'Sahil Kapı';
    }

    // Dinamik kapı desteği: admin tarafından tanımlanmış kod/ad değerlerini olduğu gibi taşı.
    return trimmed;
};

export const getGateFromRequest = (req: Request): GateLabel | null => {
    const headerGate = normalizeGateValue(req.headers['x-selected-gate']);
    if (headerGate) return headerGate;

    return normalizeGateValue(req.body?.gate);
};

export const getResolvedGateFromRequest = async (req: Request): Promise<GateLabel | null> => {
    const normalized = getGateFromRequest(req);
    if (!normalized) return null;

    // Legacy aliases are already normalized to canonical labels.
    if (normalized === 'Ana Kapı' || normalized === 'Sahil Kapı') {
        return normalized;
    }

    try {
        const query = `
            SELECT name
            FROM equipment_gates
            WHERE code = $1 OR LOWER(name) = LOWER($2)
            LIMIT 1
        `;
        const result = await pool.query(query, [normalized, normalized]);

        if (result.rows.length > 0 && result.rows[0].name) {
            return result.rows[0].name;
        }
    } catch (error) {
        console.warn('Gate resolve fallback triggered:', error);
    }

    return normalized;
};
