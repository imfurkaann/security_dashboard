export const INCIDENT_CATEGORY_OPTIONS = [
    { value: 'theft_guest_property', label: 'Misafir Eşyası Hırsızlığı' },
    { value: 'theft_hotel_property', label: 'İşletme Mülkiyeti Hırsızlığı' },
    { value: 'theft_personnel', label: 'Personel Hırsızlığı' },
    { value: 'assault_physical', label: 'Fiziksel Saldırı' },
    { value: 'assault_verbal', label: 'Sözlü/Davranışsal Taciz' },
    { value: 'assault_mass_fight', label: 'Toplu Kavga/İzdiham' },
    { value: 'substance_personnel', label: 'Görevde Alkol/Uyuşturucu' },
    { value: 'substance_property', label: 'Yasak Madde' },
    { value: 'vandalism_room', label: 'Oda Vandalizmi' },
    { value: 'vandalism_common_area', label: 'Ortak Alan Vandalizmi' },
    { value: 'unauthorized_room', label: 'Yetkisiz Oda Girişi' },
    { value: 'unauthorized_restricted_area', label: 'Kısıtlı Alan İhlali' },
    { value: 'accident_slip_fall', label: 'Kayma/Düşme' },
    { value: 'accident_equipment', label: 'Ekipman Kazası' },
    { value: 'accident_work', label: 'İş Kazası' },
    { value: 'medical_serious', label: 'Ciddi Tıbbi Durum' },
    { value: 'medical_first_aid', label: 'İlk Yardım' },
    { value: 'medical_ambulance', label: 'Ambulans' },
    { value: 'fire_real', label: 'Gerçek Yangın' },
    { value: 'fire_false_alarm', label: 'Hatalı Yangın Alarmı' },
    { value: 'fire_evacuation', label: 'Tahliye' },
    { value: 'security_cctv_malfunction', label: 'CCTV Arızası/Kayıt Kesintisi' },
    { value: 'other', label: 'Diğer Güvenlik Olayı' },
] as const;

export const getIncidentCategoryLabels = (
    categories: Record<string, boolean> | null | undefined,
): string[] => {
    if (!categories) return [];
    return INCIDENT_CATEGORY_OPTIONS
        .filter((option) => categories[option.value] === true)
        .map((option) => option.label);
};
