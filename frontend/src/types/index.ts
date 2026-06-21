/**
 * Type Definitions
 * Uygulama genelinde kullanılan tip tanımlamaları
 */

// User & Auth Types
export interface User {
    id: string;
    username: string;
    fullName: string;
    role: 'admin' | 'manager' | 'security';
}

export interface AuthResponse {
    success: boolean;
    data: {
        token: string;
        user: User;
    };
    message?: string;
}

// Vehicle Types
export interface Vehicle {
    id: string;
    brand: string;
    plate: string;
    status: 'available' | 'in_use';
    is_active: boolean;
    created_at: string;
}

export interface VehicleUsage {
    id: string;
    vehicle_id?: string;
    vehicle: string;
    vehicle_brand: string;
    vehicle_plate: string;
    manager: string;
    manager_id?: string;
    manager_title: string;
    given_by: string | null;  // Aracı teslim eden personel
    returned_by: string | null;  // Aracı geri alan personel
    destination: string;
    gate?: string | null;
    given_date: string;
    given_time: string;
    return_date: string | null;
    return_time: string | null;
    status: 'in_use' | 'returned';
    notes: string | null;
    deleted_at?: string | null;
    created_at: string;
}

// Guest Registry Types
export type GuestRegistryColumnType = 'text' | 'date' | 'time' | 'number';

export interface GuestRegistryColumn {
    key: string;
    label: string;
    type: GuestRegistryColumnType;
    index: number;
}

export interface GuestRegistrySchema {
    columns: GuestRegistryColumn[];
}

export interface GuestRegistryRecord {
    id: string;
    excel_file_name: string;
    sheet_name: string;
    row_number: number;
    row_data: Record<string, unknown>;
    created_at: string;
}

// Visitor Types
export interface VisitorRecord {
    id: string;
    vehicle_plate: string | null;
    full_name: string | null;
    company_name: string | null;
    visiting_person: string | null;
    person_count: number | null;
    children_count: number;
    gate?: string | null;
    phone: string | null;
    notes: string | null;
    highlight_color?: string;
    subcontractor_worker?: boolean;
    for_electric_station?: boolean;
    daily_guest?: boolean;
    entry_tag?: boolean;
    exit_tag?: boolean;
    tour_entry?: boolean;
    tour_exit?: boolean;
    meeting?: boolean;
    delivery?: boolean;
    entry_date: string | null;
    entry_time: string | null;
    exit_date: string | null;
    exit_time: string | null;
    status: 'inside' | 'exited';
    entry_by: string | null;  // Girişi kaydeden personel
    exit_by: string | null;  // Çıkışı kaydeden personel
    // Compatibility fields sometimes used in UI/export
    number_of_people?: number | null;
    entry_by_name?: string | null;
    exit_by_name?: string | null;
    deleted_at?: string | null;
    created_at: string | null;
}

export interface PredefinedVisitor {
    id: string;
    full_name: string;
    company_name: string | null;
    phone: string | null;
    vehicle_plate: string | null;
    visiting_person: string | null;
    notes: string | null;
    highlight_color?: string;
    subcontractor_worker: boolean;
    for_electric_station: boolean;
    daily_guest: boolean;
    entry_tag: boolean;
    exit_tag: boolean;
    tour_entry: boolean;
    tour_exit: boolean;
    meeting: boolean;
    delivery: boolean;
    guide: boolean;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
}


// Manager Types
export interface Manager {
    id: string;
    first_name: string;
    last_name: string;
    title: string;
    phone?: string | null;
    email?: string | null;
}

export interface ManagerRecord {
    id: string;
    manager_id?: string | null;
    manager: string | null;
    manager_title: string | null;
    gate?: string | null;
    entry_date: string | null;
    entry_time: string | null;
    exit_date?: string | null;
    exit_time?: string | null;
    status: 'inside' | 'exited';
    entry_by: string | null;  // Girişi kaydeden personel
    exit_by: string | null;  // Çıkışı kaydeden personel
    deleted_at?: string | null;
    notes?: string | null;
    created_at?: string | null;
}

// Incident Types
export interface IncidentRecord {
    id: string;
    description: string | null;
    reported_by: string | null;
    entry_date: string | null;
    entry_time: string | null;
    status: 'open' | 'closed';
    shift_label?: string | null;
    fire_alarm?: boolean;
    fire_count?: number;
    fire_location?: string | null;
    created_at?: string | null;
}

// SGK Types
export interface SgkFileMeta {
    id: string;
    record_id: string;
    file_name: string;
    original_file_name: string | null;
    mime_type: string | null;
    size_bytes: number | null;
    sort_order: number;
    created_at: string;
}

export interface SgkRecord {
    id: string;
    hashed_tc: string | null;
    hashed_passport: string | null;
    full_name: string;
    company_name: string | null;
    file_path: string | null;
    files: SgkFileMeta[];
    file_count: number;
    upload_date: string;
    notes: string | null;
    personnel: string | null;
    created_at: string | null;
}

export interface SgkFormData {
    tc_no: string;
    passport_no: string;
    full_name: string;
    company_name: string;
    notes: string;
    pdf_files: File[];
}

// Form Types
export interface VehicleFormData {
    vehicle_id: string;
    manager_id: string;
    manager_name: string;
    destination: string;
    notes: string;
    given_time?: string; // Optional: HH:MM format time
    return_time?: string; // Optional: HH:MM format time for returned vehicles
}

export interface VisitorFormData {
    vehicle_plate: string;
    full_name: string;
    company_name: string;
    visiting_person: string;
    person_count: string | number;
    children_count: string | number;
    phone: string;
    notes: string;
    highlight_color: string;
    subcontractor_worker: boolean;
    for_electric_station: boolean;
    daily_guest: boolean;
    entry_tag: boolean;
    exit_tag: boolean;
    tour_entry: boolean;
    tour_exit: boolean;
    meeting: boolean;
    delivery: boolean;
    send_whatsapp?: boolean;  // WhatsApp bildirimi (opsiyonel, sadece yeni kayıtlarda)
    entry_time?: string;  // Giriş saati (HH:MM formatında)
    exit_time?: string;  // Çıkış saati (HH:MM formatında)
}

// API Response Types
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

export interface GuestRegistryResponse {
    success: boolean;
    data: GuestRegistryRecord[];
    schema?: GuestRegistrySchema;
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    message?: string;
}

export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    total: number;
    page: number;
    limit: number;
}

// Filter Types
export type VehicleFilterType = 'all' | 'in_use' | 'deleted';
export type VisitorFilterType = 'today' | 'inside' | 'all' | 'subcontractor' | 'electric' | 'daily_guest' | 'entry_tag' | 'exit_tag' | 'deleted';
export type ManagerFilterType = 'all' | 'inside' | 'deleted';
export type IncidentFilterType = 'all' | 'open' | 'closed';
