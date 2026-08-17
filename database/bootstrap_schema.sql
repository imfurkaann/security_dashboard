--
-- PostgreSQL database dump
--

-- Dumped from database version 17.2
-- Dumped by pg_dump version 17.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.visitor_records DROP CONSTRAINT IF EXISTS visitor_records_exit_by_fkey;
ALTER TABLE IF EXISTS ONLY public.visitor_records DROP CONSTRAINT IF EXISTS visitor_records_entry_by_fkey;
ALTER TABLE IF EXISTS ONLY public.vehicle_records DROP CONSTRAINT IF EXISTS vehicle_records_vehicle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.vehicle_records DROP CONSTRAINT IF EXISTS vehicle_records_returned_by_fkey;
ALTER TABLE IF EXISTS ONLY public.vehicle_records DROP CONSTRAINT IF EXISTS vehicle_records_manager_id_fkey;
ALTER TABLE IF EXISTS ONLY public.vehicle_records DROP CONSTRAINT IF EXISTS vehicle_records_given_by_fkey;
ALTER TABLE IF EXISTS ONLY public.sgk_records DROP CONSTRAINT IF EXISTS sgk_records_personnel_id_fkey;
ALTER TABLE IF EXISTS ONLY public.sgk_record_files DROP CONSTRAINT IF EXISTS sgk_record_files_sgk_record_id_fkey;
ALTER TABLE IF EXISTS ONLY public.personnel_records DROP CONSTRAINT IF EXISTS personnel_records_personnel_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pending_qr_sgk_files DROP CONSTRAINT IF EXISTS pending_qr_sgk_files_pending_sgk_id_fkey;
ALTER TABLE IF EXISTS ONLY public.misafir_kayitlari DROP CONSTRAINT IF EXISTS misafir_kayitlari_created_by_fkey;
ALTER TABLE IF EXISTS ONLY public.managers_records DROP CONSTRAINT IF EXISTS managers_records_manager_id_fkey;
ALTER TABLE IF EXISTS ONLY public.managers_records DROP CONSTRAINT IF EXISTS managers_records_exit_by_fkey;
ALTER TABLE IF EXISTS ONLY public.managers_records DROP CONSTRAINT IF EXISTS managers_records_entry_by_fkey;
ALTER TABLE IF EXISTS ONLY public.incidents DROP CONSTRAINT IF EXISTS incidents_resolved_by_fkey;
ALTER TABLE IF EXISTS ONLY public.incidents DROP CONSTRAINT IF EXISTS incidents_recorded_by_fkey;
ALTER TABLE IF EXISTS ONLY public.incident_categories DROP CONSTRAINT IF EXISTS incident_categories_incident_id_fkey;
ALTER TABLE IF EXISTS ONLY public.gate_equipments DROP CONSTRAINT IF EXISTS gate_equipments_gate_id_fkey;
ALTER TABLE IF EXISTS ONLY public.fire_alarms DROP CONSTRAINT IF EXISTS fire_alarms_resolved_by_fkey;
ALTER TABLE IF EXISTS ONLY public.fire_alarms DROP CONSTRAINT IF EXISTS fire_alarms_recorded_by_fkey;
ALTER TABLE IF EXISTS ONLY public.equipment_checks DROP CONSTRAINT IF EXISTS equipment_checks_personnel_record_id_fkey;
ALTER TABLE IF EXISTS ONLY public.equipment_checks DROP CONSTRAINT IF EXISTS equipment_checks_personnel_id_fkey;
ALTER TABLE IF EXISTS ONLY public.audit_log DROP CONSTRAINT IF EXISTS audit_log_changed_by_fkey;
DROP TRIGGER IF EXISTS update_visitor_records_updated_at ON public.visitor_records;
DROP TRIGGER IF EXISTS update_vehicles_updated_at ON public.vehicles;
DROP TRIGGER IF EXISTS update_vehicle_records_updated_at ON public.vehicle_records;
DROP TRIGGER IF EXISTS update_personnel_updated_at ON public.personnel;
DROP TRIGGER IF EXISTS update_misafir_kayitlari_updated_at ON public.misafir_kayitlari;
DROP TRIGGER IF EXISTS update_managers_updated_at ON public.managers;
DROP TRIGGER IF EXISTS update_managers_records_updated_at ON public.managers_records;
DROP TRIGGER IF EXISTS update_incidents_updated_at ON public.incidents;
DROP TRIGGER IF EXISTS trigger_update_sgk_records_updated_at ON public.sgk_records;
DROP TRIGGER IF EXISTS trigger_update_pending_qr_sgk_updated_at ON public.pending_qr_sgk;
DROP TRIGGER IF EXISTS trigger_update_incident_categories_updated_at ON public.incident_categories;
DROP TRIGGER IF EXISTS trigger_sync_visitor_personnel_names ON public.visitor_records;
DROP TRIGGER IF EXISTS trigger_sync_vehicle_personnel_names ON public.vehicle_records;
DROP TRIGGER IF EXISTS trigger_sync_sgk_personnel_name ON public.sgk_records;
DROP TRIGGER IF EXISTS trigger_sync_manager_record_personnel_names ON public.managers_records;
DROP TRIGGER IF EXISTS trigger_sync_manager_name ON public.vehicle_records;
DROP TRIGGER IF EXISTS trigger_sync_incident_recorded_by_name ON public.incidents;
DROP TRIGGER IF EXISTS trigger_sync_fire_alarm_personnel_names ON public.fire_alarms;
DROP INDEX IF EXISTS public.uq_vehicles_plate_active;
DROP INDEX IF EXISTS public.uq_vehicle_records_one_active_use;
DROP INDEX IF EXISTS public.uq_sgk_records_active_hashed_tc;
DROP INDEX IF EXISTS public.uq_sgk_records_active_hashed_passport;
DROP INDEX IF EXISTS public.uq_misafir_kayitlari_sheet_row_active;
DROP INDEX IF EXISTS public.uq_managers_records_one_active_inside;
DROP INDEX IF EXISTS public.uq_managers_active_normalized_name;
DROP INDEX IF EXISTS public.uq_incidents_active_shift_report_per_gate_day;
DROP INDEX IF EXISTS public.idx_visitor_records_visiting_person_trgm;
DROP INDEX IF EXISTS public.idx_visitor_records_status_entry_datetime;
DROP INDEX IF EXISTS public.idx_visitor_records_status;
DROP INDEX IF EXISTS public.idx_visitor_records_plate_trgm;
DROP INDEX IF EXISTS public.idx_visitor_records_plate;
DROP INDEX IF EXISTS public.idx_visitor_records_phone_trgm;
DROP INDEX IF EXISTS public.idx_visitor_records_normalized_name_tr;
DROP INDEX IF EXISTS public.idx_visitor_records_gate_entry_datetime;
DROP INDEX IF EXISTS public.idx_visitor_records_full_name_trgm;
DROP INDEX IF EXISTS public.idx_visitor_records_exit_datetime_id;
DROP INDEX IF EXISTS public.idx_visitor_records_exit_by_name;
DROP INDEX IF EXISTS public.idx_visitor_records_exit_by;
DROP INDEX IF EXISTS public.idx_visitor_records_entry_datetime_id;
DROP INDEX IF EXISTS public.idx_visitor_records_entry_by_name;
DROP INDEX IF EXISTS public.idx_visitor_records_entry_by;
DROP INDEX IF EXISTS public.idx_visitor_records_deleted_at_id;
DROP INDEX IF EXISTS public.idx_visitor_records_date_time;
DROP INDEX IF EXISTS public.idx_visitor_records_date;
DROP INDEX IF EXISTS public.idx_visitor_records_company_name_trgm;
DROP INDEX IF EXISTS public.idx_vehicles_status;
DROP INDEX IF EXISTS public.idx_vehicles_plate;
DROP INDEX IF EXISTS public.idx_vehicle_records_vehicle;
DROP INDEX IF EXISTS public.idx_vehicle_records_status;
DROP INDEX IF EXISTS public.idx_vehicle_records_returned_by_name;
DROP INDEX IF EXISTS public.idx_vehicle_records_returned_by;
DROP INDEX IF EXISTS public.idx_vehicle_records_return_date_time;
DROP INDEX IF EXISTS public.idx_vehicle_records_manager;
DROP INDEX IF EXISTS public.idx_vehicle_records_given_by_name;
DROP INDEX IF EXISTS public.idx_vehicle_records_given_by;
DROP INDEX IF EXISTS public.idx_vehicle_records_gate_date_time;
DROP INDEX IF EXISTS public.idx_vehicle_records_destination;
DROP INDEX IF EXISTS public.idx_vehicle_records_deleted_at;
DROP INDEX IF EXISTS public.idx_vehicle_records_date_time;
DROP INDEX IF EXISTS public.idx_vehicle_records_date;
DROP INDEX IF EXISTS public.idx_system_settings_updated_at;
DROP INDEX IF EXISTS public.idx_sgk_records_upload_date;
DROP INDEX IF EXISTS public.idx_sgk_records_personnel_name;
DROP INDEX IF EXISTS public.idx_sgk_records_personnel;
DROP INDEX IF EXISTS public.idx_sgk_records_hashed_tc;
DROP INDEX IF EXISTS public.idx_sgk_records_hashed_passport;
DROP INDEX IF EXISTS public.idx_sgk_records_full_name;
DROP INDEX IF EXISTS public.idx_sgk_records_deleted_at;
DROP INDEX IF EXISTS public.idx_sgk_records_company_name;
DROP INDEX IF EXISTS public.idx_sgk_records_active_upload_order;
DROP INDEX IF EXISTS public.idx_sgk_record_files_record_id;
DROP INDEX IF EXISTS public.idx_sgk_record_files_deleted_at;
DROP INDEX IF EXISTS public.idx_sgk_record_files_active_record_order;
DROP INDEX IF EXISTS public.idx_personnel_weekly_login_week_start;
DROP INDEX IF EXISTS public.idx_personnel_username_active_unique;
DROP INDEX IF EXISTS public.idx_personnel_username;
DROP INDEX IF EXISTS public.idx_personnel_role;
DROP INDEX IF EXISTS public.idx_personnel_records_personnel_id;
DROP INDEX IF EXISTS public.idx_personnel_records_logout_time;
DROP INDEX IF EXISTS public.idx_personnel_records_login_time;
DROP INDEX IF EXISTS public.idx_pending_qr_visitors_status;
DROP INDEX IF EXISTS public.idx_pending_qr_sgk_status;
DROP INDEX IF EXISTS public.idx_pending_qr_sgk_files_sgk_id;
DROP INDEX IF EXISTS public.idx_misafir_kayitlari_voucher;
DROP INDEX IF EXISTS public.idx_misafir_kayitlari_ulke;
DROP INDEX IF EXISTS public.idx_misafir_kayitlari_soyadi;
DROP INDEX IF EXISTS public.idx_misafir_kayitlari_search_text_trgm;
DROP INDEX IF EXISTS public.idx_misafir_kayitlari_row_data_gin;
DROP INDEX IF EXISTS public.idx_misafir_kayitlari_oda;
DROP INDEX IF EXISTS public.idx_misafir_kayitlari_giris_tarihi;
DROP INDEX IF EXISTS public.idx_misafir_kayitlari_created_at;
DROP INDEX IF EXISTS public.idx_misafir_kayitlari_cikis_tarihi;
DROP INDEX IF EXISTS public.idx_misafir_kayitlari_adi;
DROP INDEX IF EXISTS public.idx_misafir_kayitlari_acenta;
DROP INDEX IF EXISTS public.idx_managers_records_status;
DROP INDEX IF EXISTS public.idx_managers_records_manager_name;
DROP INDEX IF EXISTS public.idx_managers_records_manager;
DROP INDEX IF EXISTS public.idx_managers_records_exit_sort;
DROP INDEX IF EXISTS public.idx_managers_records_exit_by_name;
DROP INDEX IF EXISTS public.idx_managers_records_exit_by;
DROP INDEX IF EXISTS public.idx_managers_records_entry_date;
DROP INDEX IF EXISTS public.idx_managers_records_entry_by_name;
DROP INDEX IF EXISTS public.idx_managers_records_entry_by;
DROP INDEX IF EXISTS public.idx_managers_records_deleted_sort;
DROP INDEX IF EXISTS public.idx_managers_records_date_time;
DROP INDEX IF EXISTS public.idx_managers_records_active_sort;
DROP INDEX IF EXISTS public.idx_managers_active;
DROP INDEX IF EXISTS public.idx_incidents_shift_label;
DROP INDEX IF EXISTS public.idx_incidents_severity;
DROP INDEX IF EXISTS public.idx_incidents_resolved;
DROP INDEX IF EXISTS public.idx_incidents_report_file_path;
DROP INDEX IF EXISTS public.idx_incidents_report_date;
DROP INDEX IF EXISTS public.idx_incidents_recorded_by_name;
DROP INDEX IF EXISTS public.idx_incidents_recorded_by;
DROP INDEX IF EXISTS public.idx_incidents_incident_type;
DROP INDEX IF EXISTS public.idx_incidents_incident_time;
DROP INDEX IF EXISTS public.idx_incidents_deleted_at;
DROP INDEX IF EXISTS public.idx_incidents_active_report_date;
DROP INDEX IF EXISTS public.idx_incidents_active_incident_time_id;
DROP INDEX IF EXISTS public.idx_incidents_active_gate_incident_time_id;
DROP INDEX IF EXISTS public.idx_incident_categories_unique_incident;
DROP INDEX IF EXISTS public.idx_incident_categories_incident;
DROP INDEX IF EXISTS public.idx_incident_categories_filter_flags;
DROP INDEX IF EXISTS public.idx_incident_categories_created_at;
DROP INDEX IF EXISTS public.idx_gate_equipments_gate_id;
DROP INDEX IF EXISTS public.idx_gate_equipments_active;
DROP INDEX IF EXISTS public.idx_fire_alarms_resolved_by_name;
DROP INDEX IF EXISTS public.idx_fire_alarms_resolved_by;
DROP INDEX IF EXISTS public.idx_fire_alarms_resolved;
DROP INDEX IF EXISTS public.idx_fire_alarms_recorded_by_name;
DROP INDEX IF EXISTS public.idx_fire_alarms_recorded_by;
DROP INDEX IF EXISTS public.idx_fire_alarms_location;
DROP INDEX IF EXISTS public.idx_fire_alarms_deleted_alarm_time_id;
DROP INDEX IF EXISTS public.idx_fire_alarms_alarm_time;
DROP INDEX IF EXISTS public.idx_fire_alarms_alarm_number;
DROP INDEX IF EXISTS public.idx_fire_alarms_active_resolution_time;
DROP INDEX IF EXISTS public.idx_fire_alarms_active_gate_alarm_time;
DROP INDEX IF EXISTS public.idx_fire_alarms_active_alarm_time_id;
DROP INDEX IF EXISTS public.idx_equipment_gates_active;
DROP INDEX IF EXISTS public.idx_equipment_checks_personnel_record_id;
DROP INDEX IF EXISTS public.idx_equipment_checks_personnel_id;
DROP INDEX IF EXISTS public.idx_equipment_checks_checked_at;
DROP INDEX IF EXISTS public.idx_audit_log_table_name;
DROP INDEX IF EXISTS public.idx_audit_log_record_id;
DROP INDEX IF EXISTS public.idx_audit_log_ip_address;
DROP INDEX IF EXISTS public.idx_audit_log_changed_by;
DROP INDEX IF EXISTS public.idx_audit_log_changed_at;
DROP INDEX IF EXISTS public.idx_audit_log_action_login;
DROP INDEX IF EXISTS public.idx_audit_log_action;
ALTER TABLE IF EXISTS ONLY public.visitor_records DROP CONSTRAINT IF EXISTS visitor_records_pkey;
ALTER TABLE IF EXISTS public.visitor_records DROP CONSTRAINT IF EXISTS visitor_records_full_chronology_check;
ALTER TABLE IF EXISTS ONLY public.vehicles DROP CONSTRAINT IF EXISTS vehicles_pkey;
ALTER TABLE IF EXISTS ONLY public.vehicle_records DROP CONSTRAINT IF EXISTS vehicle_records_pkey;
ALTER TABLE IF EXISTS ONLY public.system_settings DROP CONSTRAINT IF EXISTS system_settings_pkey;
ALTER TABLE IF EXISTS ONLY public.sgk_records DROP CONSTRAINT IF EXISTS sgk_records_pkey;
ALTER TABLE IF EXISTS ONLY public.sgk_record_files DROP CONSTRAINT IF EXISTS sgk_record_files_pkey;
ALTER TABLE IF EXISTS ONLY public.personnel_records DROP CONSTRAINT IF EXISTS personnel_records_pkey;
ALTER TABLE IF EXISTS ONLY public.personnel DROP CONSTRAINT IF EXISTS personnel_pkey;
ALTER TABLE IF EXISTS ONLY public.pending_qr_visitors DROP CONSTRAINT IF EXISTS pending_qr_visitors_pkey;
ALTER TABLE IF EXISTS ONLY public.pending_qr_sgk DROP CONSTRAINT IF EXISTS pending_qr_sgk_pkey;
ALTER TABLE IF EXISTS ONLY public.pending_qr_sgk_files DROP CONSTRAINT IF EXISTS pending_qr_sgk_files_pkey;
ALTER TABLE IF EXISTS ONLY public.misafir_kayitlari DROP CONSTRAINT IF EXISTS misafir_kayitlari_pkey;
ALTER TABLE IF EXISTS ONLY public.migration_history DROP CONSTRAINT IF EXISTS migration_history_pkey;
ALTER TABLE IF EXISTS ONLY public.migration_history DROP CONSTRAINT IF EXISTS migration_history_migration_name_key;
ALTER TABLE IF EXISTS ONLY public.managers_records DROP CONSTRAINT IF EXISTS managers_records_pkey;
ALTER TABLE IF EXISTS ONLY public.managers DROP CONSTRAINT IF EXISTS managers_pkey;
ALTER TABLE IF EXISTS ONLY public.incidents DROP CONSTRAINT IF EXISTS incidents_pkey;
ALTER TABLE IF EXISTS ONLY public.incident_categories DROP CONSTRAINT IF EXISTS incident_categories_pkey;
ALTER TABLE IF EXISTS ONLY public.gate_equipments DROP CONSTRAINT IF EXISTS gate_equipments_pkey;
ALTER TABLE IF EXISTS ONLY public.gate_equipments DROP CONSTRAINT IF EXISTS gate_equipments_gate_id_name_key;
ALTER TABLE IF EXISTS ONLY public.fire_alarms DROP CONSTRAINT IF EXISTS fire_alarms_pkey;
ALTER TABLE IF EXISTS ONLY public.equipment_gates DROP CONSTRAINT IF EXISTS equipment_gates_pkey;
ALTER TABLE IF EXISTS ONLY public.equipment_gates DROP CONSTRAINT IF EXISTS equipment_gates_code_key;
ALTER TABLE IF EXISTS ONLY public.equipment_checks DROP CONSTRAINT IF EXISTS equipment_checks_pkey;
ALTER TABLE IF EXISTS ONLY public.audit_log DROP CONSTRAINT IF EXISTS audit_log_pkey;
ALTER TABLE IF EXISTS public.personnel_records ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.migration_history ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.incident_categories ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.gate_equipments ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.equipment_gates ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.equipment_checks ALTER COLUMN id DROP DEFAULT;
DROP TABLE IF EXISTS public.visitor_records;
DROP TABLE IF EXISTS public.vehicles;
DROP TABLE IF EXISTS public.vehicle_records;
DROP TABLE IF EXISTS public.system_settings;
DROP TABLE IF EXISTS public.sgk_records;
DROP TABLE IF EXISTS public.sgk_record_files;
DROP SEQUENCE IF EXISTS public.personnel_records_id_seq;
DROP TABLE IF EXISTS public.personnel_records;
DROP TABLE IF EXISTS public.personnel;
DROP TABLE IF EXISTS public.pending_qr_visitors;
DROP TABLE IF EXISTS public.pending_qr_sgk_files;
DROP TABLE IF EXISTS public.pending_qr_sgk;
DROP TABLE IF EXISTS public.misafir_kayitlari;
DROP SEQUENCE IF EXISTS public.migration_history_id_seq;
DROP TABLE IF EXISTS public.migration_history;
DROP TABLE IF EXISTS public.managers_records;
DROP TABLE IF EXISTS public.managers;
DROP TABLE IF EXISTS public.incidents;
DROP SEQUENCE IF EXISTS public.incident_categories_id_seq;
DROP TABLE IF EXISTS public.incident_categories;
DROP SEQUENCE IF EXISTS public.gate_equipments_id_seq;
DROP TABLE IF EXISTS public.gate_equipments;
DROP TABLE IF EXISTS public.fire_alarms;
DROP SEQUENCE IF EXISTS public.equipment_gates_id_seq;
DROP TABLE IF EXISTS public.equipment_gates;
DROP SEQUENCE IF EXISTS public.equipment_checks_id_seq;
DROP TABLE IF EXISTS public.equipment_checks;
DROP TABLE IF EXISTS public.audit_log;
DROP FUNCTION IF EXISTS public.update_updated_at_column();
DROP FUNCTION IF EXISTS public.update_sgk_records_updated_at();
DROP FUNCTION IF EXISTS public.update_pending_qr_sgk_updated_at();
DROP FUNCTION IF EXISTS public.update_incident_categories_updated_at();
DROP FUNCTION IF EXISTS public.sync_visitor_personnel_names();
DROP FUNCTION IF EXISTS public.sync_visitor_personnel_name();
DROP FUNCTION IF EXISTS public.sync_vehicle_personnel_names();
DROP FUNCTION IF EXISTS public.sync_vehicle_personnel_name();
DROP FUNCTION IF EXISTS public.sync_sgk_personnel_name();
DROP FUNCTION IF EXISTS public.sync_manager_record_personnel_names();
DROP FUNCTION IF EXISTS public.sync_manager_name();
DROP FUNCTION IF EXISTS public.sync_incident_recorded_by_name();
DROP FUNCTION IF EXISTS public.sync_fire_alarm_recorded_by_name();
DROP FUNCTION IF EXISTS public.sync_fire_alarm_personnel_names();
DROP EXTENSION IF EXISTS "uuid-ossp";
DROP EXTENSION IF EXISTS pg_trgm;
--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: sync_fire_alarm_personnel_names(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_fire_alarm_personnel_names() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.recorded_by IS NOT NULL AND NEW.recorded_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.recorded_by_name
        FROM personnel
        WHERE id = NEW.recorded_by;
    END IF;
    
    IF NEW.resolved_by IS NOT NULL AND NEW.resolved_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.resolved_by_name
        FROM personnel
        WHERE id = NEW.resolved_by;
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: sync_fire_alarm_recorded_by_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_fire_alarm_recorded_by_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.recorded_by IS NOT NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.recorded_by_name
        FROM personnel
        WHERE id = NEW.recorded_by;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: sync_incident_recorded_by_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_incident_recorded_by_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.recorded_by IS NOT NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.recorded_by_name
        FROM personnel
        WHERE id = NEW.recorded_by;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: sync_manager_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_manager_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN IF NEW.manager_id IS NOT NULL AND NEW.manager_name IS NULL THEN SELECT first_name || ' ' || last_name INTO NEW.manager_name FROM managers WHERE id = NEW.manager_id; END IF; RETURN NEW; END; $$;


--
-- Name: sync_manager_record_personnel_names(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_manager_record_personnel_names() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.entry_by IS NOT NULL AND NEW.entry_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.entry_by_name
        FROM personnel
        WHERE id = NEW.entry_by;
    END IF;
    
    IF NEW.exit_by IS NOT NULL AND NEW.exit_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.exit_by_name
        FROM personnel
        WHERE id = NEW.exit_by;
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: sync_sgk_personnel_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_sgk_personnel_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.personnel_id IS NOT NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.personnel_name
        FROM personnel
        WHERE id = NEW.personnel_id;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: sync_vehicle_personnel_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_vehicle_personnel_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.personnel_id IS NOT NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.personnel_name
        FROM personnel
        WHERE id = NEW.personnel_id;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: sync_vehicle_personnel_names(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_vehicle_personnel_names() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.given_by IS NOT NULL AND NEW.given_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.given_by_name
        FROM personnel
        WHERE id = NEW.given_by;
    END IF;
    
    IF NEW.returned_by IS NOT NULL AND NEW.returned_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.returned_by_name
        FROM personnel
        WHERE id = NEW.returned_by;
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: sync_visitor_personnel_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_visitor_personnel_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.personnel_id IS NOT NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.personnel_name
        FROM personnel
        WHERE id = NEW.personnel_id;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: sync_visitor_personnel_names(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_visitor_personnel_names() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.entry_by IS NOT NULL AND NEW.entry_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.entry_by_name
        FROM personnel
        WHERE id = NEW.entry_by;
    END IF;
    
    IF NEW.exit_by IS NOT NULL AND NEW.exit_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.exit_by_name
        FROM personnel
        WHERE id = NEW.exit_by;
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: update_incident_categories_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_incident_categories_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_pending_qr_sgk_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_pending_qr_sgk_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_sgk_records_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_sgk_records_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    table_name character varying(50) NOT NULL,
    record_id character varying(100) NOT NULL,
    action character varying(20) NOT NULL,
    old_values jsonb,
    new_values jsonb,
    changed_by uuid,
    ip_address character varying(45),
    user_agent text,
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT audit_log_action_check CHECK (((action)::text = ANY (ARRAY[('INSERT'::character varying)::text, ('UPDATE'::character varying)::text, ('DELETE'::character varying)::text, ('SOFT_DELETE'::character varying)::text, ('LOGIN'::character varying)::text, ('LOGOUT'::character varying)::text, ('FAILED_LOGIN'::character varying)::text])))
);


--
-- Name: TABLE audit_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_log IS 'Tüm kritik işlemlerin güvenlik kaydı - KVKK uyumluluğu için';


--
-- Name: equipment_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_checks (
    id integer NOT NULL,
    personnel_record_id integer NOT NULL,
    personnel_id uuid NOT NULL,
    television_status boolean DEFAULT false NOT NULL,
    monitor_status boolean DEFAULT false NOT NULL,
    phone_status boolean DEFAULT false NOT NULL,
    breathalyzer_status boolean DEFAULT false NOT NULL,
    television_reason text,
    monitor_reason text,
    phone_reason text,
    breathalyzer_reason text,
    whatsapp_sent boolean DEFAULT false NOT NULL,
    whatsapp_message text,
    checked_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    equipment_details jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: TABLE equipment_checks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.equipment_checks IS 'Records equipment condition acknowledgment by personnel at start of shift';


--
-- Name: COLUMN equipment_checks.television_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment_checks.television_status IS 'Whether personnel confirmed television is in good condition';


--
-- Name: COLUMN equipment_checks.monitor_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment_checks.monitor_status IS 'Whether personnel confirmed monitor is in good condition';


--
-- Name: COLUMN equipment_checks.phone_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment_checks.phone_status IS 'Whether personnel confirmed phone is in good condition';


--
-- Name: COLUMN equipment_checks.breathalyzer_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment_checks.breathalyzer_status IS 'Whether personnel confirmed breathalyzer (alkol metre) is in good condition';


--
-- Name: COLUMN equipment_checks.television_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment_checks.television_reason IS 'Reason if television is not in good condition';


--
-- Name: COLUMN equipment_checks.monitor_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment_checks.monitor_reason IS 'Reason if monitor is not in good condition';


--
-- Name: COLUMN equipment_checks.phone_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment_checks.phone_reason IS 'Reason if phone is not in good condition';


--
-- Name: COLUMN equipment_checks.breathalyzer_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment_checks.breathalyzer_reason IS 'Reason if breathalyzer is not in good condition';


--
-- Name: COLUMN equipment_checks.equipment_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.equipment_checks.equipment_details IS 'Dynamic per-gate equipment status payload';


--
-- Name: equipment_checks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.equipment_checks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipment_checks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.equipment_checks_id_seq OWNED BY public.equipment_checks.id;


--
-- Name: equipment_gates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_gates (
    id integer NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE equipment_gates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.equipment_gates IS 'Admin-managed gate definitions used by shift start workflow';


--
-- Name: equipment_gates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.equipment_gates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipment_gates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.equipment_gates_id_seq OWNED BY public.equipment_gates.id;


--
-- Name: fire_alarms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fire_alarms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    location character varying(255) NOT NULL,
    alarm_time timestamp without time zone DEFAULT now() NOT NULL,
    resolved boolean DEFAULT false,
    resolution_time timestamp without time zone,
    resolution_notes text,
    false_alarm boolean DEFAULT false,
    recorded_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    deleted_at timestamp without time zone,
    alarm_number character varying(50),
    recorded_by_name character varying(200),
    resolved_by uuid,
    resolved_by_name character varying(200),
    gate character varying(100)
);


--
-- Name: TABLE fire_alarms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fire_alarms IS 'Yangın alarm kayıtları tablosu';


--
-- Name: COLUMN fire_alarms.location; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.location IS 'Alarmın çaldığı konum';


--
-- Name: COLUMN fire_alarms.alarm_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.alarm_time IS 'Alarmın çaldığı zaman';


--
-- Name: COLUMN fire_alarms.resolved; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.resolved IS 'Alarm durumu çözüldü mü';


--
-- Name: COLUMN fire_alarms.resolution_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.resolution_time IS 'Alarmın çözüldüğü zaman';


--
-- Name: COLUMN fire_alarms.resolution_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.resolution_notes IS 'Çözüm notları';


--
-- Name: COLUMN fire_alarms.false_alarm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.false_alarm IS 'Yanlış alarm mı';


--
-- Name: COLUMN fire_alarms.recorded_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.recorded_by IS 'Yangın alarmını kaydeden personel ID';


--
-- Name: COLUMN fire_alarms.alarm_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.alarm_number IS 'Alarm panel number or identifier';


--
-- Name: COLUMN fire_alarms.recorded_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.recorded_by_name IS 'Yangın alarmını kaydeden personel adı';


--
-- Name: COLUMN fire_alarms.resolved_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.resolved_by IS 'Yangın alarmını çözümleyen personel ID';


--
-- Name: COLUMN fire_alarms.resolved_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.resolved_by_name IS 'Yangın alarmını çözümleyen personel adı';


--
-- Name: gate_equipments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_equipments (
    id integer NOT NULL,
    gate_id integer NOT NULL,
    name character varying(100) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE gate_equipments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.gate_equipments IS 'Admin-managed equipment list per gate';


--
-- Name: gate_equipments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gate_equipments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gate_equipments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gate_equipments_id_seq OWNED BY public.gate_equipments.id;


--
-- Name: incident_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incident_categories (
    id integer NOT NULL,
    incident_id uuid NOT NULL,
    theft_guest_property boolean DEFAULT false,
    theft_hotel_property boolean DEFAULT false,
    theft_personnel boolean DEFAULT false,
    assault_physical boolean DEFAULT false,
    assault_verbal boolean DEFAULT false,
    assault_mass_fight boolean DEFAULT false,
    substance_personnel boolean DEFAULT false,
    substance_property boolean DEFAULT false,
    vandalism_room boolean DEFAULT false,
    vandalism_common_area boolean DEFAULT false,
    unauthorized_room boolean DEFAULT false,
    unauthorized_restricted_area boolean DEFAULT false,
    accident_slip_fall boolean DEFAULT false,
    accident_equipment boolean DEFAULT false,
    accident_work boolean DEFAULT false,
    medical_serious boolean DEFAULT false,
    medical_first_aid boolean DEFAULT false,
    medical_ambulance boolean DEFAULT false,
    fire_real boolean DEFAULT false,
    fire_false_alarm boolean DEFAULT false,
    fire_evacuation boolean DEFAULT false,
    security_cctv_malfunction boolean DEFAULT false,
    other boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE incident_categories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.incident_categories IS 'Vardiya raporlarına ait olay kategorileri';


--
-- Name: COLUMN incident_categories.incident_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.incident_id IS 'İlgili incident raporu ID';


--
-- Name: COLUMN incident_categories.theft_guest_property; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.theft_guest_property IS 'Misafir Eşyası Çalınması';


--
-- Name: COLUMN incident_categories.theft_hotel_property; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.theft_hotel_property IS 'Otel Mülkiyeti Çalınması';


--
-- Name: COLUMN incident_categories.theft_personnel; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.theft_personnel IS 'Personel Hırsızlığı';


--
-- Name: COLUMN incident_categories.assault_physical; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.assault_physical IS 'Fiziksel Saldırı';


--
-- Name: COLUMN incident_categories.assault_verbal; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.assault_verbal IS 'Sözlü/Davranışsal Taciz';


--
-- Name: COLUMN incident_categories.assault_mass_fight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.assault_mass_fight IS 'Toplu Kavga/İzdiham';


--
-- Name: COLUMN incident_categories.substance_personnel; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.substance_personnel IS 'Personelin Görevde Alkol/Uyuşturucu Kullanımı';


--
-- Name: COLUMN incident_categories.substance_property; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.substance_property IS 'Mülkte Yasak Madde Bulunması';


--
-- Name: COLUMN incident_categories.vandalism_room; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.vandalism_room IS 'Misafirin Oda Eşyalara Kasıtlı Zarar Vermesi';


--
-- Name: COLUMN incident_categories.vandalism_common_area; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.vandalism_common_area IS 'Misafirin Ortak Alan Eşyalarına Kasıtlı Zarar Vermesi';


--
-- Name: COLUMN incident_categories.unauthorized_room; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.unauthorized_room IS 'Yetkisiz Oda Girişi';


--
-- Name: COLUMN incident_categories.unauthorized_restricted_area; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.unauthorized_restricted_area IS 'Kısıtlı Alan İhlali';


--
-- Name: COLUMN incident_categories.accident_slip_fall; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.accident_slip_fall IS 'Kayma/Düşme Kazası';


--
-- Name: COLUMN incident_categories.accident_equipment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.accident_equipment IS 'Ekipman/Cihaz Kazası';


--
-- Name: COLUMN incident_categories.accident_work; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.accident_work IS 'İş Kazası';


--
-- Name: COLUMN incident_categories.medical_serious; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.medical_serious IS 'Ciddi Tıbbi Durum';


--
-- Name: COLUMN incident_categories.medical_first_aid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.medical_first_aid IS 'İlk Yardım Müdahalesi';


--
-- Name: COLUMN incident_categories.medical_ambulance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.medical_ambulance IS 'Ambulans';


--
-- Name: COLUMN incident_categories.fire_real; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.fire_real IS 'Gerçek Yangın Olayı';


--
-- Name: COLUMN incident_categories.fire_false_alarm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.fire_false_alarm IS 'Hatalı Yangın Alarmı';


--
-- Name: COLUMN incident_categories.fire_evacuation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.fire_evacuation IS 'Tahliye Gerektiren Durum';


--
-- Name: COLUMN incident_categories.security_cctv_malfunction; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.security_cctv_malfunction IS 'CCTV Arızası/Kayıt Kesintisi';


--
-- Name: COLUMN incident_categories.other; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incident_categories.other IS 'Diğer (Güvenlik)';


--
-- Name: incident_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.incident_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incident_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.incident_categories_id_seq OWNED BY public.incident_categories.id;


--
-- Name: incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    incident_type character varying(50) DEFAULT 'general'::character varying NOT NULL,
    severity character varying(20),
    location character varying(100),
    description text NOT NULL,
    incident_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    resolved boolean DEFAULT false,
    resolution_notes text,
    resolved_at timestamp without time zone,
    recorded_by uuid,
    resolved_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    shift_label character varying(50),
    report_content text,
    report_date date DEFAULT CURRENT_DATE,
    report_file_path text,
    recorded_by_name character varying(200),
    gate character varying(20),
    CONSTRAINT incidents_gate_check CHECK (((gate IS NULL) OR ((gate)::text = ANY ((ARRAY['Ana Kapı'::character varying, 'Sahil Kapı'::character varying])::text[])))),
    CONSTRAINT incidents_severity_check CHECK (((severity)::text = ANY (ARRAY[('low'::character varying)::text, ('medium'::character varying)::text, ('high'::character varying)::text, ('critical'::character varying)::text])))
);


--
-- Name: TABLE incidents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.incidents IS 'Güvenlik olayları ve raporları';


--
-- Name: COLUMN incidents.shift_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incidents.shift_label IS 'Vardiya etiketi: 00:00-08:00, 08:00-16:00, 16:00-00:00';


--
-- Name: COLUMN incidents.report_content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incidents.report_content IS 'Vardiya rapor içeriği (HTML formatında)';


--
-- Name: COLUMN incidents.report_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incidents.report_date IS 'Raporun oluşturulduğu tarih';


--
-- Name: COLUMN incidents.report_file_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incidents.report_file_path IS 'Word dosyasının sunucu üzerindeki tam yolu';


--
-- Name: COLUMN incidents.recorded_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incidents.recorded_by_name IS 'Olayı kaydeden personelin adı soyadı';


--
-- Name: managers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.managers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name character varying(50) NOT NULL,
    last_name character varying(50) NOT NULL,
    title character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone
);


--
-- Name: managers_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.managers_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    manager_id uuid,
    entry_by uuid,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    entry_time time without time zone DEFAULT CURRENT_TIME NOT NULL,
    exit_date date,
    exit_time time without time zone,
    status character varying(20) DEFAULT 'inside'::character varying NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    manager_name character varying(200),
    entry_by_name character varying(200),
    exit_by uuid,
    exit_by_name character varying(200),
    gate character varying(100),
    CONSTRAINT managers_records_exit_after_entry_check CHECK (((exit_date IS NULL) OR (exit_date >= entry_date))),
    CONSTRAINT managers_records_exit_state_check CHECK (((((status)::text = 'inside'::text) AND (exit_date IS NULL) AND (exit_time IS NULL) AND (exit_by IS NULL)) OR (((status)::text = 'exited'::text) AND (exit_date IS NOT NULL) AND (exit_time IS NOT NULL)))),
    CONSTRAINT managers_records_full_chronology_check CHECK (((exit_date IS NULL) OR ((exit_date + exit_time) >= (entry_date + entry_time)))),
    CONSTRAINT managers_records_status_check CHECK (((status)::text = ANY ((ARRAY['inside'::character varying, 'exited'::character varying])::text[])))
);


--
-- Name: COLUMN managers_records.entry_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.managers_records.entry_by IS 'Müdür girişini kaydeden personel ID';


--
-- Name: COLUMN managers_records.entry_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.managers_records.entry_by_name IS 'Müdür girişini kaydeden personel adı';


--
-- Name: COLUMN managers_records.exit_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.managers_records.exit_by IS 'Müdür çıkışını kaydeden personel ID';


--
-- Name: COLUMN managers_records.exit_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.managers_records.exit_by_name IS 'Müdür çıkışını kaydeden personel adı';


--
-- Name: migration_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migration_history (
    id integer NOT NULL,
    migration_name character varying(255) NOT NULL,
    executed_at timestamp with time zone DEFAULT now(),
    success boolean DEFAULT true
);


--
-- Name: migration_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migration_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migration_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migration_history_id_seq OWNED BY public.migration_history.id;


--
-- Name: misafir_kayitlari; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.misafir_kayitlari (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    excel_file_name character varying(255) NOT NULL,
    sheet_name character varying(150) NOT NULL,
    row_number integer NOT NULL,
    row_data jsonb NOT NULL,
    voucher character varying(100),
    acenta character varying(150),
    hitap character varying(50),
    adi character varying(120),
    soyadi character varying(120),
    oda character varying(50),
    yetiskin character varying(20),
    cocuk character varying(20),
    free character varying(20),
    konaklama character varying(50),
    giris_tarihi date,
    geceleme character varying(50),
    cikis_tarihi date,
    giris_saati time without time zone,
    istenen character varying(200),
    verilen character varying(200),
    ulke character varying(100),
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    search_text text DEFAULT ''::text NOT NULL
);


--
-- Name: TABLE misafir_kayitlari; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.misafir_kayitlari IS 'Excel yuklemelerinden gelen misafir on kayit verileri';


--
-- Name: COLUMN misafir_kayitlari.row_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.misafir_kayitlari.row_data IS 'Excel satirinin birebir ham hali (kolon:deger)';


--
-- Name: pending_qr_sgk; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_qr_sgk (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hashed_tc character varying(255),
    hashed_passport character varying(255),
    full_name character varying(100) NOT NULL,
    company_name character varying(100) NOT NULL,
    notes text,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    gate character varying(64)
);


--
-- Name: TABLE pending_qr_sgk; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pending_qr_sgk IS 'QR kod ile yüklenen ve onay bekleyen geçici SGK kayıtları';


--
-- Name: COLUMN pending_qr_sgk.gate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pending_qr_sgk.gate IS 'SGK kaydının yüklenmeye başlandığı kapı';


--
-- Name: pending_qr_sgk_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_qr_sgk_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pending_sgk_id uuid NOT NULL,
    stored_file_name character varying(500) NOT NULL,
    original_file_name character varying(500),
    mime_type character varying(120),
    size_bytes bigint,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE pending_qr_sgk_files; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pending_qr_sgk_files IS 'Onay bekleyen SGK kayıtlarına ait geçici dosyalar';


--
-- Name: pending_qr_visitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_qr_visitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_plate character varying(20),
    full_name character varying(100) NOT NULL,
    company_name character varying(100),
    visiting_person character varying(100),
    person_count integer DEFAULT 1,
    children_count integer DEFAULT 0,
    phone character varying(20),
    gate character varying(100),
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE pending_qr_visitors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pending_qr_visitors IS 'QR kod ile misafirlerin kendi oluşturduğu ve onay bekleyen geçici kayıtlar';


--
-- Name: personnel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name character varying(50) NOT NULL,
    last_name character varying(50) NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    weekly_login_count integer DEFAULT 0 NOT NULL,
    weekly_login_week_start date,
    CONSTRAINT personnel_role_check CHECK (((role)::text = ANY (ARRAY[('admin'::character varying)::text, ('personnel'::character varying)::text])))
);


--
-- Name: COLUMN personnel.weekly_login_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.personnel.weekly_login_count IS 'Personelin haftalık giriş sayacı';


--
-- Name: COLUMN personnel.weekly_login_week_start; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.personnel.weekly_login_week_start IS 'Haftalık sayacın ait olduğu haftanın başlangıç tarihi';


--
-- Name: personnel_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnel_records (
    id integer NOT NULL,
    personnel_id uuid NOT NULL,
    login_time timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    logout_time timestamp with time zone,
    login_ip character varying(45),
    logout_ip character varying(45),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE personnel_records; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.personnel_records IS 'Tracks employee login and logout times for attendance';


--
-- Name: COLUMN personnel_records.personnel_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.personnel_records.personnel_id IS 'Reference to the personnel who logged in';


--
-- Name: COLUMN personnel_records.login_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.personnel_records.login_time IS 'Timestamp when personnel logged into the system';


--
-- Name: COLUMN personnel_records.logout_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.personnel_records.logout_time IS 'Timestamp when personnel logged out of the system';


--
-- Name: COLUMN personnel_records.login_ip; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.personnel_records.login_ip IS 'IP address from which login occurred';


--
-- Name: COLUMN personnel_records.logout_ip; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.personnel_records.logout_ip IS 'IP address from which logout occurred';


--
-- Name: personnel_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.personnel_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: personnel_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.personnel_records_id_seq OWNED BY public.personnel_records.id;


--
-- Name: sgk_record_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sgk_record_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sgk_record_id uuid NOT NULL,
    stored_file_name character varying(500) NOT NULL,
    original_file_name character varying(500),
    mime_type character varying(120),
    size_bytes bigint,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp without time zone
);


--
-- Name: sgk_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sgk_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hashed_tc character varying(255),
    full_name character varying(100) NOT NULL,
    company_name character varying(100),
    file_path character varying(500) NOT NULL,
    upload_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    personnel_id uuid,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    personnel_name character varying(200),
    hashed_passport character varying(255),
    is_qr boolean DEFAULT false,
    CONSTRAINT sgk_records_identifier_check CHECK ((NOT ((hashed_tc IS NOT NULL) AND (hashed_passport IS NOT NULL))))
);


--
-- Name: TABLE sgk_records; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sgk_records IS 'SGK document records with hashed TC and file storage';


--
-- Name: COLUMN sgk_records.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sgk_records.id IS 'Unique identifier for the SGK record';


--
-- Name: COLUMN sgk_records.hashed_tc; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sgk_records.hashed_tc IS 'Hashed TC Kimlik No (KVKK compliant) - mutually exclusive with passport';


--
-- Name: COLUMN sgk_records.full_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sgk_records.full_name IS 'Full name of the person';


--
-- Name: COLUMN sgk_records.company_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sgk_records.company_name IS 'Company name';


--
-- Name: COLUMN sgk_records.file_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sgk_records.file_path IS 'Path to the uploaded PDF document';


--
-- Name: COLUMN sgk_records.upload_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sgk_records.upload_date IS 'Document upload timestamp';


--
-- Name: COLUMN sgk_records.personnel_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sgk_records.personnel_id IS 'Security personnel who uploaded the record';


--
-- Name: COLUMN sgk_records.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sgk_records.notes IS 'Additional notes';


--
-- Name: COLUMN sgk_records.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sgk_records.created_at IS 'Record creation timestamp';


--
-- Name: COLUMN sgk_records.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sgk_records.updated_at IS 'Last update timestamp';


--
-- Name: COLUMN sgk_records.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sgk_records.deleted_at IS 'Soft delete timestamp';


--
-- Name: COLUMN sgk_records.personnel_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sgk_records.personnel_name IS 'Kaydı yükleyen personelin adı soyadı';


--
-- Name: COLUMN sgk_records.hashed_passport; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sgk_records.hashed_passport IS 'Hashed passport number (KVKK compliant) - mutually exclusive with TC';


--
-- Name: COLUMN sgk_records.is_qr; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sgk_records.is_qr IS 'Kayıt QR kod onaylama süreci üzerinden mi yapıldı işareti';


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    key character varying(120) NOT NULL,
    value text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vehicle_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid NOT NULL,
    manager_id uuid,
    given_by uuid NOT NULL,
    given_date date NOT NULL,
    given_time time without time zone NOT NULL,
    return_date date,
    return_time time without time zone,
    status character varying(20) DEFAULT 'in_use'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    destination character varying(255),
    manager_name character varying(100),
    given_by_name character varying(200),
    returned_by uuid,
    returned_by_name character varying(200),
    personnel_name character varying(200),
    gate character varying(100),
    CONSTRAINT check_manager_info CHECK (((manager_id IS NOT NULL) OR (manager_name IS NOT NULL))),
    CONSTRAINT vehicle_records_full_chronology_check CHECK (((return_date IS NULL) OR ((return_date + return_time) >= (given_date + given_time)))),
    CONSTRAINT vehicle_records_return_state_check CHECK (((((status)::text = 'in_use'::text) AND (return_date IS NULL) AND (return_time IS NULL)) OR (((status)::text = 'returned'::text) AND (return_date IS NOT NULL) AND (return_time IS NOT NULL)))),
    CONSTRAINT vehicle_records_status_check CHECK (((status)::text = ANY (ARRAY[('in_use'::character varying)::text, ('returned'::character varying)::text])))
);


--
-- Name: COLUMN vehicle_records.given_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vehicle_records.given_by IS 'Aracı teslim eden personel ID';


--
-- Name: COLUMN vehicle_records.destination; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vehicle_records.destination IS 'Gidilen yer / hedef lokasyon';


--
-- Name: COLUMN vehicle_records.manager_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vehicle_records.manager_name IS 'Elle girilmiş müdür adı (manager_id NULL ise kullanılır)';


--
-- Name: COLUMN vehicle_records.given_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vehicle_records.given_by_name IS 'Aracı teslim eden personel adı';


--
-- Name: COLUMN vehicle_records.returned_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vehicle_records.returned_by IS 'Aracı teslim alan personel ID';


--
-- Name: COLUMN vehicle_records.returned_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vehicle_records.returned_by_name IS 'Aracı teslim alan personel adı';


--
-- Name: COLUMN vehicle_records.personnel_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vehicle_records.personnel_name IS 'Aracı teslim alan/veren personelin adı soyadı';


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand character varying(100) NOT NULL,
    plate character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'available'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    CONSTRAINT vehicles_status_check CHECK (((status)::text = ANY (ARRAY[('available'::character varying)::text, ('in_use'::character varying)::text, ('maintenance'::character varying)::text])))
);


--
-- Name: visitor_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visitor_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_plate character varying(20),
    full_name character varying(100),
    company_name character varying(100),
    visiting_person character varying(100),
    person_count integer DEFAULT 1 NOT NULL,
    phone character varying(20),
    notes text,
    entry_by uuid,
    entry_date date NOT NULL,
    entry_time time without time zone NOT NULL,
    exit_date date,
    exit_time time without time zone,
    status character varying(20) DEFAULT 'inside'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    subcontractor_worker boolean DEFAULT false NOT NULL,
    for_electric_station boolean DEFAULT false NOT NULL,
    send_whatsapp boolean DEFAULT false,
    entry_by_name character varying(200),
    exit_by uuid,
    exit_by_name character varying(200),
    personnel_name character varying(200),
    children_count integer DEFAULT 0 NOT NULL,
    gate character varying(100),
    daily_guest boolean DEFAULT false NOT NULL,
    entry_tag boolean DEFAULT false NOT NULL,
    exit_tag boolean DEFAULT false NOT NULL,
    highlight_color character varying(20) DEFAULT 'none'::character varying NOT NULL,
    tour_entry boolean DEFAULT false,
    tour_exit boolean DEFAULT false,
    guide boolean DEFAULT false,
    meeting boolean DEFAULT false,
    delivery boolean DEFAULT false,
    is_qr boolean DEFAULT false,
    CONSTRAINT visitor_records_children_count_check CHECK ((children_count >= 0)),
    CONSTRAINT visitor_records_exit_after_entry_check CHECK (((exit_date IS NULL) OR (exit_date >= entry_date))),
    CONSTRAINT visitor_records_exit_state_check CHECK (((((status)::text = 'inside'::text) AND (exit_date IS NULL) AND (exit_time IS NULL)) OR (((status)::text = 'exited'::text) AND (exit_date IS NOT NULL) AND (exit_time IS NOT NULL)))),
    CONSTRAINT visitor_records_person_count_check CHECK ((person_count > 0)),
    CONSTRAINT visitor_records_status_check CHECK (((status)::text = ANY (ARRAY[('inside'::character varying)::text, ('exited'::character varying)::text])))
);


--
-- Name: COLUMN visitor_records.entry_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visitor_records.entry_by IS 'Ziyaretçi girişini kaydeden personel ID';


--
-- Name: COLUMN visitor_records.send_whatsapp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visitor_records.send_whatsapp IS 'WhatsApp grubuna bildirim gönderilsin mi?';


--
-- Name: COLUMN visitor_records.entry_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visitor_records.entry_by_name IS 'Ziyaretçi girişini kaydeden personel adı';


--
-- Name: COLUMN visitor_records.exit_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visitor_records.exit_by IS 'Ziyaretçi çıkışını kaydeden personel ID';


--
-- Name: COLUMN visitor_records.exit_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visitor_records.exit_by_name IS 'Ziyaretçi çıkışını kaydeden personel adı';


--
-- Name: COLUMN visitor_records.personnel_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visitor_records.personnel_name IS 'Ziyaretçiyi kaydeden personelin adı soyadı';


--
-- Name: COLUMN visitor_records.tour_entry; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visitor_records.tour_entry IS 'Tur Giriş etiketini işaretler';


--
-- Name: COLUMN visitor_records.tour_exit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visitor_records.tour_exit IS 'Tur Çıkış etiketini işaretler';


--
-- Name: COLUMN visitor_records.guide; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visitor_records.guide IS 'Rehber etiketini işaretler';


--
-- Name: COLUMN visitor_records.meeting; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visitor_records.meeting IS 'Görüşme etiketini işaretler';


--
-- Name: COLUMN visitor_records.delivery; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visitor_records.delivery IS 'Teslimat etiketini işaretler';


--
-- Name: COLUMN visitor_records.is_qr; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visitor_records.is_qr IS 'Kayıt QR kod onaylama süreci üzerinden mi yapıldı işareti';


--
-- Name: equipment_checks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_checks ALTER COLUMN id SET DEFAULT nextval('public.equipment_checks_id_seq'::regclass);


--
-- Name: equipment_gates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_gates ALTER COLUMN id SET DEFAULT nextval('public.equipment_gates_id_seq'::regclass);


--
-- Name: gate_equipments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_equipments ALTER COLUMN id SET DEFAULT nextval('public.gate_equipments_id_seq'::regclass);


--
-- Name: incident_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incident_categories ALTER COLUMN id SET DEFAULT nextval('public.incident_categories_id_seq'::regclass);


--
-- Name: migration_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_history ALTER COLUMN id SET DEFAULT nextval('public.migration_history_id_seq'::regclass);


--
-- Name: personnel_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_records ALTER COLUMN id SET DEFAULT nextval('public.personnel_records_id_seq'::regclass);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: equipment_checks equipment_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_checks
    ADD CONSTRAINT equipment_checks_pkey PRIMARY KEY (id);


--
-- Name: equipment_gates equipment_gates_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_gates
    ADD CONSTRAINT equipment_gates_code_key UNIQUE (code);


--
-- Name: equipment_gates equipment_gates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_gates
    ADD CONSTRAINT equipment_gates_pkey PRIMARY KEY (id);


--
-- Name: fire_alarms fire_alarms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fire_alarms
    ADD CONSTRAINT fire_alarms_pkey PRIMARY KEY (id);


--
-- Name: gate_equipments gate_equipments_gate_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_equipments
    ADD CONSTRAINT gate_equipments_gate_id_name_key UNIQUE (gate_id, name);


--
-- Name: gate_equipments gate_equipments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_equipments
    ADD CONSTRAINT gate_equipments_pkey PRIMARY KEY (id);


--
-- Name: incident_categories incident_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incident_categories
    ADD CONSTRAINT incident_categories_pkey PRIMARY KEY (id);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: managers managers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.managers
    ADD CONSTRAINT managers_pkey PRIMARY KEY (id);


--
-- Name: managers_records managers_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.managers_records
    ADD CONSTRAINT managers_records_pkey PRIMARY KEY (id);


--
-- Name: migration_history migration_history_migration_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_history
    ADD CONSTRAINT migration_history_migration_name_key UNIQUE (migration_name);


--
-- Name: migration_history migration_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_history
    ADD CONSTRAINT migration_history_pkey PRIMARY KEY (id);


--
-- Name: misafir_kayitlari misafir_kayitlari_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.misafir_kayitlari
    ADD CONSTRAINT misafir_kayitlari_pkey PRIMARY KEY (id);


--
-- Name: pending_qr_sgk_files pending_qr_sgk_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_qr_sgk_files
    ADD CONSTRAINT pending_qr_sgk_files_pkey PRIMARY KEY (id);


--
-- Name: pending_qr_sgk pending_qr_sgk_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_qr_sgk
    ADD CONSTRAINT pending_qr_sgk_pkey PRIMARY KEY (id);


--
-- Name: pending_qr_visitors pending_qr_visitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_qr_visitors
    ADD CONSTRAINT pending_qr_visitors_pkey PRIMARY KEY (id);


--
-- Name: personnel personnel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel
    ADD CONSTRAINT personnel_pkey PRIMARY KEY (id);


--
-- Name: personnel_records personnel_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_records
    ADD CONSTRAINT personnel_records_pkey PRIMARY KEY (id);


--
-- Name: sgk_record_files sgk_record_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sgk_record_files
    ADD CONSTRAINT sgk_record_files_pkey PRIMARY KEY (id);


--
-- Name: sgk_records sgk_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sgk_records
    ADD CONSTRAINT sgk_records_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: vehicle_records vehicle_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_records
    ADD CONSTRAINT vehicle_records_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: visitor_records visitor_records_full_chronology_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.visitor_records
    ADD CONSTRAINT visitor_records_full_chronology_check CHECK (((exit_date IS NULL) OR ((exit_date + exit_time) >= (entry_date + entry_time)))) NOT VALID;


--
-- Name: visitor_records visitor_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_records
    ADD CONSTRAINT visitor_records_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_action ON public.audit_log USING btree (action);


--
-- Name: idx_audit_log_action_login; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_action_login ON public.audit_log USING btree (action) WHERE ((action)::text = ANY (ARRAY[('LOGIN'::character varying)::text, ('LOGOUT'::character varying)::text, ('FAILED_LOGIN'::character varying)::text]));


--
-- Name: idx_audit_log_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_changed_at ON public.audit_log USING btree (changed_at);


--
-- Name: idx_audit_log_changed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_changed_by ON public.audit_log USING btree (changed_by);


--
-- Name: idx_audit_log_ip_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_ip_address ON public.audit_log USING btree (ip_address);


--
-- Name: idx_audit_log_record_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_record_id ON public.audit_log USING btree (record_id);


--
-- Name: idx_audit_log_table_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_table_name ON public.audit_log USING btree (table_name);


--
-- Name: idx_equipment_checks_checked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_checks_checked_at ON public.equipment_checks USING btree (checked_at);


--
-- Name: idx_equipment_checks_personnel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_checks_personnel_id ON public.equipment_checks USING btree (personnel_id);


--
-- Name: idx_equipment_checks_personnel_record_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_checks_personnel_record_id ON public.equipment_checks USING btree (personnel_record_id);


--
-- Name: idx_equipment_gates_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_gates_active ON public.equipment_gates USING btree (is_active);


--
-- Name: idx_fire_alarms_active_alarm_time_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fire_alarms_active_alarm_time_id ON public.fire_alarms USING btree (alarm_time DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_fire_alarms_active_gate_alarm_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fire_alarms_active_gate_alarm_time ON public.fire_alarms USING btree (gate, alarm_time DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_fire_alarms_active_resolution_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fire_alarms_active_resolution_time ON public.fire_alarms USING btree (resolution_time DESC, id DESC) WHERE ((deleted_at IS NULL) AND (resolution_time IS NOT NULL));


--
-- Name: idx_fire_alarms_alarm_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fire_alarms_alarm_number ON public.fire_alarms USING btree (alarm_number);


--
-- Name: idx_fire_alarms_alarm_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fire_alarms_alarm_time ON public.fire_alarms USING btree (alarm_time) WHERE (deleted_at IS NULL);


--
-- Name: idx_fire_alarms_deleted_alarm_time_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fire_alarms_deleted_alarm_time_id ON public.fire_alarms USING btree (alarm_time DESC, id DESC) WHERE (deleted_at IS NOT NULL);


--
-- Name: idx_fire_alarms_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fire_alarms_location ON public.fire_alarms USING btree (location) WHERE (deleted_at IS NULL);


--
-- Name: idx_fire_alarms_recorded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fire_alarms_recorded_by ON public.fire_alarms USING btree (recorded_by) WHERE (deleted_at IS NULL);


--
-- Name: idx_fire_alarms_recorded_by_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fire_alarms_recorded_by_name ON public.fire_alarms USING btree (recorded_by_name);


--
-- Name: idx_fire_alarms_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fire_alarms_resolved ON public.fire_alarms USING btree (resolved) WHERE (deleted_at IS NULL);


--
-- Name: idx_fire_alarms_resolved_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fire_alarms_resolved_by ON public.fire_alarms USING btree (resolved_by) WHERE (deleted_at IS NULL);


--
-- Name: idx_fire_alarms_resolved_by_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fire_alarms_resolved_by_name ON public.fire_alarms USING btree (resolved_by_name);


--
-- Name: idx_gate_equipments_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gate_equipments_active ON public.gate_equipments USING btree (is_active);


--
-- Name: idx_gate_equipments_gate_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gate_equipments_gate_id ON public.gate_equipments USING btree (gate_id);


--
-- Name: idx_incident_categories_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incident_categories_created_at ON public.incident_categories USING btree (created_at);


--
-- Name: idx_incident_categories_filter_flags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incident_categories_filter_flags ON public.incident_categories USING btree (incident_id) INCLUDE (theft_guest_property, theft_hotel_property, theft_personnel, assault_physical, assault_verbal, assault_mass_fight, vandalism_room, vandalism_common_area, unauthorized_room, unauthorized_restricted_area, fire_real, fire_false_alarm, other);


--
-- Name: idx_incident_categories_incident; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incident_categories_incident ON public.incident_categories USING btree (incident_id);


--
-- Name: idx_incident_categories_unique_incident; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_incident_categories_unique_incident ON public.incident_categories USING btree (incident_id);


--
-- Name: idx_incidents_active_gate_incident_time_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_active_gate_incident_time_id ON public.incidents USING btree (gate, incident_time DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_incidents_active_incident_time_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_active_incident_time_id ON public.incidents USING btree (incident_time DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_incidents_active_report_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_active_report_date ON public.incidents USING btree (report_date DESC, id DESC) WHERE ((deleted_at IS NULL) AND (report_date IS NOT NULL));


--
-- Name: idx_incidents_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_deleted_at ON public.incidents USING btree (deleted_at);


--
-- Name: idx_incidents_incident_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_incident_time ON public.incidents USING btree (incident_time);


--
-- Name: idx_incidents_incident_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_incident_type ON public.incidents USING btree (incident_type);


--
-- Name: idx_incidents_recorded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_recorded_by ON public.incidents USING btree (recorded_by);


--
-- Name: idx_incidents_recorded_by_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_recorded_by_name ON public.incidents USING btree (recorded_by_name);


--
-- Name: idx_incidents_report_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_report_date ON public.incidents USING btree (report_date);


--
-- Name: idx_incidents_report_file_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_report_file_path ON public.incidents USING btree (report_file_path);


--
-- Name: idx_incidents_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_resolved ON public.incidents USING btree (resolved);


--
-- Name: idx_incidents_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_severity ON public.incidents USING btree (severity);


--
-- Name: idx_incidents_shift_label; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incidents_shift_label ON public.incidents USING btree (shift_label);


--
-- Name: idx_managers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managers_active ON public.managers USING btree (is_active) WHERE (deleted_at IS NULL);


--
-- Name: idx_managers_records_active_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managers_records_active_sort ON public.managers_records USING btree (entry_date DESC, entry_time DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_managers_records_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managers_records_date_time ON public.managers_records USING btree (entry_date DESC, entry_time DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_managers_records_deleted_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managers_records_deleted_sort ON public.managers_records USING btree (deleted_at DESC, id DESC) WHERE (deleted_at IS NOT NULL);


--
-- Name: idx_managers_records_entry_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managers_records_entry_by ON public.managers_records USING btree (entry_by) WHERE (deleted_at IS NULL);


--
-- Name: idx_managers_records_entry_by_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managers_records_entry_by_name ON public.managers_records USING btree (entry_by_name);


--
-- Name: idx_managers_records_entry_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managers_records_entry_date ON public.managers_records USING btree (entry_date) WHERE (deleted_at IS NULL);


--
-- Name: idx_managers_records_exit_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managers_records_exit_by ON public.managers_records USING btree (exit_by) WHERE (deleted_at IS NULL);


--
-- Name: idx_managers_records_exit_by_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managers_records_exit_by_name ON public.managers_records USING btree (exit_by_name);


--
-- Name: idx_managers_records_exit_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managers_records_exit_sort ON public.managers_records USING btree (exit_date DESC, exit_time DESC, id DESC) WHERE ((deleted_at IS NULL) AND (exit_date IS NOT NULL));


--
-- Name: idx_managers_records_manager; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managers_records_manager ON public.managers_records USING btree (manager_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_managers_records_manager_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managers_records_manager_name ON public.managers_records USING btree (manager_name) WHERE (deleted_at IS NULL);


--
-- Name: idx_managers_records_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managers_records_status ON public.managers_records USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_misafir_kayitlari_acenta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_misafir_kayitlari_acenta ON public.misafir_kayitlari USING btree (acenta);


--
-- Name: idx_misafir_kayitlari_adi; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_misafir_kayitlari_adi ON public.misafir_kayitlari USING btree (adi);


--
-- Name: idx_misafir_kayitlari_cikis_tarihi; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_misafir_kayitlari_cikis_tarihi ON public.misafir_kayitlari USING btree (cikis_tarihi);


--
-- Name: idx_misafir_kayitlari_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_misafir_kayitlari_created_at ON public.misafir_kayitlari USING btree (created_at);


--
-- Name: idx_misafir_kayitlari_giris_tarihi; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_misafir_kayitlari_giris_tarihi ON public.misafir_kayitlari USING btree (giris_tarihi);


--
-- Name: idx_misafir_kayitlari_oda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_misafir_kayitlari_oda ON public.misafir_kayitlari USING btree (oda);


--
-- Name: idx_misafir_kayitlari_row_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_misafir_kayitlari_row_data_gin ON public.misafir_kayitlari USING gin (row_data);


--
-- Name: idx_misafir_kayitlari_search_text_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_misafir_kayitlari_search_text_trgm ON public.misafir_kayitlari USING gin (search_text public.gin_trgm_ops) WHERE (deleted_at IS NULL);


--
-- Name: idx_misafir_kayitlari_soyadi; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_misafir_kayitlari_soyadi ON public.misafir_kayitlari USING btree (soyadi);


--
-- Name: idx_misafir_kayitlari_ulke; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_misafir_kayitlari_ulke ON public.misafir_kayitlari USING btree (ulke);


--
-- Name: idx_misafir_kayitlari_voucher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_misafir_kayitlari_voucher ON public.misafir_kayitlari USING btree (voucher);


--
-- Name: idx_pending_qr_sgk_files_sgk_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_qr_sgk_files_sgk_id ON public.pending_qr_sgk_files USING btree (pending_sgk_id);


--
-- Name: idx_pending_qr_sgk_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_qr_sgk_status ON public.pending_qr_sgk USING btree (status);


--
-- Name: idx_pending_qr_visitors_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_qr_visitors_status ON public.pending_qr_visitors USING btree (status);


--
-- Name: idx_personnel_records_login_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnel_records_login_time ON public.personnel_records USING btree (login_time);


--
-- Name: idx_personnel_records_logout_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnel_records_logout_time ON public.personnel_records USING btree (logout_time);


--
-- Name: idx_personnel_records_personnel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnel_records_personnel_id ON public.personnel_records USING btree (personnel_id);


--
-- Name: idx_personnel_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnel_role ON public.personnel USING btree (role) WHERE (deleted_at IS NULL);


--
-- Name: idx_personnel_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnel_username ON public.personnel USING btree (username) WHERE (deleted_at IS NULL);


--
-- Name: idx_personnel_username_active_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_personnel_username_active_unique ON public.personnel USING btree (username) WHERE (deleted_at IS NULL);


--
-- Name: idx_personnel_weekly_login_week_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnel_weekly_login_week_start ON public.personnel USING btree (weekly_login_week_start);


--
-- Name: idx_sgk_record_files_active_record_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sgk_record_files_active_record_order ON public.sgk_record_files USING btree (sgk_record_id, sort_order, created_at, id) WHERE (deleted_at IS NULL);


--
-- Name: idx_sgk_record_files_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sgk_record_files_deleted_at ON public.sgk_record_files USING btree (deleted_at);


--
-- Name: idx_sgk_record_files_record_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sgk_record_files_record_id ON public.sgk_record_files USING btree (sgk_record_id);


--
-- Name: idx_sgk_records_active_upload_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sgk_records_active_upload_order ON public.sgk_records USING btree (upload_date DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_sgk_records_company_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sgk_records_company_name ON public.sgk_records USING btree (company_name);


--
-- Name: idx_sgk_records_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sgk_records_deleted_at ON public.sgk_records USING btree (deleted_at);


--
-- Name: idx_sgk_records_full_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sgk_records_full_name ON public.sgk_records USING btree (full_name);


--
-- Name: idx_sgk_records_hashed_passport; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sgk_records_hashed_passport ON public.sgk_records USING btree (hashed_passport);


--
-- Name: idx_sgk_records_hashed_tc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sgk_records_hashed_tc ON public.sgk_records USING btree (hashed_tc);


--
-- Name: idx_sgk_records_personnel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sgk_records_personnel ON public.sgk_records USING btree (personnel_id);


--
-- Name: idx_sgk_records_personnel_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sgk_records_personnel_name ON public.sgk_records USING btree (personnel_name);


--
-- Name: idx_sgk_records_upload_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sgk_records_upload_date ON public.sgk_records USING btree (upload_date);


--
-- Name: idx_system_settings_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_settings_updated_at ON public.system_settings USING btree (updated_at DESC);


--
-- Name: idx_vehicle_records_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_records_date ON public.vehicle_records USING btree (given_date) WHERE (deleted_at IS NULL);


--
-- Name: idx_vehicle_records_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_records_date_time ON public.vehicle_records USING btree (given_date DESC, given_time DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_vehicle_records_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_records_deleted_at ON public.vehicle_records USING btree (deleted_at DESC, id DESC) WHERE (deleted_at IS NOT NULL);


--
-- Name: idx_vehicle_records_destination; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_records_destination ON public.vehicle_records USING btree (destination) WHERE (deleted_at IS NULL);


--
-- Name: idx_vehicle_records_gate_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_records_gate_date_time ON public.vehicle_records USING btree (gate, given_date DESC, given_time DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_vehicle_records_given_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_records_given_by ON public.vehicle_records USING btree (given_by) WHERE (deleted_at IS NULL);


--
-- Name: idx_vehicle_records_given_by_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_records_given_by_name ON public.vehicle_records USING btree (given_by_name);


--
-- Name: idx_vehicle_records_manager; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_records_manager ON public.vehicle_records USING btree (manager_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_vehicle_records_return_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_records_return_date_time ON public.vehicle_records USING btree (return_date DESC, return_time DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_vehicle_records_returned_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_records_returned_by ON public.vehicle_records USING btree (returned_by) WHERE (deleted_at IS NULL);


--
-- Name: idx_vehicle_records_returned_by_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_records_returned_by_name ON public.vehicle_records USING btree (returned_by_name);


--
-- Name: idx_vehicle_records_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_records_status ON public.vehicle_records USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_vehicle_records_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_records_vehicle ON public.vehicle_records USING btree (vehicle_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_vehicles_plate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicles_plate ON public.vehicles USING btree (plate) WHERE (deleted_at IS NULL);


--
-- Name: idx_vehicles_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicles_status ON public.vehicles USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_visitor_records_company_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_company_name_trgm ON public.visitor_records USING gin (lower(translate((company_name)::text, 'IİĞÜŞÖÇ'::text, 'ıiğüşöç'::text)) public.gin_trgm_ops);


--
-- Name: idx_visitor_records_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_date ON public.visitor_records USING btree (entry_date) WHERE (deleted_at IS NULL);


--
-- Name: idx_visitor_records_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_date_time ON public.visitor_records USING btree (entry_date DESC, entry_time DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_visitor_records_deleted_at_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_deleted_at_id ON public.visitor_records USING btree (deleted_at DESC, id DESC) WHERE (deleted_at IS NOT NULL);


--
-- Name: idx_visitor_records_entry_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_entry_by ON public.visitor_records USING btree (entry_by) WHERE (deleted_at IS NULL);


--
-- Name: idx_visitor_records_entry_by_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_entry_by_name ON public.visitor_records USING btree (entry_by_name);


--
-- Name: idx_visitor_records_entry_datetime_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_entry_datetime_id ON public.visitor_records USING btree (entry_date DESC, entry_time DESC, id DESC);


--
-- Name: idx_visitor_records_exit_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_exit_by ON public.visitor_records USING btree (exit_by) WHERE (deleted_at IS NULL);


--
-- Name: idx_visitor_records_exit_by_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_exit_by_name ON public.visitor_records USING btree (exit_by_name);


--
-- Name: idx_visitor_records_exit_datetime_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_exit_datetime_id ON public.visitor_records USING btree (exit_date DESC, exit_time DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_visitor_records_full_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_full_name_trgm ON public.visitor_records USING gin (lower(translate((full_name)::text, 'IİĞÜŞÖÇ'::text, 'ıiğüşöç'::text)) public.gin_trgm_ops);


--
-- Name: idx_visitor_records_gate_entry_datetime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_gate_entry_datetime ON public.visitor_records USING btree (gate, entry_date DESC, entry_time DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_visitor_records_normalized_name_tr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_normalized_name_tr ON public.visitor_records USING btree (lower(translate((full_name)::text, 'IİĞÜŞÖÇ'::text, 'ıiğüşöç'::text))) WHERE (deleted_at IS NULL);


--
-- Name: idx_visitor_records_phone_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_phone_trgm ON public.visitor_records USING gin (lower((phone)::text) public.gin_trgm_ops);


--
-- Name: idx_visitor_records_plate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_plate ON public.visitor_records USING btree (vehicle_plate) WHERE (deleted_at IS NULL);


--
-- Name: idx_visitor_records_plate_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_plate_trgm ON public.visitor_records USING gin (lower(translate((vehicle_plate)::text, 'IİĞÜŞÖÇ'::text, 'ıiğüşöç'::text)) public.gin_trgm_ops);


--
-- Name: idx_visitor_records_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_status ON public.visitor_records USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_visitor_records_status_entry_datetime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_status_entry_datetime ON public.visitor_records USING btree (status, entry_date DESC, entry_time DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_visitor_records_visiting_person_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_visiting_person_trgm ON public.visitor_records USING gin (lower(translate((visiting_person)::text, 'IİĞÜŞÖÇ'::text, 'ıiğüşöç'::text)) public.gin_trgm_ops);


--
-- Name: uq_incidents_active_shift_report_per_gate_day; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_incidents_active_shift_report_per_gate_day ON public.incidents USING btree (shift_label, report_date, COALESCE(gate, ''::character varying)) WHERE ((deleted_at IS NULL) AND (shift_label IS NOT NULL) AND (report_date IS NOT NULL));


--
-- Name: uq_managers_active_normalized_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_managers_active_normalized_name ON public.managers USING btree (lower(btrim((first_name)::text)), lower(btrim((last_name)::text))) WHERE (deleted_at IS NULL);


--
-- Name: uq_managers_records_one_active_inside; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_managers_records_one_active_inside ON public.managers_records USING btree (manager_id) WHERE ((manager_id IS NOT NULL) AND ((status)::text = 'inside'::text) AND (deleted_at IS NULL));


--
-- Name: uq_misafir_kayitlari_sheet_row_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_misafir_kayitlari_sheet_row_active ON public.misafir_kayitlari USING btree (sheet_name, row_number) WHERE (deleted_at IS NULL);


--
-- Name: uq_sgk_records_active_hashed_passport; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sgk_records_active_hashed_passport ON public.sgk_records USING btree (hashed_passport) WHERE ((deleted_at IS NULL) AND (hashed_passport IS NOT NULL));


--
-- Name: uq_sgk_records_active_hashed_tc; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sgk_records_active_hashed_tc ON public.sgk_records USING btree (hashed_tc) WHERE ((deleted_at IS NULL) AND (hashed_tc IS NOT NULL));


--
-- Name: uq_vehicle_records_one_active_use; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_vehicle_records_one_active_use ON public.vehicle_records USING btree (vehicle_id) WHERE ((deleted_at IS NULL) AND ((status)::text = 'in_use'::text));


--
-- Name: uq_vehicles_plate_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_vehicles_plate_active ON public.vehicles USING btree (plate) WHERE (deleted_at IS NULL);


--
-- Name: fire_alarms trigger_sync_fire_alarm_personnel_names; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_fire_alarm_personnel_names BEFORE INSERT OR UPDATE ON public.fire_alarms FOR EACH ROW EXECUTE FUNCTION public.sync_fire_alarm_personnel_names();


--
-- Name: incidents trigger_sync_incident_recorded_by_name; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_incident_recorded_by_name BEFORE INSERT OR UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.sync_incident_recorded_by_name();


--
-- Name: vehicle_records trigger_sync_manager_name; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_manager_name BEFORE INSERT OR UPDATE ON public.vehicle_records FOR EACH ROW EXECUTE FUNCTION public.sync_manager_name();


--
-- Name: managers_records trigger_sync_manager_record_personnel_names; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_manager_record_personnel_names BEFORE INSERT OR UPDATE ON public.managers_records FOR EACH ROW EXECUTE FUNCTION public.sync_manager_record_personnel_names();


--
-- Name: sgk_records trigger_sync_sgk_personnel_name; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_sgk_personnel_name BEFORE INSERT OR UPDATE ON public.sgk_records FOR EACH ROW EXECUTE FUNCTION public.sync_sgk_personnel_name();


--
-- Name: vehicle_records trigger_sync_vehicle_personnel_names; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_vehicle_personnel_names BEFORE INSERT OR UPDATE ON public.vehicle_records FOR EACH ROW EXECUTE FUNCTION public.sync_vehicle_personnel_names();


--
-- Name: visitor_records trigger_sync_visitor_personnel_names; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_visitor_personnel_names BEFORE INSERT OR UPDATE ON public.visitor_records FOR EACH ROW EXECUTE FUNCTION public.sync_visitor_personnel_names();


--
-- Name: incident_categories trigger_update_incident_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_incident_categories_updated_at BEFORE UPDATE ON public.incident_categories FOR EACH ROW EXECUTE FUNCTION public.update_incident_categories_updated_at();


--
-- Name: pending_qr_sgk trigger_update_pending_qr_sgk_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_pending_qr_sgk_updated_at BEFORE UPDATE ON public.pending_qr_sgk FOR EACH ROW EXECUTE FUNCTION public.update_pending_qr_sgk_updated_at();


--
-- Name: sgk_records trigger_update_sgk_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_sgk_records_updated_at BEFORE UPDATE ON public.sgk_records FOR EACH ROW EXECUTE FUNCTION public.update_sgk_records_updated_at();


--
-- Name: incidents update_incidents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: managers_records update_managers_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_managers_records_updated_at BEFORE UPDATE ON public.managers_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: managers update_managers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_managers_updated_at BEFORE UPDATE ON public.managers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: misafir_kayitlari update_misafir_kayitlari_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_misafir_kayitlari_updated_at BEFORE UPDATE ON public.misafir_kayitlari FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: personnel update_personnel_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_personnel_updated_at BEFORE UPDATE ON public.personnel FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vehicle_records update_vehicle_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_vehicle_records_updated_at BEFORE UPDATE ON public.vehicle_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vehicles update_vehicles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: visitor_records update_visitor_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_visitor_records_updated_at BEFORE UPDATE ON public.visitor_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: audit_log audit_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.personnel(id);


--
-- Name: equipment_checks equipment_checks_personnel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_checks
    ADD CONSTRAINT equipment_checks_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- Name: equipment_checks equipment_checks_personnel_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_checks
    ADD CONSTRAINT equipment_checks_personnel_record_id_fkey FOREIGN KEY (personnel_record_id) REFERENCES public.personnel_records(id) ON DELETE CASCADE;


--
-- Name: fire_alarms fire_alarms_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fire_alarms
    ADD CONSTRAINT fire_alarms_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.personnel(id);


--
-- Name: fire_alarms fire_alarms_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fire_alarms
    ADD CONSTRAINT fire_alarms_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.personnel(id) ON DELETE SET NULL;


--
-- Name: gate_equipments gate_equipments_gate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_equipments
    ADD CONSTRAINT gate_equipments_gate_id_fkey FOREIGN KEY (gate_id) REFERENCES public.equipment_gates(id) ON DELETE CASCADE;


--
-- Name: incident_categories incident_categories_incident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incident_categories
    ADD CONSTRAINT incident_categories_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id) ON DELETE CASCADE;


--
-- Name: incidents incidents_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.personnel(id);


--
-- Name: incidents incidents_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.personnel(id);


--
-- Name: managers_records managers_records_entry_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.managers_records
    ADD CONSTRAINT managers_records_entry_by_fkey FOREIGN KEY (entry_by) REFERENCES public.personnel(id) ON DELETE SET NULL;


--
-- Name: managers_records managers_records_exit_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.managers_records
    ADD CONSTRAINT managers_records_exit_by_fkey FOREIGN KEY (exit_by) REFERENCES public.personnel(id) ON DELETE SET NULL;


--
-- Name: managers_records managers_records_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.managers_records
    ADD CONSTRAINT managers_records_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.managers(id) ON DELETE SET NULL;


--
-- Name: misafir_kayitlari misafir_kayitlari_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.misafir_kayitlari
    ADD CONSTRAINT misafir_kayitlari_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.personnel(id);


--
-- Name: pending_qr_sgk_files pending_qr_sgk_files_pending_sgk_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_qr_sgk_files
    ADD CONSTRAINT pending_qr_sgk_files_pending_sgk_id_fkey FOREIGN KEY (pending_sgk_id) REFERENCES public.pending_qr_sgk(id) ON DELETE CASCADE;


--
-- Name: personnel_records personnel_records_personnel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_records
    ADD CONSTRAINT personnel_records_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- Name: sgk_record_files sgk_record_files_sgk_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sgk_record_files
    ADD CONSTRAINT sgk_record_files_sgk_record_id_fkey FOREIGN KEY (sgk_record_id) REFERENCES public.sgk_records(id) ON DELETE CASCADE;


--
-- Name: sgk_records sgk_records_personnel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sgk_records
    ADD CONSTRAINT sgk_records_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE SET NULL;


--
-- Name: vehicle_records vehicle_records_given_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_records
    ADD CONSTRAINT vehicle_records_given_by_fkey FOREIGN KEY (given_by) REFERENCES public.personnel(id) ON DELETE SET NULL;


--
-- Name: vehicle_records vehicle_records_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_records
    ADD CONSTRAINT vehicle_records_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.managers(id) ON DELETE SET NULL;


--
-- Name: vehicle_records vehicle_records_returned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_records
    ADD CONSTRAINT vehicle_records_returned_by_fkey FOREIGN KEY (returned_by) REFERENCES public.personnel(id) ON DELETE SET NULL;


--
-- Name: vehicle_records vehicle_records_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_records
    ADD CONSTRAINT vehicle_records_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT;


--
-- Name: visitor_records visitor_records_entry_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_records
    ADD CONSTRAINT visitor_records_entry_by_fkey FOREIGN KEY (entry_by) REFERENCES public.personnel(id) ON DELETE SET NULL;


--
-- Name: visitor_records visitor_records_exit_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_records
    ADD CONSTRAINT visitor_records_exit_by_fkey FOREIGN KEY (exit_by) REFERENCES public.personnel(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

