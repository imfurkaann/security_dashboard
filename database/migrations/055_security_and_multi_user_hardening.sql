-- Oturum doğrulaması ve yatay ölçeklenebilir QR formları için güvenlik
-- indeksleri. QR anahtarının kendisi değil yalnızca SHA-256 özeti saklanır.

CREATE INDEX IF NOT EXISTS idx_personnel_records_open_session
    ON personnel_records (id, personnel_id)
    WHERE logout_time IS NULL;

CREATE TABLE IF NOT EXISTS qr_form_tokens (
    token_hash CHAR(64) PRIMARY KEY,
    requester_ip VARCHAR(64) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL,
    CONSTRAINT chk_qr_form_token_expiry CHECK (expires_at > issued_at)
);

CREATE INDEX IF NOT EXISTS idx_qr_form_tokens_expiry
    ON qr_form_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_qr_form_tokens_unconsumed
    ON qr_form_tokens (token_hash, expires_at)
    WHERE consumed_at IS NULL;

COMMENT ON TABLE qr_form_tokens IS
    'Tek kullanımlık halka açık QR form anahtarlarının çoklu backend örnekleri arasında atomik doğrulanması';
