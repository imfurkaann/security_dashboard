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
    personnel: string;
    personnel_full_name?: string;
    destination: string;
    given_date: string;
    given_time: string;
    return_date: string | null;
    return_time: string | null;
    status: 'in_use' | 'returned';
    notes: string | null;
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
    phone: string | null;
    notes: string | null;
    subcontractor_worker?: boolean;
    for_electric_station?: boolean;
    entry_date: string | null;
    entry_time: string | null;
    exit_date: string | null;
    exit_time: string | null;
    status: 'inside' | 'exited';
    personnel: string | null;
    created_at: string | null;
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
    entry_date: string | null;
    entry_time: string | null;
    exit_date?: string | null;
    exit_time?: string | null;
    status: 'inside' | 'exited';
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
export interface SgkRecord {
    id: string;
    hashed_tc: string;
    full_name: string;
    company_name: string | null;
    file_path: string;
    upload_date: string;
    notes: string | null;
    personnel: string | null;
    created_at: string | null;
}

export interface SgkFormData {
    tc_no: string;
    full_name: string;
    company_name: string;
    notes: string;
    pdf_file: File | null;
}

export interface SgkSearchData {
    search_type: 'tc' | 'name' | 'company';
    tc_no?: string;
    full_name?: string;
    company_name?: string;
}

// Form Types
export interface VehicleFormData {
    vehicle_id: string;
    manager_id: string;
    manager_name: string;
    destination: string;
    notes: string;
}

export interface VisitorFormData {
    vehicle_plate: string;
    full_name: string;
    company_name: string;
    visiting_person: string;
    person_count: string | number;
    phone: string;
    notes: string;
    subcontractor_worker: boolean;
    for_electric_station: boolean;
    send_whatsapp?: boolean;  // WhatsApp bildirimi (opsiyonel, sadece yeni kayıtlarda)
}

// API Response Types
export interface ApiResponse<T> {
    success: boolean;
    data: T;
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
export type VehicleFilterType = 'all' | 'in_use' | 'returned';
export type VisitorFilterType = 'today' | 'inside' | 'exits' | 'all' | 'subcontractor' | 'electric';
export type ManagerFilterType = 'all' | 'inside' | 'exited';
export type IncidentFilterType = 'all' | 'open' | 'closed';
