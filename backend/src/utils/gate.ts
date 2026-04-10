import { Request } from 'express';

export type GateLabel = string;

const normalizeGateValue = (value: unknown): GateLabel | null => {
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    const raw = trimmed.toLowerCase();

    if (raw === 'ana_kapi' || raw === 'ana kapı' || raw === 'ana kapi') {
        return 'Ana Kapı';
    }

    if (raw === 'sahil_kapi' || raw === 'sahil kapı' || raw === 'sahil kapi') {
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
