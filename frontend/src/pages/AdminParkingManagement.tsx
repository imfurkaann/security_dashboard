import { useMemo, useState } from 'react';

const PARKING_CAPACITY_STORAGE_KEY = 'adminParkingCapacity';
const PARKING_RESERVED_STORAGE_KEY = 'adminParkingReserved';

const getInitialCapacity = (): string => {
    const storedValue = localStorage.getItem(PARKING_CAPACITY_STORAGE_KEY);
    if (!storedValue) {
        return '';
    }

    const numeric = Number(storedValue);
    if (!Number.isFinite(numeric) || numeric < 0) {
        return '';
    }

    return String(Math.floor(numeric));
};

const getInitialReserved = (): string => {
    const storedValue = localStorage.getItem(PARKING_RESERVED_STORAGE_KEY);
    if (!storedValue) {
        return '';
    }

    const numeric = Number(storedValue);
    if (!Number.isFinite(numeric) || numeric < 0) {
        return '';
    }

    return String(Math.floor(numeric));
};

export default function AdminParkingManagement() {
    const [capacityInput, setCapacityInput] = useState<string>(getInitialCapacity);
    const [reservedInput, setReservedInput] = useState<string>(getInitialReserved);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const previewMessage = useMemo(() => {
        if (!capacityInput) {
            return 'Henüz kapasite girilmedi';
        }

        const reserved = reservedInput ? Number(reservedInput) : 0;
        const available = Number(capacityInput) - reserved;

        return `Toplam kapasite: ${capacityInput} | Rezerve: ${reserved} | Mevcut: ${available}`;
    }, [capacityInput, reservedInput]);

    const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSuccessMessage('');
        setErrorMessage('');

        const numericCapacity = Number(capacityInput);
        const numericReserved = Number(reservedInput || 0);

        if (!Number.isFinite(numericCapacity) || numericCapacity < 0) {
            setErrorMessage('Lütfen otopark kapasitesi için 0 veya daha büyük bir sayı girin');
            return;
        }

        if (!Number.isFinite(numericReserved) || numericReserved < 0) {
            setErrorMessage('Lütfen rezerve otopark sayısı için 0 veya daha büyük bir sayı girin');
            return;
        }

        if (numericReserved > numericCapacity) {
            setErrorMessage('Rezerve otopark sayısı toplam kapasiteden fazla olamaz');
            return;
        }

        localStorage.setItem(PARKING_CAPACITY_STORAGE_KEY, String(Math.floor(numericCapacity)));
        localStorage.setItem(PARKING_RESERVED_STORAGE_KEY, String(Math.floor(numericReserved)));
        setCapacityInput(String(Math.floor(numericCapacity)));
        setReservedInput(String(Math.floor(numericReserved)));
        setSuccessMessage('Otopark ayarları kaydedildi');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">Otopark Yönetimi</h1>
                    <p className="text-sm sm:text-base text-slate-200 mt-1">

                    </p>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8">
                <div className="max-w-3xl bg-white rounded-lg shadow px-4 sm:px-6 py-5 sm:py-6 border border-gray-100">
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label htmlFor="parking-capacity" className="mb-2 block text-sm font-medium text-gray-700">
                                Otopark Kapasitesi
                            </label>
                            <input
                                id="parking-capacity"
                                type="number"
                                min={0}
                                inputMode="numeric"
                                value={capacityInput}
                                onChange={(event) => {
                                    setCapacityInput(event.target.value);
                                    setSuccessMessage('');
                                    setErrorMessage('');
                                }}
                                placeholder="Ornek: 300"
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none transition focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label htmlFor="parking-reserved" className="mb-2 block text-sm font-medium text-gray-700">
                                Rezerve Otopark Sayısı
                            </label>
                            <input
                                id="parking-reserved"
                                type="number"
                                min={0}
                                inputMode="numeric"
                                value={reservedInput}
                                onChange={(event) => {
                                    setReservedInput(event.target.value);
                                    setSuccessMessage('');
                                    setErrorMessage('');
                                }}
                                placeholder="Ornek: 20"
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none transition focus:border-blue-500"
                            />
                        </div>

                        <button
                            type="submit"
                            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                        >
                            Kaydet
                        </button>

                        <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
                            <p className="text-sm text-blue-800">{previewMessage}</p>
                        </div>

                        {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
                        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
                    </form>
                </div>
            </main>
        </div>
    );
}