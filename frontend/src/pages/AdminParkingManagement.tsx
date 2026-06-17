import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';
import { ArrowLeft, Car, ShieldAlert, Check, Percent, Layers, Gauge } from 'lucide-react';

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
    const navigate = useNavigate();
    const [capacityInput, setCapacityInput] = useState<string>(getInitialCapacity);
    const [reservedInput, setReservedInput] = useState<string>(getInitialReserved);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const refreshParkingSettings = useCallback(() => {
        setCapacityInput(getInitialCapacity());
        setReservedInput(getInitialReserved());
    }, []);

    useEffect(() => {
        const onStorageChange = (event: StorageEvent) => {
            if (!event.key || event.key === PARKING_CAPACITY_STORAGE_KEY || event.key === PARKING_RESERVED_STORAGE_KEY) {
                refreshParkingSettings();
            }
        };

        window.addEventListener('storage', onStorageChange);
        return () => window.removeEventListener('storage', onStorageChange);
    }, [refreshParkingSettings]);

    useRealtimeRefetch({
        topics: ['dashboard'],
        onMutation: refreshParkingSettings,
        enabled: true,
    });

    const parsedStats = useMemo(() => {
        const capacity = capacityInput ? Math.max(0, Math.floor(Number(capacityInput))) : 0;
        const reserved = reservedInput ? Math.max(0, Math.floor(Number(reservedInput))) : 0;
        const available = Math.max(0, capacity - reserved);
        const ratio = capacity > 0 ? (reserved / capacity) * 100 : 0;
        return { capacity, reserved, available, ratio };
    }, [capacityInput, reservedInput]);

    const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSuccessMessage('');
        setErrorMessage('');

        const numericCapacity = Number(capacityInput);
        const numericReserved = Number(reservedInput || 0);

        if (Number.isNaN(numericCapacity) || numericCapacity < 0 || !capacityInput.trim()) {
            setErrorMessage('Lütfen otopark kapasitesi için geçerli bir sayı girin');
            return;
        }

        if (Number.isNaN(numericReserved) || numericReserved < 0) {
            setErrorMessage('Lütfen rezerve otopark sayısı için geçerli bir sayı veya 0 girin');
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
        setSuccessMessage('Otopark ayarları başarıyla kaydedildi');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
                    <div className="flex items-center gap-4 min-w-0">
                        <button
                            type="button"
                            onClick={() => navigate('/admin/dashboard')}
                            className="p-2.5 hover:bg-slate-800 rounded-xl transition shrink-0 border border-slate-700/60 bg-slate-800/45 text-slate-300 hover:text-white"
                            title="Geri Dön"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight break-words flex items-center gap-2.5">
                                <Car className="w-8 h-8 text-blue-500" />
                                Otopark Yönetimi
                            </h1>
                            <p className="text-sm text-slate-300 mt-1">
                                Otopark kapasitesini ve rezerve park yeri verilerini kontrol edin.
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 max-w-5xl mx-auto">
                {successMessage && (
                    <div className="bg-emerald-50 border border-emerald-250 text-emerald-850 rounded-xl px-4 py-3.5 flex items-center gap-3 animate-fadeIn">
                        <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span className="text-sm font-medium">{successMessage}</span>
                    </div>
                )}

                {errorMessage && (
                    <div className="bg-red-50 border border-red-250 text-red-850 rounded-xl px-4 py-3.5 flex items-center gap-3 animate-fadeIn">
                        <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
                        <span className="text-sm font-medium">{errorMessage}</span>
                    </div>
                )}

                {/* KPI Summary Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Capacity card */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
                        <div className="absolute right-4 top-4 text-slate-100 group-hover:text-slate-200/50 transition-colors">
                            <Layers className="w-12 h-12" />
                        </div>
                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Toplam Kapasite</span>
                        <span className="block text-3xl font-extrabold text-slate-900 mt-2">
                            {parsedStats.capacity || '-'}
                        </span>
                        <span className="block text-xs text-slate-400 mt-1.5">Tanımlı toplam araç yeri</span>
                    </div>

                    {/* Reserved card */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
                        <div className="absolute right-4 top-4 text-amber-100 group-hover:text-amber-200/50 transition-colors">
                            <Gauge className="w-12 h-12" />
                        </div>
                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Rezerve Yer</span>
                        <span className="block text-3xl font-extrabold text-amber-600 mt-2">
                            {parsedStats.reserved}
                        </span>
                        <span className="block text-xs text-slate-400 mt-1.5">Dolu / Korumalı park yeri</span>
                    </div>

                    {/* Available card */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
                        <div className="absolute right-4 top-4 text-emerald-100 group-hover:text-emerald-200/50 transition-colors">
                            <Car className="w-12 h-12" />
                        </div>
                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Mevcut Boş Yer</span>
                        <span className="block text-3xl font-extrabold text-emerald-600 mt-2">
                            {parsedStats.available}
                        </span>
                        <span className="block text-xs text-slate-400 mt-1.5">Giriş yapabilecek boş kapasite</span>
                    </div>
                </div>

                {/* Progress bar card */}
                {parsedStats.capacity > 0 && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <Percent className="w-4 h-4 text-blue-500" />
                                Canlı Doluluk Oranı
                            </span>
                            <span className="text-sm font-extrabold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                                %{parsedStats.ratio.toFixed(1)}
                            </span>
                        </div>
                        
                        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden border border-slate-200 p-0.5">
                            <div 
                                className={`h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r ${
                                    parsedStats.ratio > 85 
                                        ? 'from-red-500 to-rose-500' 
                                        : parsedStats.ratio > 65 
                                            ? 'from-amber-500 to-yellow-500' 
                                            : 'from-emerald-500 to-teal-500'
                                }`}
                                style={{ width: `${Math.min(100, parsedStats.ratio)}%` }}
                            />
                        </div>
                        
                        <div className="flex justify-between text-xs text-slate-450 mt-2.5">
                            <span>%0 (Boş)</span>
                            <span>%50</span>
                            <span>%100 (Dolu)</span>
                        </div>
                    </div>
                )}

                {/* Configuration form */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900 mb-5 pb-3 border-b border-gray-150">
                        Otopark Konfigürasyon Ayarları
                    </h2>

                    <form onSubmit={handleSave} className="space-y-6 max-w-xl">
                        <div>
                            <label htmlFor="parking-capacity" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Otopark Kapasitesi
                            </label>
                            <div className="relative">
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
                                    placeholder="Örn: 300"
                                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:border-blue-500 outline-none text-gray-900 text-sm transition-all focus:ring-1 focus:ring-blue-500/20"
                                />
                            </div>
                            <span className="block text-xs text-slate-400 mt-1.5">Güvenlik kapısı ekranlarında görünecek toplam otopark alanı sayısı.</span>
                        </div>

                        <div>
                            <label htmlFor="parking-reserved" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Rezerve / Dolu Otopark Sayısı
                            </label>
                            <div className="relative">
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
                                    placeholder="Örn: 20"
                                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:border-blue-500 outline-none text-gray-900 text-sm transition-all focus:ring-1 focus:ring-blue-500/20"
                                />
                            </div>
                            <span className="block text-xs text-slate-400 mt-1.5">Şu anda içeride olan veya rezerve edilmiş park yeri miktarı.</span>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                            <button
                                type="submit"
                                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-700 hover:to-indigo-750 text-white px-6 py-3 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm text-sm"
                            >
                                Yapılandırmayı Kaydet
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}