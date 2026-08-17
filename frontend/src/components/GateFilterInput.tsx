import { useEffect, useId, useState } from 'react';
import api from '../utils/api';

interface GateFilterInputProps {
    value: string;
    onChange: (value: string) => void;
    allValue?: string;
    className?: string;
}

const FALLBACK_GATES = ['Ana Kapı', 'Sahil Kapı'];

export default function GateFilterInput({
    value,
    onChange,
    allValue = 'all',
    className = '',
}: GateFilterInputProps) {
    const listId = useId();
    const [gateNames, setGateNames] = useState<string[]>(FALLBACK_GATES);

    useEffect(() => {
        let active = true;
        api.get('/equipment-check/config')
            .then((response) => {
                if (!active) return;
                const configured = Array.isArray(response.data?.data)
                    ? response.data.data
                        .map((gate: { name?: unknown }) => typeof gate.name === 'string' ? gate.name.trim() : '')
                        .filter(Boolean)
                    : [];
                setGateNames(Array.from(new Set([...FALLBACK_GATES, ...configured])));
            })
            .catch(() => {
                // Filtering remains usable as a free-text field when config is unavailable.
            });
        return () => {
            active = false;
        };
    }, []);

    return (
        <>
            <input
                list={listId}
                type="text"
                value={value === allValue ? '' : value}
                onChange={(event) => onChange(event.target.value.trimStart() || allValue)}
                placeholder="Tüm kapılar"
                className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`.trim()}
            />
            <datalist id={listId}>
                {gateNames.map((gate) => <option key={gate} value={gate} />)}
            </datalist>
        </>
    );
}
