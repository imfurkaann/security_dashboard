import { Request } from 'express';

export type GateLabel = 'Ana Kapı' | 'Sahil Kapı';

const normalizeGateValue = (value: unknown): GateLabel | null => {
    if (typeof value !== 'string') return null;

    const raw = value.trim().toLowerCase();

    if (raw === 'ana_kapi' || raw === 'ana kapı' || raw === 'ana kapi') {
        return 'Ana Kapı';
    }

    if (raw === 'sahil_kapi' || raw === 'sahil kapı' || raw === 'sahil kapi') {
        return 'Sahil Kapı';
    }

    return null;
};

export const getGateFromRequest = (req: Request): GateLabel | null => {
    const headerGate = normalizeGateValue(req.headers['x-selected-gate']);
    if (headerGate) return headerGate;

    return normalizeGateValue(req.body?.gate);
};
