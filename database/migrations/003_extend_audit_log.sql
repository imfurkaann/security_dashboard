-- =====================================================
-- Migration: Audit Log tablosuna ek action türleri ekle
-- GÜVENLİK: Login/Logout olaylarını da kaydet
-- =====================================================

-- Mevcut CHECK constraint'i kaldır
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;

-- Yeni CHECK constraint ekle (LOGIN, LOGOUT, FAILED_LOGIN dahil)
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check 
    CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'LOGIN', 'LOGOUT', 'FAILED_LOGIN'));

-- user_agent kolonu yoksa ekle
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'audit_log' AND column_name = 'user_agent') THEN
        ALTER TABLE audit_log ADD COLUMN user_agent TEXT;
    END IF;
END $$;

-- Performans için ek indeksler
CREATE INDEX IF NOT EXISTS idx_audit_log_action_login ON audit_log(action) WHERE action IN ('LOGIN', 'LOGOUT', 'FAILED_LOGIN');
CREATE INDEX IF NOT EXISTS idx_audit_log_ip_address ON audit_log(ip_address);

-- Yorum: Bu migration güvenlik audit logları için gereklidir
COMMENT ON TABLE audit_log IS 'Tüm kritik işlemlerin güvenlik kaydı - KVKK ve güvenlik denetimleri için';
