-- =====================================================
-- Migration: Önceden Tanımlı Ziyaretçiler Tablosunu Oluştur
-- =====================================================

CREATE TABLE IF NOT EXISTS predefined_visitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(100) NOT NULL,
    company_name VARCHAR(100),
    phone VARCHAR(20),
    vehicle_plate VARCHAR(20),
    visiting_person VARCHAR(100),
    notes TEXT,
    subcontractor_worker BOOLEAN DEFAULT false,
    for_electric_station BOOLEAN DEFAULT false,
    daily_guest BOOLEAN DEFAULT false,
    entry_tag BOOLEAN DEFAULT false,
    exit_tag BOOLEAN DEFAULT false,
    tour_entry BOOLEAN DEFAULT false,
    tour_exit BOOLEAN DEFAULT false,
    meeting BOOLEAN DEFAULT false,
    delivery BOOLEAN DEFAULT false,
    guide BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL
);

-- Hızlı Türkçe arama (case-insensitive & accent-insensitive) için B-Tree indeksi
CREATE INDEX IF NOT EXISTS idx_predefined_visitors_search_name 
ON predefined_visitors (LOWER(translate(full_name, 'IİĞÜŞÖÇ', 'ıiğüşöç')));

-- Soft delete sorgularını optimize etmek için indeks
CREATE INDEX IF NOT EXISTS idx_predefined_visitors_deleted_at 
ON predefined_visitors(deleted_at);

-- updated_at trigger'ını tanımla
DROP TRIGGER IF EXISTS update_predefined_visitors_updated_at ON predefined_visitors;
CREATE TRIGGER update_predefined_visitors_updated_at 
    BEFORE UPDATE ON predefined_visitors
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Tablo yorumları
COMMENT ON TABLE predefined_visitors IS 'Hızlı kayıt girişleri için önceden tanımlanmış kayıtlı ziyaretçi bilgileri';
