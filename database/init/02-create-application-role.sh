#!/bin/sh
set -eu

APP_ROLE="${DB_APP_USER:-security_app}"
AUDIT_OWNER_ROLE="${APP_ROLE}_audit_owner"
APP_PASSWORD="$(cat /run/secrets/db_password)"

# psql değişkenleri değerleri SQL literal/identifier olarak güvenle quote eder.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_role="$APP_ROLE" --set=audit_owner_role="$AUDIT_OWNER_ROLE" --set=app_password="$APP_PASSWORD" <<'SQL'
SELECT format(
  CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role')
       THEN 'ALTER ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L'
       ELSE 'CREATE ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L'
  END,
  :'app_role', :'app_password'
) \gexec

SELECT format(
  CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'audit_owner_role')
       THEN 'ALTER ROLE %I WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION'
       ELSE 'CREATE ROLE %I WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION'
  END,
  :'audit_owner_role'
) \gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app_role') \gexec
SELECT format('GRANT USAGE, CREATE ON SCHEMA public TO %I', :'app_role') \gexec
SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', :'app_role') \gexec
SELECT format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO %I', :'app_role') \gexec
SELECT format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO %I', :'app_role') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', :'app_role') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I', :'app_role') \gexec

-- Uygulama migration'larının kendi tablolarını değiştirebilmesi için yalnızca
-- public şemasındaki uygulama nesnelerinin sahipliğini devret. Sistem katalogları
-- ve PostgreSQL yönetim yetkileri postgres rolünde kalır.
SELECT format('ALTER TABLE %I.%I OWNER TO %I', schemaname, tablename, :'app_role')
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename <> 'audit_log'
\gexec

SELECT format('ALTER SEQUENCE %I.%I OWNER TO %I', sequence_schema, sequence_name, :'app_role')
FROM information_schema.sequences
WHERE sequence_schema = 'public'
\gexec

SELECT format('ALTER VIEW %I.%I OWNER TO %I', schemaname, viewname, :'app_role')
FROM pg_views
WHERE schemaname = 'public'
\gexec

SELECT format('ALTER TABLE public.audit_log OWNER TO %I', :'audit_owner_role') \gexec
SELECT format('REVOKE ALL ON TABLE public.audit_log FROM %I', :'app_role') \gexec
SELECT format('GRANT SELECT, INSERT ON TABLE public.audit_log TO %I', :'app_role') \gexec

ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_changed_by_fkey;
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_changed_by_fkey
  FOREIGN KEY (changed_by) REFERENCES public.personnel(id) ON DELETE SET NULL;
SQL
