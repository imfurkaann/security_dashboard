-- Tüm verileri temizle (araçlar, müdürler, personeller, adminler hariç)
-- Foreign key kısıtlamaları nedeniyle sıra önemli

DELETE FROM sgk_record_files;
DELETE FROM misafir_kayitlari;
DELETE FROM incident_categories;
DELETE FROM audit_log;
DELETE FROM shift_reports;
DELETE FROM equipment_checks;
DELETE FROM personnel_records;
DELETE FROM sgk_records;
DELETE FROM fire_alarms;
DELETE FROM incidents;
DELETE FROM visitors;

-- Sequence'leri sıfırla (ID numaraları 1'den başlasın)
ALTER SEQUENCE sgk_record_files_id_seq RESTART WITH 1;
ALTER SEQUENCE misafir_kayitlari_id_seq RESTART WITH 1;
ALTER SEQUENCE incident_categories_id_seq RESTART WITH 1;
ALTER SEQUENCE audit_log_id_seq RESTART WITH 1;
ALTER SEQUENCE shift_reports_id_seq RESTART WITH 1;
ALTER SEQUENCE equipment_checks_id_seq RESTART WITH 1;
ALTER SEQUENCE personnel_records_id_seq RESTART WITH 1;
ALTER SEQUENCE sgk_records_id_seq RESTART WITH 1;
ALTER SEQUENCE fire_alarms_id_seq RESTART WITH 1;
ALTER SEQUENCE incidents_id_seq RESTART WITH 1;
ALTER SEQUENCE visitors_id_seq RESTART WITH 1;

SELECT 'Veri temizleme tamamlandı!' as result;
