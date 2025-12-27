-- Migration 019: Create Incident Categories - Manual Run Script
-- Bu dosyayı Docker çalıştığında elle çalıştırın

-- Terminal'de çalıştırın:
-- cd database
-- Get-Content migrations/019_create_incident_categories.sql | docker exec -i security-db-1 psql -U postgres -d security_db

-- Veya Docker içinde:
-- docker exec -it security-db-1 psql -U postgres -d security_db -f /docker-entrypoint-initdb.d/migrations/019_create_incident_categories.sql
