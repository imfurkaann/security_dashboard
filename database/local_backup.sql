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
ALTER TABLE IF EXISTS ONLY public.managers_records DROP CONSTRAINT IF EXISTS managers_records_manager_id_fkey;
ALTER TABLE IF EXISTS ONLY public.managers_records DROP CONSTRAINT IF EXISTS managers_records_exit_by_fkey;
ALTER TABLE IF EXISTS ONLY public.managers_records DROP CONSTRAINT IF EXISTS managers_records_entry_by_fkey;
ALTER TABLE IF EXISTS ONLY public.incidents DROP CONSTRAINT IF EXISTS incidents_resolved_by_fkey;
ALTER TABLE IF EXISTS ONLY public.incidents DROP CONSTRAINT IF EXISTS incidents_recorded_by_fkey;
ALTER TABLE IF EXISTS ONLY public.fire_alarms DROP CONSTRAINT IF EXISTS fire_alarms_resolved_by_fkey;
ALTER TABLE IF EXISTS ONLY public.fire_alarms DROP CONSTRAINT IF EXISTS fire_alarms_recorded_by_fkey;
ALTER TABLE IF EXISTS ONLY public.audit_log DROP CONSTRAINT IF EXISTS audit_log_changed_by_fkey;
DROP TRIGGER IF EXISTS update_visitor_records_updated_at ON public.visitor_records;
DROP TRIGGER IF EXISTS update_vehicles_updated_at ON public.vehicles;
DROP TRIGGER IF EXISTS update_vehicle_records_updated_at ON public.vehicle_records;
DROP TRIGGER IF EXISTS update_personnel_updated_at ON public.personnel;
DROP TRIGGER IF EXISTS update_managers_updated_at ON public.managers;
DROP TRIGGER IF EXISTS update_managers_records_updated_at ON public.managers_records;
DROP TRIGGER IF EXISTS update_incidents_updated_at ON public.incidents;
DROP TRIGGER IF EXISTS trigger_update_sgk_records_updated_at ON public.sgk_records;
DROP TRIGGER IF EXISTS trigger_sync_visitor_personnel_names ON public.visitor_records;
DROP TRIGGER IF EXISTS trigger_sync_vehicle_personnel_names ON public.vehicle_records;
DROP TRIGGER IF EXISTS trigger_sync_sgk_personnel_name ON public.sgk_records;
DROP TRIGGER IF EXISTS trigger_sync_manager_record_personnel_names ON public.managers_records;
DROP TRIGGER IF EXISTS trigger_sync_manager_name ON public.vehicle_records;
DROP TRIGGER IF EXISTS trigger_sync_incident_recorded_by_name ON public.incidents;
DROP TRIGGER IF EXISTS trigger_sync_fire_alarm_personnel_names ON public.fire_alarms;
DROP INDEX IF EXISTS public.idx_visitor_records_status;
DROP INDEX IF EXISTS public.idx_visitor_records_plate;
DROP INDEX IF EXISTS public.idx_visitor_records_exit_by_name;
DROP INDEX IF EXISTS public.idx_visitor_records_exit_by;
DROP INDEX IF EXISTS public.idx_visitor_records_entry_by_name;
DROP INDEX IF EXISTS public.idx_visitor_records_entry_by;
DROP INDEX IF EXISTS public.idx_visitor_records_date;
DROP INDEX IF EXISTS public.idx_vehicles_status;
DROP INDEX IF EXISTS public.idx_vehicles_plate;
DROP INDEX IF EXISTS public.idx_vehicle_records_vehicle;
DROP INDEX IF EXISTS public.idx_vehicle_records_status;
DROP INDEX IF EXISTS public.idx_vehicle_records_returned_by_name;
DROP INDEX IF EXISTS public.idx_vehicle_records_returned_by;
DROP INDEX IF EXISTS public.idx_vehicle_records_manager;
DROP INDEX IF EXISTS public.idx_vehicle_records_given_by_name;
DROP INDEX IF EXISTS public.idx_vehicle_records_given_by;
DROP INDEX IF EXISTS public.idx_vehicle_records_date;
DROP INDEX IF EXISTS public.idx_sgk_records_upload_date;
DROP INDEX IF EXISTS public.idx_sgk_records_personnel_name;
DROP INDEX IF EXISTS public.idx_sgk_records_personnel;
DROP INDEX IF EXISTS public.idx_sgk_records_hashed_tc;
DROP INDEX IF EXISTS public.idx_sgk_records_full_name;
DROP INDEX IF EXISTS public.idx_sgk_records_deleted_at;
DROP INDEX IF EXISTS public.idx_sgk_records_company_name;
DROP INDEX IF EXISTS public.idx_personnel_username;
DROP INDEX IF EXISTS public.idx_personnel_role;
DROP INDEX IF EXISTS public.idx_managers_records_status;
DROP INDEX IF EXISTS public.idx_managers_records_manager_name;
DROP INDEX IF EXISTS public.idx_managers_records_manager;
DROP INDEX IF EXISTS public.idx_managers_records_exit_by_name;
DROP INDEX IF EXISTS public.idx_managers_records_exit_by;
DROP INDEX IF EXISTS public.idx_managers_records_entry_date;
DROP INDEX IF EXISTS public.idx_managers_records_entry_by_name;
DROP INDEX IF EXISTS public.idx_managers_records_entry_by;
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
DROP INDEX IF EXISTS public.idx_fire_alarms_resolved_by_name;
DROP INDEX IF EXISTS public.idx_fire_alarms_resolved_by;
DROP INDEX IF EXISTS public.idx_fire_alarms_resolved;
DROP INDEX IF EXISTS public.idx_fire_alarms_recorded_by_name;
DROP INDEX IF EXISTS public.idx_fire_alarms_recorded_by;
DROP INDEX IF EXISTS public.idx_fire_alarms_location;
DROP INDEX IF EXISTS public.idx_fire_alarms_alarm_time;
DROP INDEX IF EXISTS public.idx_fire_alarms_alarm_number;
DROP INDEX IF EXISTS public.idx_audit_log_table_name;
DROP INDEX IF EXISTS public.idx_audit_log_record_id;
DROP INDEX IF EXISTS public.idx_audit_log_ip_address;
DROP INDEX IF EXISTS public.idx_audit_log_changed_by;
DROP INDEX IF EXISTS public.idx_audit_log_changed_at;
DROP INDEX IF EXISTS public.idx_audit_log_action;
ALTER TABLE IF EXISTS ONLY public.visitor_records DROP CONSTRAINT IF EXISTS visitor_records_pkey;
ALTER TABLE IF EXISTS ONLY public.vehicles DROP CONSTRAINT IF EXISTS vehicles_plate_key;
ALTER TABLE IF EXISTS ONLY public.vehicles DROP CONSTRAINT IF EXISTS vehicles_pkey;
ALTER TABLE IF EXISTS ONLY public.vehicle_records DROP CONSTRAINT IF EXISTS vehicle_records_pkey;
ALTER TABLE IF EXISTS ONLY public.sgk_records DROP CONSTRAINT IF EXISTS sgk_records_pkey;
ALTER TABLE IF EXISTS ONLY public.sgk_records DROP CONSTRAINT IF EXISTS sgk_records_hashed_tc_key;
ALTER TABLE IF EXISTS ONLY public.personnel DROP CONSTRAINT IF EXISTS personnel_username_key;
ALTER TABLE IF EXISTS ONLY public.personnel DROP CONSTRAINT IF EXISTS personnel_pkey;
ALTER TABLE IF EXISTS ONLY public.managers_records DROP CONSTRAINT IF EXISTS managers_records_pkey;
ALTER TABLE IF EXISTS ONLY public.managers DROP CONSTRAINT IF EXISTS managers_pkey;
ALTER TABLE IF EXISTS ONLY public.incidents DROP CONSTRAINT IF EXISTS incidents_pkey;
ALTER TABLE IF EXISTS ONLY public.fire_alarms DROP CONSTRAINT IF EXISTS fire_alarms_pkey;
ALTER TABLE IF EXISTS ONLY public.audit_log DROP CONSTRAINT IF EXISTS audit_log_pkey;
DROP TABLE IF EXISTS public.visitor_records;
DROP TABLE IF EXISTS public.vehicles;
DROP TABLE IF EXISTS public.vehicle_records;
DROP TABLE IF EXISTS public.sgk_records;
DROP TABLE IF EXISTS public.personnel;
DROP TABLE IF EXISTS public.managers_records;
DROP TABLE IF EXISTS public.managers;
DROP TABLE IF EXISTS public.incidents;
DROP TABLE IF EXISTS public.fire_alarms;
DROP TABLE IF EXISTS public.audit_log;
DROP FUNCTION IF EXISTS public.update_updated_at_column();
DROP FUNCTION IF EXISTS public.update_sgk_records_updated_at();
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
    -- Recorded by name
    IF NEW.recorded_by IS NOT NULL AND NEW.recorded_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.recorded_by_name
        FROM personnel
        WHERE id = NEW.recorded_by;
    END IF;
    
    -- Resolved by name
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
    -- Entry by name
    IF NEW.entry_by IS NOT NULL AND NEW.entry_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.entry_by_name
        FROM personnel
        WHERE id = NEW.entry_by;
    END IF;
    
    -- Exit by name
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
    -- Given by name
    IF NEW.given_by IS NOT NULL AND NEW.given_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.given_by_name
        FROM personnel
        WHERE id = NEW.given_by;
    END IF;
    
    -- Returned by name
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
    -- Entry by name
    IF NEW.entry_by IS NOT NULL AND NEW.entry_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.entry_by_name
        FROM personnel
        WHERE id = NEW.entry_by;
    END IF;
    
    -- Exit by name
    IF NEW.exit_by IS NOT NULL AND NEW.exit_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.exit_by_name
        FROM personnel
        WHERE id = NEW.exit_by;
    END IF;
    
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
    CONSTRAINT audit_log_action_check CHECK (((action)::text = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying, 'SOFT_DELETE'::character varying, 'LOGIN'::character varying, 'LOGOUT'::character varying, 'FAILED_LOGIN'::character varying])::text[])))
);


--
-- Name: TABLE audit_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_log IS 'TÃ¼m kritik iÅŸlemlerin gÃ¼venlik kaydÄ± - KVKK uyumluluÄŸu iÃ§in';


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
    resolved_by_name character varying(200)
);


--
-- Name: TABLE fire_alarms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fire_alarms IS 'YangÄ±n alarm kayÄ±tlarÄ± tablosu';


--
-- Name: COLUMN fire_alarms.location; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.location IS 'AlarmÄ±n Ã§aldÄ±ÄŸÄ± konum';


--
-- Name: COLUMN fire_alarms.alarm_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.alarm_time IS 'AlarmÄ±n Ã§aldÄ±ÄŸÄ± zaman';


--
-- Name: COLUMN fire_alarms.resolved; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.resolved IS 'Alarm durumu Ã§Ã¶zÃ¼ldÃ¼ mÃ¼';


--
-- Name: COLUMN fire_alarms.resolution_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.resolution_time IS 'AlarmÄ±n Ã§Ã¶zÃ¼ldÃ¼ÄŸÃ¼ zaman';


--
-- Name: COLUMN fire_alarms.resolution_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.resolution_notes IS 'Ã‡Ã¶zÃ¼m notlarÄ±';


--
-- Name: COLUMN fire_alarms.false_alarm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.false_alarm IS 'YanlÄ±ÅŸ alarm mÄ±';


--
-- Name: COLUMN fire_alarms.recorded_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.recorded_by IS 'YangÄ±n alarmÄ±nÄ± kaydeden personel ID';


--
-- Name: COLUMN fire_alarms.alarm_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.alarm_number IS 'Alarm panel number or identifier';


--
-- Name: COLUMN fire_alarms.recorded_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.recorded_by_name IS 'YangÄ±n alarmÄ±nÄ± kaydeden personel adÄ±';


--
-- Name: COLUMN fire_alarms.resolved_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.resolved_by IS 'YangÄ±n alarmÄ±nÄ± Ã§Ã¶zÃ¼mleyen personel ID';


--
-- Name: COLUMN fire_alarms.resolved_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.resolved_by_name IS 'YangÄ±n alarmÄ±nÄ± Ã§Ã¶zÃ¼mleyen personel adÄ±';


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
    CONSTRAINT incidents_severity_check CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[])))
);


--
-- Name: TABLE incidents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.incidents IS 'GÃ¼venlik olaylarÄ± ve raporlarÄ±';


--
-- Name: COLUMN incidents.shift_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incidents.shift_label IS 'Vardiya etiketi: 00:00-08:00, 08:00-16:00, 16:00-00:00';


--
-- Name: COLUMN incidents.report_content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incidents.report_content IS 'Vardiya rapor iÃ§eriÄŸi (HTML formatÄ±nda)';


--
-- Name: COLUMN incidents.report_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incidents.report_date IS 'Raporun oluÅŸturulduÄŸu tarih';


--
-- Name: COLUMN incidents.report_file_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incidents.report_file_path IS 'Word dosyasÄ±nÄ±n sunucu Ã¼zerindeki tam yolu';


--
-- Name: COLUMN incidents.recorded_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.incidents.recorded_by_name IS 'OlayÄ± kaydeden personelin adÄ± soyadÄ±';


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
    manager_id uuid NOT NULL,
    entry_by uuid NOT NULL,
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
    CONSTRAINT managers_records_status_check CHECK (((status)::text = ANY ((ARRAY['inside'::character varying, 'exited'::character varying, 'active'::character varying, 'passive'::character varying])::text[])))
);


--
-- Name: COLUMN managers_records.entry_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.managers_records.entry_by IS 'MÃ¼dÃ¼r giriÅŸini kaydeden personel ID';


--
-- Name: COLUMN managers_records.entry_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.managers_records.entry_by_name IS 'MÃ¼dÃ¼r giriÅŸini kaydeden personel adÄ±';


--
-- Name: COLUMN managers_records.exit_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.managers_records.exit_by IS 'MÃ¼dÃ¼r Ã§Ä±kÄ±ÅŸÄ±nÄ± kaydeden personel ID';


--
-- Name: COLUMN managers_records.exit_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.managers_records.exit_by_name IS 'MÃ¼dÃ¼r Ã§Ä±kÄ±ÅŸÄ±nÄ± kaydeden personel adÄ±';


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
    CONSTRAINT personnel_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'personnel'::character varying])::text[])))
);


--
-- Name: sgk_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sgk_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hashed_tc character varying(255) NOT NULL,
    full_name character varying(100) NOT NULL,
    company_name character varying(100),
    file_path character varying(500) NOT NULL,
    upload_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    personnel_id uuid,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    personnel_name character varying(200)
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

COMMENT ON COLUMN public.sgk_records.hashed_tc IS 'Hashed TC Kimlik No (KVKK compliant, unique)';


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

COMMENT ON COLUMN public.sgk_records.personnel_name IS 'KaydÄ± yÃ¼kleyen personelin adÄ± soyadÄ±';


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
    CONSTRAINT vehicle_records_status_check CHECK (((status)::text = ANY ((ARRAY['in_use'::character varying, 'returned'::character varying])::text[])))
);


--
-- Name: COLUMN vehicle_records.given_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vehicle_records.given_by IS 'AracÄ± teslim eden personel ID';


--
-- Name: COLUMN vehicle_records.given_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vehicle_records.given_by_name IS 'AracÄ± teslim eden personel adÄ±';


--
-- Name: COLUMN vehicle_records.returned_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vehicle_records.returned_by IS 'AracÄ± teslim alan personel ID';


--
-- Name: COLUMN vehicle_records.returned_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vehicle_records.returned_by_name IS 'AracÄ± teslim alan personel adÄ±';


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
    CONSTRAINT vehicles_status_check CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'in_use'::character varying, 'maintenance'::character varying])::text[])))
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
    person_count integer DEFAULT 1,
    phone character varying(20),
    notes text,
    entry_by uuid NOT NULL,
    entry_date date NOT NULL,
    entry_time time without time zone NOT NULL,
    exit_date date,
    exit_time time without time zone,
    status character varying(20) DEFAULT 'inside'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    subcontractor_worker boolean DEFAULT false NOT NULL,
    for_electric_station boolean DEFAULT false NOT NULL,
    send_whatsapp boolean DEFAULT false,
    entry_by_name character varying(200),
    exit_by uuid,
    exit_by_name character varying(200),
    CONSTRAINT visitor_records_person_count_check CHECK ((person_count > 0)),
    CONSTRAINT visitor_records_status_check CHECK (((status)::text = ANY ((ARRAY['inside'::character varying, 'exited'::character varying])::text[])))
);


--
-- Name: COLUMN visitor_records.entry_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visitor_records.entry_by IS 'ZiyaretÃ§i giriÅŸini kaydeden personel ID';


--
-- Name: COLUMN visitor_records.send_whatsapp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visitor_records.send_whatsapp IS 'WhatsApp grubuna bildirim gönderilsin mi?';


--
-- Name: COLUMN visitor_records.entry_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visitor_records.entry_by_name IS 'ZiyaretÃ§i giriÅŸini kaydeden personel adÄ±';


--
-- Name: COLUMN visitor_records.exit_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visitor_records.exit_by IS 'ZiyaretÃ§i Ã§Ä±kÄ±ÅŸÄ±nÄ± kaydeden personel ID';


--
-- Name: COLUMN visitor_records.exit_by_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visitor_records.exit_by_name IS 'ZiyaretÃ§i Ã§Ä±kÄ±ÅŸÄ±nÄ± kaydeden personel adÄ±';


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.audit_log VALUES ('f218d46c-dc38-4d88-b720-f27566901e9f', 'auth', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', 'LOGIN', NULL, '{"success": true, "username": "furkan.celik", "timestamp": "2025-12-19T06:39:27.743Z"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 09:39:27.745516');
INSERT INTO public.audit_log VALUES ('3ac207a5-6bd9-4c50-ac75-38337364024c', 'auth', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', 'LOGOUT', NULL, '{"timestamp": "2025-12-19T07:11:29.409Z"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 10:11:29.411321');
INSERT INTO public.audit_log VALUES ('f916b7d9-d4e0-4ba8-b124-4041c7c951df', 'auth', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', 'LOGIN', NULL, '{"success": true, "username": "furkan.celik", "timestamp": "2025-12-19T07:11:35.244Z"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 10:11:35.24504');
INSERT INTO public.audit_log VALUES ('1f12e42b-32df-49bb-a5e8-30522343af5c', 'auth', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', 'LOGIN', NULL, '{"success": true, "username": "furkan.celik", "timestamp": "2025-12-19T07:14:07.015Z"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 10:14:07.016245');
INSERT INTO public.audit_log VALUES ('9f0c90d2-bf58-4ff8-bfd1-8e1066048cac', 'auth', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', 'LOGIN', NULL, '{"success": true, "username": "furkan.celik", "timestamp": "2025-12-19T07:14:22.445Z"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 10:14:22.446756');
INSERT INTO public.audit_log VALUES ('ef40a683-a9ed-408b-8700-42442874880c', 'auth', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', 'LOGIN', NULL, '{"success": true, "username": "furkan.celik", "timestamp": "2025-12-19T07:17:10.593Z"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 10:17:10.596548');
INSERT INTO public.audit_log VALUES ('1999aa7f-50ea-44a5-95fd-bed37cb09769', 'sgk_records', '714a1cd8-9332-46f0-8b93-4d3cb375884e', 'INSERT', NULL, '{"id": "714a1cd8-9332-46f0-8b93-4d3cb375884e", "notes": null, "file_path": "9422_Furkan_Çelik.pdf", "full_name": "Furkan Çelik", "hashed_tc": "713004a9f72bef29a132f3046f4d9c678ae47bafb8762b54d21f72b92e793cef", "created_at": "2025-12-19T07:18:38.101Z", "deleted_at": null, "updated_at": "2025-12-19T07:18:38.102Z", "upload_date": "2025-12-19T07:18:38.101Z", "company_name": "Dosinia", "personnel_id": "c2eb0d05-93e8-4e3a-97f4-3541cebdf61e"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::ffff:127.0.0.1', NULL, '2025-12-19 10:18:38.109263');
INSERT INTO public.audit_log VALUES ('567eec2a-ee74-49b5-8950-f3d2d2ba9373', 'sgk_records', 'dcb9a23a-b787-467e-b78c-e6ebef9073c8', 'INSERT', NULL, '{"id": "dcb9a23a-b787-467e-b78c-e6ebef9073c8", "notes": null, "file_path": "9422_adem_çelik.pdf", "full_name": "adem çelik", "hashed_tc": "6847b964a53d2154216e10eb0087c4e022705dca8589cf67026c9e50c656c8f5", "created_at": "2025-12-19T07:43:36.380Z", "deleted_at": null, "updated_at": "2025-12-19T07:43:36.381Z", "upload_date": "2025-12-19T07:43:36.380Z", "company_name": "dosinia", "personnel_id": "c2eb0d05-93e8-4e3a-97f4-3541cebdf61e"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 10:43:36.399037');
INSERT INTO public.audit_log VALUES ('e4d486d5-1d00-4612-bd4d-7b807540e919', 'sgk_records', '42424302-0195-45c5-a11c-c021ce91307a', 'INSERT', NULL, '{"id": "42424302-0195-45c5-a11c-c021ce91307a", "notes": null, "file_path": "9422_Furkan_Çelik.pdf", "full_name": "Furkan Çelik", "hashed_tc": "faf542efd0e780af9ab1bfebbdb01323f982c1c45d426af90fdcb9965a25fbe3", "created_at": "2025-12-19T07:44:31.335Z", "deleted_at": null, "updated_at": "2025-12-19T07:44:31.336Z", "upload_date": "2025-12-19T07:44:31.335Z", "company_name": "dosinia", "personnel_id": "c2eb0d05-93e8-4e3a-97f4-3541cebdf61e"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 10:44:31.33889');
INSERT INTO public.audit_log VALUES ('e7e7422b-38ef-4629-aa06-af7829ce64d2', 'sgk_records', '614e687b-ce4c-41ed-94c5-04f800b3c126', 'INSERT', NULL, '{"id": "614e687b-ce4c-41ed-94c5-04f800b3c126", "notes": null, "file_path": "7756_Veysel_Çelik_4d7e20fd.png", "full_name": "Veysel Çelik", "hashed_tc": "2b75c1211bca15b6fd5ac3488e67eba2678bd28d2e47925d0f2056d140551cf9", "created_at": "2025-12-19T07:58:11.772Z", "deleted_at": null, "updated_at": "2025-12-19T07:58:11.774Z", "upload_date": "2025-12-19T07:58:11.772Z", "company_name": "grand ring", "personnel_id": "c2eb0d05-93e8-4e3a-97f4-3541cebdf61e"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 10:58:11.778507');
INSERT INTO public.audit_log VALUES ('61441e93-f136-4e8b-8825-d916019da3b8', 'auth', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', 'LOGIN', NULL, '{"success": true, "username": "furkan.celik", "timestamp": "2025-12-19T08:41:01.553Z"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 11:41:01.555026');
INSERT INTO public.audit_log VALUES ('b04022e9-754f-4c97-85f1-f1f3da5f3fd3', 'fire_alarms', '8a17a0a3-c364-4f23-8d27-4ee0c7ec45f1', 'INSERT', NULL, '{"location": "Lobi", "alarm_time": "2025-12-19T08:52:11.615Z", "alarm_number": "308"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 11:52:11.650548');
INSERT INTO public.audit_log VALUES ('f35b7873-cb4b-47a7-b226-f47d745c0667', 'fire_alarms', '8a17a0a3-c364-4f23-8d27-4ee0c7ec45f1', 'UPDATE', '{"id": "8a17a0a3-c364-4f23-8d27-4ee0c7ec45f1", "location": "Lobi", "resolved": false, "alarm_time": "2025-12-19T05:52:11.615Z", "created_at": "2025-12-19T08:52:11.632Z", "deleted_at": null, "updated_at": "2025-12-19T08:52:11.632Z", "false_alarm": false, "recorded_by": "c2eb0d05-93e8-4e3a-97f4-3541cebdf61e", "alarm_number": "308", "resolution_time": null, "recorded_by_name": "Furkan Çelik", "resolution_notes": null}', '{"resolved": true, "resolution_time": "2025-12-19T08:52:34.926Z", "resolution_notes": null}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 11:52:34.92734');
INSERT INTO public.audit_log VALUES ('81abade4-2ffe-4b6a-8448-aa481bc87ae2', 'incidents', '4e767e8f-6071-4d49-8680-8679494118f3', 'INSERT', NULL, '{"file_path": "C:\\Users\\imfurkaann\\Documents\\projects\\security\\backend\\reports\\2025-Aralik\\19\\rapor_08-00-16-00.docx", "report_type": "shift_report", "shift_label": "08:00-16:00"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 11:54:36.725698');
INSERT INTO public.audit_log VALUES ('a86ead1d-6042-4de8-9c55-3ca12830edb8', 'managers_records', '1f1e1915-d30d-4ba3-a616-26e50cb1548d', 'INSERT', NULL, '{"manager_id": "021c773f-1677-41a3-ae12-0f50b69a42fe", "manager_name": "Adem Çelik"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 11:55:36.101489');
INSERT INTO public.audit_log VALUES ('69d476e4-0c76-476c-ab4c-ff84cc01b4b0', 'managers_records', '1f1e1915-d30d-4ba3-a616-26e50cb1548d', 'UPDATE', '{"status": "inside"}', '{"status": "exited"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 11:55:39.751808');
INSERT INTO public.audit_log VALUES ('932029a5-0b90-440b-9942-19741bbf906f', 'vehicle_records', 'bb69789a-dd1a-4caa-9347-de62e00838ab', 'INSERT', NULL, '{"manager_id": "021c773f-1677-41a3-ae12-0f50b69a42fe", "vehicle_id": "38a6939e-6e08-48ce-9066-4ac6e0021818", "destination": "lojman", "personnel_id": "c2eb0d05-93e8-4e3a-97f4-3541cebdf61e"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 11:57:12.115121');
INSERT INTO public.audit_log VALUES ('3fe97213-c4e4-4949-bad1-987b64d79d28', 'vehicle_records', 'bb69789a-dd1a-4caa-9347-de62e00838ab', 'UPDATE', '{"status": "in_use"}', '{"status": "returned", "return_date": "CURRENT_DATE"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 11:57:15.951298');
INSERT INTO public.audit_log VALUES ('3446313d-89c4-4bfc-9446-582b5ed71e8c', 'visitor_records', '6848c90a-b4be-4ab8-8903-6120d296d1ed', 'INSERT', NULL, '{"full_name": "test", "company_name": null, "vehicle_plate": null}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 11:57:47.312215');
INSERT INTO public.audit_log VALUES ('fa0724ce-6440-4f8f-ac72-8e3de6adf0f4', 'visitor_records', '6848c90a-b4be-4ab8-8903-6120d296d1ed', 'UPDATE', '{"status": "inside"}', '{"status": "exited"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 11:57:50.969874');
INSERT INTO public.audit_log VALUES ('5f295d84-26f7-45af-948a-d018a0c41fd7', 'vehicle_records', '8648bcde-777c-4af6-a2db-f5844af106e8', 'INSERT', NULL, '{"manager_id": "c9c1b4a8-e690-4ef3-8703-c1573e36a6c5", "vehicle_id": "38a6939e-6e08-48ce-9066-4ac6e0021818", "destination": "lojman", "personnel_id": "c2eb0d05-93e8-4e3a-97f4-3541cebdf61e"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 12:08:46.327015');
INSERT INTO public.audit_log VALUES ('7a02f480-243b-4aa1-9359-726e4928aa49', 'vehicle_records', '8648bcde-777c-4af6-a2db-f5844af106e8', 'UPDATE', '{"status": "in_use"}', '{"status": "returned", "return_date": "CURRENT_DATE"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 12:08:50.811018');
INSERT INTO public.audit_log VALUES ('11368d1f-35ee-44f3-a5bb-3d19945204db', 'vehicle_records', 'b3aae265-2bb8-4a37-86db-584ed76e0a2a', 'INSERT', NULL, '{"manager_id": "33c0b345-6d04-4876-9bf2-d57fcc721b53", "vehicle_id": "7aff358c-7e15-4ab0-8e88-175e9d8b8b43", "destination": "deneme", "personnel_id": "c2eb0d05-93e8-4e3a-97f4-3541cebdf61e"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 12:08:57.69003');
INSERT INTO public.audit_log VALUES ('2f97c261-e625-4f7f-a8c0-674ba0aa6256', 'visitor_records', '2bebac86-143a-4c88-913d-dfab9a30e57e', 'INSERT', NULL, '{"full_name": "test", "company_name": null, "vehicle_plate": null}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 12:09:05.017411');
INSERT INTO public.audit_log VALUES ('1590ba4c-1456-4602-b0d0-4fb546b573d2', 'managers_records', '4b58e5ad-2bd0-4aa7-9a5a-e44cc1dc809c', 'INSERT', NULL, '{"manager_id": "f6fe96a5-096d-4e67-9b9e-218523841590", "manager_name": "Mustafa Gülbudak"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 12:09:13.035971');
INSERT INTO public.audit_log VALUES ('a219c65c-0eb3-478b-8a65-fe881ccbf2e4', 'fire_alarms', '98c9aff6-fa1b-44b3-b4f2-a11d6ccf47fd', 'INSERT', NULL, '{"location": "Lobi", "alarm_time": "2025-12-19T09:09:19.976Z", "alarm_number": "305"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 12:09:19.995396');
INSERT INTO public.audit_log VALUES ('facf4748-73ce-4db1-9076-da79028af58c', 'auth', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', 'LOGOUT', NULL, '{"timestamp": "2025-12-19T09:09:23.774Z"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 12:09:23.774347');
INSERT INTO public.audit_log VALUES ('a233be7f-22aa-466e-b343-5f113a717bd5', 'auth', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'LOGIN', NULL, '{"success": true, "username": "raziye.toraman", "timestamp": "2025-12-19T09:09:31.949Z"}', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '::1', NULL, '2025-12-19 12:09:31.950224');
INSERT INTO public.audit_log VALUES ('51aa11ef-1957-41db-91ac-82447da3531a', 'vehicle_records', 'b3aae265-2bb8-4a37-86db-584ed76e0a2a', 'UPDATE', '{"status": "in_use"}', '{"status": "returned", "return_date": "CURRENT_DATE"}', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '::1', NULL, '2025-12-19 12:09:36.701916');
INSERT INTO public.audit_log VALUES ('b6a8575f-81a2-4d97-aa24-460143688101', 'visitor_records', '2bebac86-143a-4c88-913d-dfab9a30e57e', 'UPDATE', '{"status": "inside"}', '{"status": "exited"}', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '::1', NULL, '2025-12-19 12:09:42.007643');
INSERT INTO public.audit_log VALUES ('673dbe8c-2b68-4efc-9fcb-76664ff143fe', 'managers_records', '4b58e5ad-2bd0-4aa7-9a5a-e44cc1dc809c', 'UPDATE', '{"status": "inside"}', '{"status": "exited"}', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '::1', NULL, '2025-12-19 12:09:47.382684');
INSERT INTO public.audit_log VALUES ('f15da9f9-5de7-49f3-9d77-cf06a42fd2d8', 'fire_alarms', '98c9aff6-fa1b-44b3-b4f2-a11d6ccf47fd', 'UPDATE', '{"id": "98c9aff6-fa1b-44b3-b4f2-a11d6ccf47fd", "location": "Lobi", "resolved": false, "alarm_time": "2025-12-19T06:09:19.976Z", "created_at": "2025-12-19T09:09:19.983Z", "deleted_at": null, "updated_at": "2025-12-19T09:09:19.983Z", "false_alarm": false, "recorded_by": "c2eb0d05-93e8-4e3a-97f4-3541cebdf61e", "resolved_by": null, "alarm_number": "305", "resolution_time": null, "recorded_by_name": "Furkan Çelik", "resolution_notes": null, "resolved_by_name": null}', '{"resolved": true, "resolution_time": "2025-12-19T09:09:52.199Z", "resolution_notes": null}', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '::1', NULL, '2025-12-19 12:09:52.199828');
INSERT INTO public.audit_log VALUES ('54540646-0e21-42b1-9d43-53feeeb184ae', 'incidents', '4e767e8f-6071-4d49-8680-8679494118f3', 'UPDATE', '{"shift_label": "08:00-16:00", "report_file_path": "C:\\Users\\imfurkaann\\Documents\\projects\\security\\backend\\reports\\2025-Aralik\\19\\rapor_08-00-16-00.docx"}', '{"report_content": "&lt;p&gt;&lt;br&gt;&lt;&#x2F;p&gt;&lt;h2&gt;What is Lorem Ipsum?&lt;&#x2F;h2&gt;&lt;p&gt;&lt;strong&gt;Lorem Ipsum&lt;&#x2F;strong&gt; is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry&#x27;s standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.&lt;&#x2F;p&gt;&lt;h2&gt;Why do we use it?&lt;&#x2F;h2&gt;&lt;p&gt;It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using &#x27;Content here, content here&#x27;, making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for &#x27;lorem ipsum&#x27; will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).&lt;&#x2F;p&gt;&lt;p&gt;&lt;br&gt;&lt;&#x2F;p&gt;", "report_file_path": "C:\\Users\\imfurkaann\\Documents\\projects\\security\\backend\\reports\\2025-Aralik\\19\\rapor_08-00-16-00.docx"}', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '::1', NULL, '2025-12-19 12:23:59.793577');
INSERT INTO public.audit_log VALUES ('5a29ff88-bca6-4154-8682-b3f6c380c244', 'incidents', '4e767e8f-6071-4d49-8680-8679494118f3', 'UPDATE', '{"shift_label": "08:00-16:00", "report_file_path": "C:\\Users\\imfurkaann\\Documents\\projects\\security\\backend\\reports\\2025-Aralik\\19\\rapor_08-00-16-00.docx"}', '{"report_content": "What is Lorem Ipsum?\nLorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry&#x27;s standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.\n\nWhy do we use it?\nIt is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using &#x27;Content here, content here&#x27;, making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for &#x27;lorem ipsum&#x27; will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).", "report_file_path": "C:\\Users\\imfurkaann\\Documents\\projects\\security\\backend\\reports\\2025-Aralik\\19\\rapor_08-00-16-00.docx"}', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '::1', NULL, '2025-12-19 12:31:49.84059');
INSERT INTO public.audit_log VALUES ('4f5debc5-35ac-4494-9fd3-26412143e01b', 'auth', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'LOGOUT', NULL, '{"timestamp": "2025-12-19T09:32:27.420Z"}', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '::1', NULL, '2025-12-19 12:32:27.421294');
INSERT INTO public.audit_log VALUES ('f88038a2-0c7d-4063-942f-338a03fcb44c', 'auth', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', 'LOGIN', NULL, '{"success": true, "username": "furkan.celik", "timestamp": "2025-12-19T09:32:35.733Z"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 12:32:35.73416');
INSERT INTO public.audit_log VALUES ('8698d6c4-4290-4c88-9529-9c0612f1c134', 'incidents', '4e767e8f-6071-4d49-8680-8679494118f3', 'UPDATE', '{"shift_label": "08:00-16:00", "report_file_path": "C:\\Users\\imfurkaann\\Documents\\projects\\security\\backend\\reports\\2025-Aralik\\19\\rapor_08-00-16-00.docx"}', '{"report_content": "aaaaaaaaaaaaaaaaaa", "report_file_path": "C:\\Users\\imfurkaann\\Documents\\projects\\security\\backend\\reports\\2025-Aralik\\19\\rapor_08-00-16-00.docx"}', 'c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', '::1', NULL, '2025-12-19 12:32:46.432853');


--
-- Data for Name: fire_alarms; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: incidents; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: managers; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.managers VALUES ('988cdcf6-e8d6-4528-b31d-7cf99ca2acd5', 'Özder', 'Özdemir', 'Kalite Müdürü', true, '2025-12-16 15:08:55.973323', '2025-12-16 15:08:55.973323', NULL);
INSERT INTO public.managers VALUES ('9709accb-66f3-40f1-8660-9384cf490805', 'Taşkın', 'Aydoğdu', 'Genel Müdür Yardımcısı', true, '2025-12-16 15:08:55.973323', '2025-12-16 15:08:55.973323', NULL);
INSERT INTO public.managers VALUES ('26ff5729-4e7e-4aa5-8f1f-b3cfbbc9c027', 'Mennan', 'Gencer', 'Satınalma Müdürü', true, '2025-12-16 15:08:55.973323', '2025-12-16 15:08:55.973323', NULL);
INSERT INTO public.managers VALUES ('c691464f-1e5c-4389-b6df-cbde13cba475', 'Abdullah', 'Özbulut', 'HK Müdürü', true, '2025-12-16 15:08:55.973323', '2025-12-16 15:08:55.973323', NULL);
INSERT INTO public.managers VALUES ('ecec250d-2a12-4094-889f-1f797bdd0684', 'Berna', 'Sever', 'Satış ve Pazarlama Müdürü', true, '2025-12-16 15:08:55.973323', '2025-12-16 15:08:55.973323', NULL);
INSERT INTO public.managers VALUES ('f6fe96a5-096d-4e67-9b9e-218523841590', 'Mustafa', 'Gülbudak', 'Animasyon Müdürü', true, '2025-12-16 15:08:55.973323', '2025-12-16 15:08:55.973323', NULL);
INSERT INTO public.managers VALUES ('ef1610ab-a34b-4419-9c1c-36998ae0e759', 'Savaş', 'Gülcan', 'Aşçıbaşı', true, '2025-12-16 15:08:55.973323', '2025-12-16 15:08:55.973323', NULL);
INSERT INTO public.managers VALUES ('c9c1b4a8-e690-4ef3-8703-c1573e36a6c5', 'Funda', 'Solmaz', 'Muhasebe Müdürü', true, '2025-12-16 15:08:55.973323', '2025-12-16 15:08:55.973323', NULL);
INSERT INTO public.managers VALUES ('33c0b345-6d04-4876-9bf2-d57fcc721b53', 'Erkan', 'Ünlü', 'Teknik Müdürü', true, '2025-12-16 15:08:55.973323', '2025-12-16 15:08:55.973323', NULL);
INSERT INTO public.managers VALUES ('376fc775-68db-47d6-ab24-e4e508a57b0f', 'Ali', 'Uyanık', 'Gece Müdürü', true, '2025-12-16 15:08:55.973323', '2025-12-16 15:08:55.973323', NULL);
INSERT INTO public.managers VALUES ('021c773f-1677-41a3-ae12-0f50b69a42fe', 'Adem', 'Çelik', 'Güvenlik Müdürü', true, '2025-12-16 15:08:55.973323', '2025-12-16 15:08:55.973323', NULL);
INSERT INTO public.managers VALUES ('49c30d9d-fce8-4c59-ab7a-8df3c35b7912', 'Funda', 'Şen', 'İnsan Kaynakları Müdürü', true, '2025-12-16 15:08:55.973323', '2025-12-16 15:08:55.973323', NULL);
INSERT INTO public.managers VALUES ('d8a05c06-da74-4f4c-b044-cf29bc957901', 'Sinan', 'Mesut', 'Önbüro Müdürü', true, '2025-12-16 15:08:55.973323', '2025-12-16 15:08:55.973323', NULL);


--
-- Data for Name: managers_records; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: personnel; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.personnel VALUES ('7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Raziye', 'Toraman', 'raziye.toraman', '$2a$10$V1oUHKcWe8wbW.gFaepGoO.4w1yNmofAGaIKEd7MUUlaK1TECoQkm', 'personnel', true, '2025-12-16 18:36:49.418131', '2025-12-16 18:36:49.418131', NULL);
INSERT INTO public.personnel VALUES ('1cec7a33-4764-432c-9480-7285965e5f78', 'Ferhat', 'Kurt', 'ferhat.kurt', '$2a$10$QCMbOY9hT9y2rzamcr.exOSxDlft0r5VJHvJQ7Ql6A6p6ZnDhAsUq', 'personnel', true, '2025-12-16 18:36:49.422515', '2025-12-16 18:36:49.422515', NULL);
INSERT INTO public.personnel VALUES ('5d4eb90c-03cd-4034-9be9-d2504f09ff6c', 'Ahmet', 'Akgül', 'ahmet.akgul', '$2a$10$zh1znM2WdH0ReljSkYMKpeJ.K3GmTkOdPs5Y6/SeL3iYnV1/zJGAO', 'personnel', true, '2025-12-16 18:36:49.423253', '2025-12-16 18:36:49.423253', NULL);
INSERT INTO public.personnel VALUES ('64619a78-594a-446b-8e39-4958d9484163', 'Mustan', 'Bozdağ', 'mustan.bozdag', '$2a$10$sCBlZbIU3vSGdH518VABS.BAsNyzaRUBMYBI1261f9WAOPHaYeDxC', 'personnel', true, '2025-12-16 18:36:49.42404', '2025-12-16 18:36:49.42404', NULL);
INSERT INTO public.personnel VALUES ('35446e4b-d11a-425d-9d76-f4d93a6336fe', 'Hatice', 'Öztürk', 'hatice.ozturk', '$2a$10$1HSz20x5hub6MiL8c.Wkce3hm60LppBiTmgOX9UCWAyVvl/e7/.Dy', 'personnel', true, '2025-12-16 18:36:49.424612', '2025-12-16 18:36:49.424612', NULL);
INSERT INTO public.personnel VALUES ('c2eb0d05-93e8-4e3a-97f4-3541cebdf61e', 'Furkan', 'Çelik', 'furkan.celik', '$2a$10$6G9dEDveMb.xRH5aDBDCx.oyc0VgtNe5y4CFPgjfT6T7q8Eow8uSa', 'personnel', true, '2025-12-16 18:36:49.425124', '2025-12-16 18:36:49.425124', NULL);
INSERT INTO public.personnel VALUES ('072c24fd-f4fc-40f9-b25d-93aab3edea56', 'Hanifi', 'Çelik', 'hanifi.celik', '$2a$10$svGRZ8U.qRZ/J09hM40TJOu1uoLtSNZJXEaM2XWn8iiGbMivIImaq', 'personnel', true, '2025-12-16 18:36:49.425664', '2025-12-16 18:36:49.425664', NULL);
INSERT INTO public.personnel VALUES ('938b9c36-b187-4481-8cef-9890ba00b0f9', 'İsmail', 'Aksoy', 'ismail.aksoy', '$2a$10$SJalr4jRVrztmS.CninW7uyLx.jxrf5QxSm.QkE7j04Qnrrumb78G', 'personnel', true, '2025-12-16 18:36:49.426196', '2025-12-16 18:36:49.426196', NULL);
INSERT INTO public.personnel VALUES ('5fd7f6d8-e6bb-4e33-8f03-d062a96cf55d', 'Umut', 'Hıncal', 'umut.hincal', '$2a$10$qrLK9vsDUz.cLYi8ueResOhL9gFKmqcRaJLaVtcGoufP7X0HHT8QC', 'personnel', true, '2025-12-16 18:36:49.426666', '2025-12-16 18:36:49.426666', NULL);
INSERT INTO public.personnel VALUES ('372a1bb5-c71f-4199-bfab-13e602964243', 'Adem', 'Çelik', 'adem.celik', '$2a$10$dbweBKNsLvJGLCs.wTK2L.b99WfX.TvZrUUiE3rWI/IawXpyU3FNi', 'admin', true, '2025-12-16 18:36:49.427133', '2025-12-16 18:36:49.427133', NULL);


--
-- Data for Name: sgk_records; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: vehicle_records; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.vehicles VALUES ('24381b26-2db2-45b9-abba-9ace5ee99d29', 'Otokar Atlas', '07BEE763', 'available', true, '2025-12-16 18:36:49.427817', '2025-12-16 18:36:49.427817', NULL);
INSERT INTO public.vehicles VALUES ('8b038c93-3084-4540-8991-1e00a1994d9b', 'Opel Vivaro', '07CCU163', 'available', true, '2025-12-16 18:36:49.432213', '2025-12-16 18:36:49.432213', NULL);
INSERT INTO public.vehicles VALUES ('38a6939e-6e08-48ce-9066-4ac6e0021818', 'Ford Transit', '07AEN693', 'available', true, '2025-12-16 18:36:49.43085', '2025-12-19 12:08:50.785521', NULL);
INSERT INTO public.vehicles VALUES ('7aff358c-7e15-4ab0-8e88-175e9d8b8b43', 'Fiat Doblo', '07ABJ290', 'available', true, '2025-12-16 18:36:49.431586', '2025-12-19 12:09:36.694653', NULL);


--
-- Data for Name: visitor_records; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: fire_alarms fire_alarms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fire_alarms
    ADD CONSTRAINT fire_alarms_pkey PRIMARY KEY (id);


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
-- Name: personnel personnel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel
    ADD CONSTRAINT personnel_pkey PRIMARY KEY (id);


--
-- Name: personnel personnel_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel
    ADD CONSTRAINT personnel_username_key UNIQUE (username);


--
-- Name: sgk_records sgk_records_hashed_tc_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sgk_records
    ADD CONSTRAINT sgk_records_hashed_tc_key UNIQUE (hashed_tc);


--
-- Name: sgk_records sgk_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sgk_records
    ADD CONSTRAINT sgk_records_pkey PRIMARY KEY (id);


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
-- Name: vehicles vehicles_plate_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_plate_key UNIQUE (plate);


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
-- Name: idx_fire_alarms_alarm_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fire_alarms_alarm_number ON public.fire_alarms USING btree (alarm_number);


--
-- Name: idx_fire_alarms_alarm_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fire_alarms_alarm_time ON public.fire_alarms USING btree (alarm_time) WHERE (deleted_at IS NULL);


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
-- Name: idx_personnel_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnel_role ON public.personnel USING btree (role) WHERE (deleted_at IS NULL);


--
-- Name: idx_personnel_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnel_username ON public.personnel USING btree (username) WHERE (deleted_at IS NULL);


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
-- Name: idx_vehicle_records_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_records_date ON public.vehicle_records USING btree (given_date) WHERE (deleted_at IS NULL);


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
-- Name: idx_visitor_records_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_date ON public.visitor_records USING btree (entry_date) WHERE (deleted_at IS NULL);


--
-- Name: idx_visitor_records_entry_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_entry_by ON public.visitor_records USING btree (entry_by) WHERE (deleted_at IS NULL);


--
-- Name: idx_visitor_records_entry_by_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_entry_by_name ON public.visitor_records USING btree (entry_by_name);


--
-- Name: idx_visitor_records_exit_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_exit_by ON public.visitor_records USING btree (exit_by) WHERE (deleted_at IS NULL);


--
-- Name: idx_visitor_records_exit_by_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_exit_by_name ON public.visitor_records USING btree (exit_by_name);


--
-- Name: idx_visitor_records_plate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_plate ON public.visitor_records USING btree (vehicle_plate) WHERE (deleted_at IS NULL);


--
-- Name: idx_visitor_records_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_status ON public.visitor_records USING btree (status) WHERE (deleted_at IS NULL);


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
    ADD CONSTRAINT managers_records_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.managers(id) ON DELETE CASCADE;


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
    ADD CONSTRAINT vehicle_records_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.managers(id) ON DELETE CASCADE;


--
-- Name: vehicle_records vehicle_records_returned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_records
    ADD CONSTRAINT vehicle_records_returned_by_fkey FOREIGN KEY (returned_by) REFERENCES public.personnel(id) ON DELETE SET NULL;


--
-- Name: vehicle_records vehicle_records_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_records
    ADD CONSTRAINT vehicle_records_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


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

