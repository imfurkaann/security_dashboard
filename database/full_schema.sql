--
-- PostgreSQL database dump
--

-- Dumped from database version 17.2
-- Dumped by pg_dump version 17.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;  -- PostgreSQL 15 doesn't support this
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.visitor_records DROP CONSTRAINT IF EXISTS visitor_records_personnel_id_fkey;
ALTER TABLE IF EXISTS ONLY public.vehicle_records DROP CONSTRAINT IF EXISTS vehicle_records_vehicle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.vehicle_records DROP CONSTRAINT IF EXISTS vehicle_records_personnel_id_fkey;
ALTER TABLE IF EXISTS ONLY public.vehicle_records DROP CONSTRAINT IF EXISTS vehicle_records_manager_id_fkey;
ALTER TABLE IF EXISTS ONLY public.managers_records DROP CONSTRAINT IF EXISTS managers_records_recorded_by_fkey;
ALTER TABLE IF EXISTS ONLY public.managers_records DROP CONSTRAINT IF EXISTS managers_records_manager_id_fkey;
ALTER TABLE IF EXISTS ONLY public.incidents DROP CONSTRAINT IF EXISTS incidents_resolved_by_fkey;
ALTER TABLE IF EXISTS ONLY public.incidents DROP CONSTRAINT IF EXISTS incidents_recorded_by_fkey;
ALTER TABLE IF EXISTS ONLY public.fire_alarms DROP CONSTRAINT IF EXISTS fire_alarms_recorded_by_fkey;
ALTER TABLE IF EXISTS ONLY public.audit_log DROP CONSTRAINT IF EXISTS audit_log_changed_by_fkey;
DROP TRIGGER IF EXISTS update_visitor_records_updated_at ON public.visitor_records;
DROP TRIGGER IF EXISTS update_vehicles_updated_at ON public.vehicles;
DROP TRIGGER IF EXISTS update_vehicle_records_updated_at ON public.vehicle_records;
DROP TRIGGER IF EXISTS update_personnel_updated_at ON public.personnel;
DROP TRIGGER IF EXISTS update_managers_updated_at ON public.managers;
DROP TRIGGER IF EXISTS update_managers_records_updated_at ON public.managers_records;
DROP TRIGGER IF EXISTS update_incidents_updated_at ON public.incidents;
DROP TRIGGER IF EXISTS trigger_sync_manager_name ON public.vehicle_records;
DROP INDEX IF EXISTS public.idx_visitor_records_status;
DROP INDEX IF EXISTS public.idx_visitor_records_plate;
DROP INDEX IF EXISTS public.idx_visitor_records_personnel;
DROP INDEX IF EXISTS public.idx_visitor_records_date;
DROP INDEX IF EXISTS public.idx_vehicles_status;
DROP INDEX IF EXISTS public.idx_vehicles_plate;
DROP INDEX IF EXISTS public.idx_vehicle_records_vehicle;
DROP INDEX IF EXISTS public.idx_vehicle_records_status;
DROP INDEX IF EXISTS public.idx_vehicle_records_personnel;
DROP INDEX IF EXISTS public.idx_vehicle_records_manager;
DROP INDEX IF EXISTS public.idx_vehicle_records_date;
DROP INDEX IF EXISTS public.idx_personnel_username;
DROP INDEX IF EXISTS public.idx_personnel_role;
DROP INDEX IF EXISTS public.idx_managers_records_status;
DROP INDEX IF EXISTS public.idx_managers_records_recorded_by_name;
DROP INDEX IF EXISTS public.idx_managers_records_recorded_by;
DROP INDEX IF EXISTS public.idx_managers_records_manager_name;
DROP INDEX IF EXISTS public.idx_managers_records_manager;
DROP INDEX IF EXISTS public.idx_managers_records_entry_date;
DROP INDEX IF EXISTS public.idx_managers_active;
DROP INDEX IF EXISTS public.idx_incidents_shift_label;
DROP INDEX IF EXISTS public.idx_incidents_severity;
DROP INDEX IF EXISTS public.idx_incidents_resolved;
DROP INDEX IF EXISTS public.idx_incidents_report_file_path;
DROP INDEX IF EXISTS public.idx_incidents_report_date;
DROP INDEX IF EXISTS public.idx_incidents_recorded_by;
DROP INDEX IF EXISTS public.idx_incidents_incident_type;
DROP INDEX IF EXISTS public.idx_incidents_incident_time;
DROP INDEX IF EXISTS public.idx_incidents_deleted_at;
DROP INDEX IF EXISTS public.idx_fire_alarms_resolved;
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
DROP TABLE IF EXISTS public.personnel;
DROP TABLE IF EXISTS public.managers_records;
DROP TABLE IF EXISTS public.managers;
DROP TABLE IF EXISTS public.incidents;
DROP TABLE IF EXISTS public.fire_alarms;
DROP TABLE IF EXISTS public.audit_log;
DROP FUNCTION IF EXISTS public.update_updated_at_column();
DROP FUNCTION IF EXISTS public.sync_manager_name();
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
-- Name: sync_manager_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_manager_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN IF NEW.manager_id IS NOT NULL AND NEW.manager_name IS NULL THEN SELECT first_name || ' ' || last_name INTO NEW.manager_name FROM managers WHERE id = NEW.manager_id; END IF; RETURN NEW; END; $$;


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
    alarm_number character varying(50)
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
-- Name: COLUMN fire_alarms.alarm_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fire_alarms.alarm_number IS 'Alarm panel number or identifier';


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
    recorded_by uuid NOT NULL,
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
    recorded_by_name character varying(200),
    CONSTRAINT managers_records_status_check CHECK (((status)::text = ANY ((ARRAY['inside'::character varying, 'exited'::character varying, 'active'::character varying, 'passive'::character varying])::text[])))
);


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
-- Name: vehicle_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid NOT NULL,
    manager_id uuid,
    personnel_id uuid NOT NULL,
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
    CONSTRAINT vehicle_records_status_check CHECK (((status)::text = ANY ((ARRAY['in_use'::character varying, 'returned'::character varying])::text[])))
);


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
    personnel_id uuid NOT NULL,
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
    CONSTRAINT visitor_records_person_count_check CHECK ((person_count > 0)),
    CONSTRAINT visitor_records_status_check CHECK (((status)::text = ANY ((ARRAY['inside'::character varying, 'exited'::character varying])::text[])))
);


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_log (id, table_name, record_id, action, old_values, new_values, changed_by, ip_address, user_agent, changed_at) FROM stdin;
0734dc58-b512-4319-ad4a-35b5f5198959	auth	f41dfe41-f041-4a6b-b2f9-1d1810938f30	FAILED_LOGIN	\N	{"success": false, "username": "admin", "timestamp": "2025-12-16T06:46:05.428Z"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 09:46:05.430219
e8f9ba2d-b8c0-4266-a396-d0dc27f6efb7	auth	f41dfe41-f041-4a6b-b2f9-1d1810938f30	LOGIN	\N	{"success": true, "username": "admin", "timestamp": "2025-12-16T06:46:08.802Z"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 09:46:08.803509
2af4bd99-ea93-4712-b63c-67b9351a2f18	auth	f41dfe41-f041-4a6b-b2f9-1d1810938f30	LOGIN	\N	{"success": true, "username": "admin", "timestamp": "2025-12-16T06:47:39.853Z"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 09:47:39.853818
92932486-be75-45f5-9b38-d57f12fe9ee1	vehicle_records	8f2f9ff6-694d-4e61-9b54-f034552f1447	INSERT	\N	{"manager_id": "4be00c7a-59d4-43a8-ad09-3c318323cfe5", "vehicle_id": "fd5c8b45-32c6-4d15-bb3a-5b877adb56cb", "destination": "fff", "personnel_id": "f41dfe41-f041-4a6b-b2f9-1d1810938f30"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 09:48:55.745386
a6cfdb93-0fc4-408b-95cc-633de03b4603	auth	f41dfe41-f041-4a6b-b2f9-1d1810938f30	LOGIN	\N	{"success": true, "username": "admin", "timestamp": "2025-12-16T06:59:21.782Z"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 09:59:21.784978
709da84e-00c0-4930-889f-fd7f6db3a7bf	incidents	f503d62e-e983-4a88-89b6-e5aca93a9927	INSERT	\N	{"report_type": "shift_report", "shift_label": "08:00-16:00"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 10:20:22.713163
aea6ef87-ed96-4a03-93b0-7e286558fbdf	auth	f41dfe41-f041-4a6b-b2f9-1d1810938f30	LOGIN	\N	{"success": true, "username": "admin", "timestamp": "2025-12-16T07:43:34.416Z"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 10:43:34.419093
9fb444dd-7b11-484b-94b1-b8dbee7bf664	auth	f41dfe41-f041-4a6b-b2f9-1d1810938f30	LOGIN	\N	{"success": true, "username": "admin", "timestamp": "2025-12-16T07:46:46.334Z"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 10:46:46.335969
e0aa91b6-e74e-49da-ae3f-4b9612cfce23	incidents	c18bc16f-1ebb-4c9a-82cd-0c1a6d64626b	INSERT	\N	{"file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_10-47-19_08-00-16-00.docx", "report_type": "shift_report", "shift_label": "08:00-16:00"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 10:47:19.468683
4514c86b-9961-46da-8c12-8381157e83d1	incidents	8fc92db6-8c60-4f37-a976-d5c50e8b1f55	INSERT	\N	{"file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_10-51-10_08-00-16-00.docx", "report_type": "shift_report", "shift_label": "08:00-16:00"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 10:51:10.209204
fc2cd4bf-67ef-432d-9b58-f938c0f820e6	incidents	2779166d-1fa4-40d0-81ae-f9ffd8d886a7	INSERT	\N	{"file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_10-52-17_08-00-16-00.docx", "report_type": "shift_report", "shift_label": "08:00-16:00"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 10:52:17.221425
3345b130-be60-4007-9e0b-6f0b773023d5	incidents	85e4151d-8f12-4da6-ba3b-71db81b0eab2	INSERT	\N	{"file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_10-53-54_08-00-16-00.docx", "report_type": "shift_report", "shift_label": "08:00-16:00"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 10:53:54.140771
d6d58967-37d4-4c3e-ae82-4512d1ee1cfe	vehicle_records	8f2f9ff6-694d-4e61-9b54-f034552f1447	UPDATE	{"status": "in_use"}	{"status": "returned", "return_date": "CURRENT_DATE"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 10:55:21.126235
5e7228ce-87a3-4301-af8d-03ae4299fd15	vehicle_records	a71394b9-e827-4848-ae3a-4da1ecd7b31d	UPDATE	{"status": "in_use"}	{"status": "returned", "return_date": "CURRENT_DATE"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 10:55:23.870106
5fa2898d-7cb6-41b7-aee7-3e89036483d3	vehicle_records	2a27cfaf-93df-40cd-b70f-343488e9013d	UPDATE	{"status": "in_use"}	{"status": "returned", "return_date": "CURRENT_DATE"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 10:56:40.586422
0c1a156c-8ab8-492b-aa8d-a50052e30b31	vehicle_records	b73f04ac-7f95-4d01-a666-bbd591ed79d5	UPDATE	{"status": "in_use"}	{"status": "returned", "return_date": "CURRENT_DATE"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 10:56:44.948106
997deb5c-bd6e-4b80-8c19-aeec2ce43985	vehicle_records	2cb2d2ca-d362-4531-82b3-0a0c23487fee	UPDATE	{"status": "in_use"}	{"status": "returned", "return_date": "CURRENT_DATE"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 10:56:47.29102
60f973b5-25b7-46d8-8483-1ddf8b4e236c	incidents	55c026d1-4a0e-4347-9114-8ff7c4e452cf	INSERT	\N	{"file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_11-04-21_08-00-16-00.docx", "report_type": "shift_report", "shift_label": "08:00-16:00"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:04:21.147375
debbbe88-6a69-444a-a8a7-a62713301b09	incidents	5e1fd492-cf93-4d36-b4e6-e5bce0508d15	INSERT	\N	{"file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_11-05-01_08-00-16-00.docx", "report_type": "shift_report", "shift_label": "08:00-16:00"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:05:01.261642
653c5612-a7f9-41ea-885e-03e366516b26	incidents	5e1fd492-cf93-4d36-b4e6-e5bce0508d15	UPDATE	{"shift_label": "08:00-16:00", "report_file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_11-05-01_08-00-16-00.docx"}	{"report_content": "&lt;p&gt;&lt;&#x2F;p&gt;", "report_file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_11-08-26_08-00-16-00.docx"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:08:26.36297
86b99d9b-9180-41f2-be24-515b4578cbb4	incidents	5e1fd492-cf93-4d36-b4e6-e5bce0508d15	UPDATE	{"shift_label": "08:00-16:00", "report_file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_11-08-26_08-00-16-00.docx"}	{"report_content": "&lt;p&gt;deneme1 2 3&lt;&#x2F;p&gt;", "report_file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_11-08-39_08-00-16-00.docx"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:08:39.166084
de0d75ad-d995-46e0-88b1-ab9256e3c9a2	incidents	5e1fd492-cf93-4d36-b4e6-e5bce0508d15	UPDATE	{"shift_label": "08:00-16:00", "report_file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_11-08-39_08-00-16-00.docx"}	{"report_content": "&lt;p&gt;&amp;lt;p&amp;gt;deneme1 2 3 aaaa&amp;lt;&#x2F;p&amp;gt;&lt;&#x2F;p&gt;", "report_file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_11-08-51_08-00-16-00.docx"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:08:51.10374
0038c4b3-88ee-4e02-9cc9-8625ba5584c8	incidents	5e1fd492-cf93-4d36-b4e6-e5bce0508d15	UPDATE	{"shift_label": "08:00-16:00", "report_file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_11-08-51_08-00-16-00.docx"}	{"report_content": "&lt;p&gt;deneme testi&lt;&#x2F;p&gt;&lt;p&gt;&lt;&#x2F;p&gt;", "report_file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_08-00-16-00.docx"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:11:31.788741
f2316cea-7e7d-4171-88e9-c42877ac5717	incidents	5e1fd492-cf93-4d36-b4e6-e5bce0508d15	UPDATE	{"shift_label": "08:00-16:00", "report_file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_08-00-16-00.docx"}	{"report_content": "&lt;p&gt;&amp;lt;p&amp;gt;deneme testi aaaaaaaaa&amp;lt;&#x2F;p&amp;gt;&amp;lt;p&amp;gt;&amp;lt;&#x2F;p&amp;gt;&lt;&#x2F;p&gt;", "report_file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_08-00-16-00.docx"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:11:41.737154
c7e88064-5cc2-491b-8e07-61f78191ccca	visitor_records	e0523a91-da26-4149-8290-0eac2f420162	INSERT	\N	{"full_name": "Adem Çelik", "company_name": null, "vehicle_plate": null}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 12:15:38.943284
8820f8cd-c846-486a-a9e0-bcc2640815d0	visitor_records	97969d30-ebe6-4c94-a7fb-bfefba2a04bf	INSERT	\N	{"full_name": "taşearon", "company_name": null, "vehicle_plate": null}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 12:17:00.492878
ebdf9aaa-17f2-4153-a98a-790b8d2c8697	incidents	5e1fd492-cf93-4d36-b4e6-e5bce0508d15	UPDATE	{"shift_label": "08:00-16:00", "report_file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_08-00-16-00.docx"}	{"report_content": "&lt;p&gt;&amp;lt;p&amp;gt;&amp;amp;lt;p&amp;amp;gt;deneme testi aaaaaaaaa bbbbbbbbbbbb&amp;amp;lt;&#x2F;p&amp;amp;gt;&amp;amp;lt;p&amp;amp;gt;&amp;amp;lt;&#x2F;p&amp;amp;gt;&amp;lt;&#x2F;p&amp;gt;&lt;&#x2F;p&gt;", "report_file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_08-00-16-00.docx"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:12:23.161473
de1639c0-17ee-45ff-bb3c-f3613d8b73ac	incidents	5e1fd492-cf93-4d36-b4e6-e5bce0508d15	UPDATE	{"shift_label": "08:00-16:00", "report_file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_08-00-16-00.docx"}	{"report_content": "&lt;p&gt;deneme&lt;&#x2F;p&gt;", "report_file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_08-00-16-00.docx"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:14:23.290127
9afd7ee7-7a43-475a-98d6-8b73bd5d39b8	incidents	5e1fd492-cf93-4d36-b4e6-e5bce0508d15	UPDATE	{"shift_label": "08:00-16:00", "report_file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_08-00-16-00.docx"}	{"report_content": "&lt;p&gt;Bugün ki düzenlemeleri yapalım&lt;&#x2F;p&gt;", "report_file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_08-00-16-00.docx"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:14:49.284432
210118a1-3f94-4145-83f8-6119d3d13245	auth	f41dfe41-f041-4a6b-b2f9-1d1810938f30	LOGIN	\N	{"success": true, "username": "admin", "timestamp": "2025-12-16T08:22:50.965Z"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:22:50.967312
67e865c3-c450-4724-8518-7a963a105d64	auth	f41dfe41-f041-4a6b-b2f9-1d1810938f30	LOGIN	\N	{"success": true, "username": "admin", "timestamp": "2025-12-16T08:24:54.738Z"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:24:54.740283
3d8fbff8-31cd-4870-810a-d219c7d9e8c2	auth	f41dfe41-f041-4a6b-b2f9-1d1810938f30	LOGIN	\N	{"success": true, "username": "admin", "timestamp": "2025-12-16T08:36:15.496Z"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:36:15.497429
725ef53d-2472-4adf-9483-26809ddadffe	fire_alarms	79819b96-b52f-4c59-9bd1-2f96f2b10c39	INSERT	\N	{"location": "Lobi Önü", "alarm_time": "2025-12-16T21:51:00", "alarm_number": "307"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:37:57.813795
fdbf90a1-a336-4bb7-8582-914b7aed3d2f	fire_alarms	79819b96-b52f-4c59-9bd1-2f96f2b10c39	UPDATE	{"id": "79819b96-b52f-4c59-9bd1-2f96f2b10c39", "location": "Lobi Önü", "resolved": false, "alarm_time": "2025-12-16T18:51:00.000Z", "created_at": "2025-12-16T08:37:57.809Z", "deleted_at": null, "updated_at": "2025-12-16T08:37:57.809Z", "false_alarm": false, "recorded_by": "f41dfe41-f041-4a6b-b2f9-1d1810938f30", "alarm_number": "307", "resolution_time": null, "resolution_notes": null}	{"resolved": true, "resolution_time": "2025-12-16T08:39:03.444Z", "resolution_notes": null}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:39:03.446056
791b5f2f-d14e-4a7a-9839-fbd1a4413192	fire_alarms	bb199fd7-1f43-4919-a0d0-3128b5fcdc42	INSERT	\N	{"location": "asd", "alarm_time": "2025-12-16T08:42:45.557Z", "alarm_number": "458"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:42:45.622169
94eb02d3-2383-4150-b109-7f491fe1008b	fire_alarms	bb199fd7-1f43-4919-a0d0-3128b5fcdc42	UPDATE	{"id": "bb199fd7-1f43-4919-a0d0-3128b5fcdc42", "location": "asd", "resolved": false, "alarm_time": "2025-12-16T08:42:45.557Z", "created_at": "2025-12-16T08:42:45.616Z", "deleted_at": null, "updated_at": "2025-12-16T08:42:45.616Z", "false_alarm": false, "recorded_by": "f41dfe41-f041-4a6b-b2f9-1d1810938f30", "alarm_number": "458", "resolution_time": null, "resolution_notes": null}	{"resolved": true, "resolution_time": "2025-12-16T08:42:52.846Z", "resolution_notes": null}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:42:52.846698
e127d021-c5e3-4881-84e7-7b3c597fc141	fire_alarms	0ec22cc1-50a3-4b06-b898-31874ff8d97d	INSERT	\N	{"location": "cc", "alarm_time": "2025-12-16T08:47:44.789Z", "alarm_number": "xxxxc"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:47:44.873648
2d551f02-840d-44f9-88c9-6342a5b78e8a	fire_alarms	0ec22cc1-50a3-4b06-b898-31874ff8d97d	UPDATE	{"id": "0ec22cc1-50a3-4b06-b898-31874ff8d97d", "location": "cc", "resolved": false, "alarm_time": "2025-12-16T08:47:44.789Z", "created_at": "2025-12-16T08:47:44.858Z", "deleted_at": null, "updated_at": "2025-12-16T08:47:44.858Z", "false_alarm": true, "recorded_by": "f41dfe41-f041-4a6b-b2f9-1d1810938f30", "alarm_number": "xxxxc", "resolution_time": null, "resolution_notes": null}	{"resolved": true, "resolution_time": "2025-12-16T08:47:51.092Z", "resolution_notes": null}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:47:51.093272
839612f8-36f4-434d-ade4-02ab44c12f7c	managers_records	b726b588-a873-49ed-b16d-505d16bc7e3d	INSERT	\N	{"manager_id": "4be00c7a-59d4-43a8-ad09-3c318323cfe5", "manager_name": "Ali Demir"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:51:51.264499
86be0def-b09d-4e80-9b64-b7d64157beb1	fire_alarms	61fee4b9-ec9e-4fea-8509-29f6843b5282	INSERT	\N	{"location": "rtr", "alarm_time": "2025-12-16T08:53:10.800Z", "alarm_number": null}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:53:10.815422
75a08237-1c55-4f3a-ae1e-ff17a78508b4	fire_alarms	61fee4b9-ec9e-4fea-8509-29f6843b5282	UPDATE	{"id": "61fee4b9-ec9e-4fea-8509-29f6843b5282", "location": "rtr", "resolved": false, "alarm_time": "2025-12-16T08:53:10.800Z", "created_at": "2025-12-16T08:53:10.802Z", "deleted_at": null, "updated_at": "2025-12-16T08:53:10.802Z", "false_alarm": false, "recorded_by": "f41dfe41-f041-4a6b-b2f9-1d1810938f30", "alarm_number": null, "resolution_time": null, "resolution_notes": null}	{"resolved": true, "resolution_time": "2025-12-16T08:53:15.971Z", "resolution_notes": null}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:53:15.97325
376ba569-9863-4f5c-97d1-15b04e5865b0	fire_alarms	f37b01fe-6166-4764-903b-3c8cfbd766fd	INSERT	\N	{"location": "lobi", "alarm_time": "2025-12-16T08:53:24.482Z", "alarm_number": null}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:53:24.49555
ba71fb8b-a76b-4788-bdbe-43d3f1b68f00	fire_alarms	f37b01fe-6166-4764-903b-3c8cfbd766fd	UPDATE	{"id": "f37b01fe-6166-4764-903b-3c8cfbd766fd", "location": "lobi", "resolved": false, "alarm_time": "2025-12-16T08:53:24.482Z", "created_at": "2025-12-16T08:53:24.483Z", "deleted_at": null, "updated_at": "2025-12-16T08:53:24.483Z", "false_alarm": false, "recorded_by": "f41dfe41-f041-4a6b-b2f9-1d1810938f30", "alarm_number": null, "resolution_time": null, "resolution_notes": null}	{"resolved": true, "resolution_time": "2025-12-16T08:53:34.639Z", "resolution_notes": null}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:53:34.641032
7d5becf6-26d2-40d8-8704-19bddaf77e06	managers_records	b726b588-a873-49ed-b16d-505d16bc7e3d	UPDATE	{"status": "inside"}	{"status": "exited"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:55:21.629818
e5236f6d-4fa5-49be-8a6f-01a7470229cb	managers_records	6bba0b2b-6083-4c47-b888-da8ed64fc7d5	INSERT	\N	{"manager_id": "75e72099-628f-4047-8686-7ca456718c86", "manager_name": "Ayşe Çelik"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:55:29.134105
b76446d7-b14c-41ec-be8c-72c99853327b	managers_records	6bba0b2b-6083-4c47-b888-da8ed64fc7d5	UPDATE	{"status": "inside"}	{"status": "exited"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:55:35.253476
3bac0d6a-cbbe-45fc-9efc-ee7223a1bdbb	managers_records	01944a7e-d4d3-4c08-9f3b-6a744e0c5bc1	INSERT	\N	{"manager_id": "ebff0c41-0322-4400-8844-af2c9e570392", "manager_name": "Fatma Şahin"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:55:49.012273
7a7868b6-c691-46fa-8784-946f8c150c22	managers_records	01944a7e-d4d3-4c08-9f3b-6a744e0c5bc1	UPDATE	{"status": "inside"}	{"status": "exited"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 11:55:51.424747
2952ac96-6847-40c5-9687-ebc3736391f6	visitor_records	7734af34-d6a6-439c-9101-30320afa38dd	INSERT	\N	{"full_name": "Furkan Çelik", "company_name": "Sadesa", "vehicle_plate": "45HD303"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 12:10:27.547093
e87e915b-032a-4ed9-ab0c-c3a8d1184598	visitor_records	9c607f33-c039-431e-8bf7-911d000941e7	INSERT	\N	{"full_name": "elektirk", "company_name": null, "vehicle_plate": null}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 12:17:06.002567
cf71ace1-48fa-45ca-8842-7b6ec2e1b812	visitor_records	37c73882-4997-4ed3-91ce-c50a69418ac7	INSERT	\N	{"full_name": null, "company_name": null, "vehicle_plate": "ADSAD"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 12:17:10.968137
5ffc1df1-9c7e-4f3f-ba1f-49b438f96542	visitor_records	f1763bfd-81dd-489c-b62f-7e286a8c711d	INSERT	\N	{"full_name": null, "company_name": null, "vehicle_plate": null}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 12:17:16.408286
54c03edb-7b58-49ee-812d-94245b93df51	visitor_records	f1763bfd-81dd-489c-b62f-7e286a8c711d	UPDATE	{"status": "inside"}	{"status": "exited"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 12:24:04.878412
d93e8536-0a67-4f07-a801-61c35d6ffe99	vehicle_records	f2fbcc92-77b4-4973-a275-740378b3b08c	INSERT	\N	{"manager_id": "75e72099-628f-4047-8686-7ca456718c86", "vehicle_id": "1bd828e4-ae66-40c3-a73d-3a71b878c8f2", "destination": "nn", "personnel_id": "f41dfe41-f041-4a6b-b2f9-1d1810938f30"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 12:27:23.658771
c8752c0e-d647-4448-9543-a62c96f6d4c6	vehicle_records	f2fbcc92-77b4-4973-a275-740378b3b08c	UPDATE	{"status": "in_use"}	{"status": "returned", "return_date": "CURRENT_DATE"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 12:29:36.370552
727859ac-50ea-4e4d-b387-eb7b96fe47c5	vehicle_records	5a1a569b-450e-4714-bbf5-056deaa3b4f0	INSERT	\N	{"manager_id": "ebff0c41-0322-4400-8844-af2c9e570392", "vehicle_id": "1bd828e4-ae66-40c3-a73d-3a71b878c8f2", "destination": "lojman", "personnel_id": "f41dfe41-f041-4a6b-b2f9-1d1810938f30"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 12:33:13.955828
1dcc9fec-0901-4970-a297-79223ae75bd9	vehicle_records	5a1a569b-450e-4714-bbf5-056deaa3b4f0	UPDATE	{"status": "in_use"}	{"status": "returned", "return_date": "CURRENT_DATE"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 12:34:15.228452
b9866c5e-9117-417f-b292-541404e4e2ed	auth	f41dfe41-f041-4a6b-b2f9-1d1810938f30	LOGOUT	\N	{"timestamp": "2025-12-16T09:34:39.987Z"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 12:34:39.988963
ed57dde0-c708-43d8-b219-77ddc1d31d57	auth	f41dfe41-f041-4a6b-b2f9-1d1810938f30	FAILED_LOGIN	\N	{"success": false, "username": "admin", "timestamp": "2025-12-16T09:34:51.552Z"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 12:34:51.553907
273fae0f-e4cc-4172-985d-1057f62cd23c	auth	f41dfe41-f041-4a6b-b2f9-1d1810938f30	LOGIN	\N	{"success": true, "username": "admin", "timestamp": "2025-12-16T09:34:56.498Z"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 12:34:56.499524
61ffdae5-025c-4af7-a4ff-59415345eaca	visitor_records	37c73882-4997-4ed3-91ce-c50a69418ac7	UPDATE	{"status": "inside"}	{"status": "exited"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 12:35:40.095113
ff7eee8d-60f6-4c15-bbaf-6dc5cffdd74c	incidents	5e1fd492-cf93-4d36-b4e6-e5bce0508d15	UPDATE	{"shift_label": "08:00-16:00", "report_file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_08-00-16-00.docx"}	{"report_content": "&lt;p&gt;&amp;lt;p&amp;gt;Bugün ki düzenlemeleri yapalım&amp;lt;&#x2F;p&amp;gt;fkkffkfkfkfk&lt;&#x2F;p&gt;", "report_file_path": "C:\\\\Users\\\\imfurkaann\\\\Documents\\\\projects\\\\security\\\\backend\\\\reports\\\\rapor_2025-12-16_08-00-16-00.docx"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 12:37:19.677296
6f478fdc-1dce-4c1d-b4b7-d7dc39767bf8	fire_alarms	341a1e69-1d42-4fb0-b180-e7d7f9d7fc25	INSERT	\N	{"location": "lobi", "alarm_time": "2025-12-16T14:00:00", "alarm_number": null}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 12:37:53.850688
6440573e-aa49-4046-92d7-f405871cee00	fire_alarms	341a1e69-1d42-4fb0-b180-e7d7f9d7fc25	UPDATE	{"id": "341a1e69-1d42-4fb0-b180-e7d7f9d7fc25", "location": "lobi", "resolved": false, "alarm_time": "2025-12-16T11:00:00.000Z", "created_at": "2025-12-16T09:37:53.835Z", "deleted_at": null, "updated_at": "2025-12-16T09:37:53.835Z", "false_alarm": false, "recorded_by": "f41dfe41-f041-4a6b-b2f9-1d1810938f30", "alarm_number": null, "resolution_time": null, "resolution_notes": null}	{"resolved": true, "resolution_time": "2025-12-16T09:38:17.040Z", "resolution_notes": null}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 12:38:17.041677
b2198066-7f57-4835-aa60-3a395cedfa99	visitor_records	9c607f33-c039-431e-8bf7-911d000941e7	UPDATE	{"status": "inside"}	{"status": "exited"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 14:37:37.67225
9fe03b99-dcdb-4f5d-aab9-dfe245fe9d22	visitor_records	97969d30-ebe6-4c94-a7fb-bfefba2a04bf	UPDATE	{"status": "inside"}	{"status": "exited"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 14:37:39.955108
e628fc6d-cb77-47cd-a294-79208895e9bd	visitor_records	e0523a91-da26-4149-8290-0eac2f420162	UPDATE	{"status": "inside"}	{"status": "exited"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 14:37:41.987599
97c57faf-b5bf-4c91-953d-7802c61089b7	visitor_records	7734af34-d6a6-439c-9101-30320afa38dd	UPDATE	{"status": "inside"}	{"status": "exited"}	f41dfe41-f041-4a6b-b2f9-1d1810938f30	::1	\N	2025-12-16 14:37:43.383187
\.


--
-- Data for Name: fire_alarms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fire_alarms (id, location, alarm_time, resolved, resolution_time, resolution_notes, false_alarm, recorded_by, created_at, updated_at, deleted_at, alarm_number) FROM stdin;
79819b96-b52f-4c59-9bd1-2f96f2b10c39	Lobi Önü	2025-12-16 21:51:00	t	2025-12-16 11:39:03.432458	\N	t	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-16 11:37:57.809123	2025-12-16 11:39:03.432458	\N	307
bb199fd7-1f43-4919-a0d0-3128b5fcdc42	asd	2025-12-16 11:42:45.557	t	2025-12-16 11:42:52.834582	\N	f	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-16 11:42:45.616756	2025-12-16 11:42:52.834582	\N	458
0ec22cc1-50a3-4b06-b898-31874ff8d97d	cc	2025-12-16 11:47:44.789	t	2025-12-16 11:47:51.081802	\N	f	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-16 11:47:44.858473	2025-12-16 11:47:51.081802	\N	xxxxc
61fee4b9-ec9e-4fea-8509-29f6843b5282	rtr	2025-12-16 11:53:10.8	t	2025-12-16 11:53:15.962148	\N	f	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-16 11:53:10.802125	2025-12-16 11:53:15.962148	\N	\N
f37b01fe-6166-4764-903b-3c8cfbd766fd	lobi	2025-12-16 11:53:24.482	t	2025-12-16 11:53:34.630119	\N	f	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-16 11:53:24.483888	2025-12-16 11:53:34.630119	\N	\N
341a1e69-1d42-4fb0-b180-e7d7f9d7fc25	lobi	2025-12-16 14:00:00	t	2025-12-16 12:38:17.02917	\N	t	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-16 12:37:53.83536	2025-12-16 12:38:17.02917	\N	\N
\.


--
-- Data for Name: incidents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.incidents (id, incident_type, severity, location, description, incident_time, resolved, resolution_notes, resolved_at, recorded_by, resolved_by, created_at, updated_at, deleted_at, shift_label, report_content, report_date, report_file_path) FROM stdin;
f503d62e-e983-4a88-89b6-e5aca93a9927	general	low	\N	Vardiya Raporu: 08:00-16:00	2025-12-16 10:20:22.693694	f	\N	\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	\N	2025-12-16 10:20:22.693694	2025-12-16 10:20:22.693694	\N	08:00-16:00	&lt;p&gt;rapor kaydet&lt;&#x2F;p&gt;	2025-12-16	\N
c18bc16f-1ebb-4c9a-82cd-0c1a6d64626b	general	low	\N	Vardiya Raporu: 08:00-16:00	2025-12-16 10:47:19.46188	f	\N	\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	\N	2025-12-16 10:47:19.46188	2025-12-16 10:47:19.46188	\N	08:00-16:00	&lt;p&gt;Bugünün Olayları şı şekilde gerkelşeçöfs &lt;&#x2F;p&gt;	2025-12-16	C:\\Users\\imfurkaann\\Documents\\projects\\security\\backend\\reports\\rapor_2025-12-16_10-47-19_08-00-16-00.docx
8fc92db6-8c60-4f37-a976-d5c50e8b1f55	general	low	\N	Vardiya Raporu: 08:00-16:00	2025-12-16 10:51:10.204981	f	\N	\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	\N	2025-12-16 10:51:10.204981	2025-12-16 10:51:10.204981	\N	08:00-16:00	&lt;p&gt;test raporunu yazıyorum&lt;&#x2F;p&gt;	2025-12-16	C:\\Users\\imfurkaann\\Documents\\projects\\security\\backend\\reports\\rapor_2025-12-16_10-51-10_08-00-16-00.docx
2779166d-1fa4-40d0-81ae-f9ffd8d886a7	general	low	\N	Vardiya Raporu: 08:00-16:00	2025-12-16 10:52:17.218012	f	\N	\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	\N	2025-12-16 10:52:17.218012	2025-12-16 10:52:17.218012	\N	08:00-16:00	&lt;p&gt;Rapor içeriğini buraya yazın...&lt;&#x2F;p&gt;	2025-12-16	C:\\Users\\imfurkaann\\Documents\\projects\\security\\backend\\reports\\rapor_2025-12-16_10-52-17_08-00-16-00.docx
85e4151d-8f12-4da6-ba3b-71db81b0eab2	general	low	\N	Vardiya Raporu: 08:00-16:00	2025-12-16 10:53:54.135239	f	\N	\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	\N	2025-12-16 10:53:54.135239	2025-12-16 10:53:54.135239	\N	08:00-16:00	&lt;p&gt;Rapor içeriğini buraya yazın...&lt;&#x2F;p&gt;	2025-12-16	C:\\Users\\imfurkaann\\Documents\\projects\\security\\backend\\reports\\rapor_2025-12-16_10-53-54_08-00-16-00.docx
55c026d1-4a0e-4347-9114-8ff7c4e452cf	general	low	\N	Vardiya Raporu: 08:00-16:00	2025-12-16 11:04:21.134206	f	\N	\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	\N	2025-12-16 11:04:21.134206	2025-12-16 11:04:21.134206	\N	08:00-16:00	&lt;p&gt;yangın alarmı çaldı, gasdad&lt;&#x2F;p&gt;	2025-12-16	C:\\Users\\imfurkaann\\Documents\\projects\\security\\backend\\reports\\rapor_2025-12-16_11-04-21_08-00-16-00.docx
5e1fd492-cf93-4d36-b4e6-e5bce0508d15	general	low	\N	Vardiya Raporu: 08:00-16:00	2025-12-16 11:05:01.258683	f	\N	\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	\N	2025-12-16 11:05:01.258683	2025-12-16 12:37:19.661797	\N	08:00-16:00	&lt;p&gt;&amp;lt;p&amp;gt;Bugün ki düzenlemeleri yapalım&amp;lt;&#x2F;p&amp;gt;fkkffkfkfkfk&lt;&#x2F;p&gt;	2025-12-16	C:\\Users\\imfurkaann\\Documents\\projects\\security\\backend\\reports\\rapor_2025-12-16_08-00-16-00.docx
\.


--
-- Data for Name: managers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.managers (id, first_name, last_name, title, is_active, created_at, updated_at, deleted_at) FROM stdin;
988cdcf6-e8d6-4528-b31d-7cf99ca2acd5	Özder	Özdemir	Kalite Müdürü	t	2025-12-16 15:08:55.973323	2025-12-16 15:08:55.973323	\N
9709accb-66f3-40f1-8660-9384cf490805	Taşkın	Aydoğdu	Genel Müdür Yardımcısı	t	2025-12-16 15:08:55.973323	2025-12-16 15:08:55.973323	\N
26ff5729-4e7e-4aa5-8f1f-b3cfbbc9c027	Mennan	Gencer	Satınalma Müdürü	t	2025-12-16 15:08:55.973323	2025-12-16 15:08:55.973323	\N
c691464f-1e5c-4389-b6df-cbde13cba475	Abdullah	Özbulut	HK Müdürü	t	2025-12-16 15:08:55.973323	2025-12-16 15:08:55.973323	\N
ecec250d-2a12-4094-889f-1f797bdd0684	Berna	Sever	Satış ve Pazarlama Müdürü	t	2025-12-16 15:08:55.973323	2025-12-16 15:08:55.973323	\N
f6fe96a5-096d-4e67-9b9e-218523841590	Mustafa	Gülbudak	Animasyon Müdürü	t	2025-12-16 15:08:55.973323	2025-12-16 15:08:55.973323	\N
ef1610ab-a34b-4419-9c1c-36998ae0e759	Savaş	Gülcan	Aşçıbaşı	t	2025-12-16 15:08:55.973323	2025-12-16 15:08:55.973323	\N
c9c1b4a8-e690-4ef3-8703-c1573e36a6c5	Funda	Solmaz	Muhasebe Müdürü	t	2025-12-16 15:08:55.973323	2025-12-16 15:08:55.973323	\N
33c0b345-6d04-4876-9bf2-d57fcc721b53	Erkan	Ünlü	Teknik Müdürü	t	2025-12-16 15:08:55.973323	2025-12-16 15:08:55.973323	\N
376fc775-68db-47d6-ab24-e4e508a57b0f	Ali	Uyanık	Gece Müdürü	t	2025-12-16 15:08:55.973323	2025-12-16 15:08:55.973323	\N
021c773f-1677-41a3-ae12-0f50b69a42fe	Adem	Çelik	Güvenlik Müdürü	t	2025-12-16 15:08:55.973323	2025-12-16 15:08:55.973323	\N
49c30d9d-fce8-4c59-ab7a-8df3c35b7912	Funda	Şen	İnsan Kaynakları Müdürü	t	2025-12-16 15:08:55.973323	2025-12-16 15:08:55.973323	\N
d8a05c06-da74-4f4c-b044-cf29bc957901	Sinan	Mesut	Önbüro Müdürü	t	2025-12-16 15:08:55.973323	2025-12-16 15:08:55.973323	\N
\.


--
-- Data for Name: managers_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.managers_records (id, manager_id, recorded_by, entry_date, entry_time, exit_date, exit_time, status, notes, created_at, updated_at, deleted_at, manager_name, recorded_by_name) FROM stdin;
\.


--
-- Data for Name: personnel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.personnel (id, first_name, last_name, username, password, role, is_active, created_at, updated_at, deleted_at) FROM stdin;
3a4e8487-ca90-4a87-9bdd-67fd71665cab	Ahmet	YÄ±lmaz	personel1	$2a$10$L0xaXJX1SAdJgxZtqe8j0er1U9qQgk/7rQjOIbodTZLWCD.WpAzBi	personnel	t	2025-12-09 11:35:17.956664	2025-12-09 11:35:17.956664	\N
84cdb353-dbe8-4284-87d7-c582066d09aa	Mehmet	Kaya	personel2	$2a$10$L0xaXJX1SAdJgxZtqe8j0er1U9qQgk/7rQjOIbodTZLWCD.WpAzBi	personnel	t	2025-12-09 11:35:17.956664	2025-12-09 11:35:17.956664	\N
f41dfe41-f041-4a6b-b2f9-1d1810938f30	Adem	Çelik	admin	$2a$10$L0xaXJX1SAdJgxZtqe8j0er1U9qQgk/7rQjOIbodTZLWCD.WpAzBi	admin	t	2025-12-09 11:35:17.953471	2025-12-11 17:55:14.261698	\N
\.


--
-- Data for Name: vehicle_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vehicle_records (id, vehicle_id, manager_id, personnel_id, given_date, given_time, return_date, return_time, status, notes, created_at, updated_at, deleted_at, destination, manager_name) FROM stdin;
4e01c468-10e2-4700-9094-6f2bbe2ffc7c	1bd828e4-ae66-40c3-a73d-3a71b878c8f2	\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-09	15:36:39.767987	2025-12-09	15:37:06.939331	returned	deneme	2025-12-09 15:36:39.767987	2025-12-09 15:37:06.939331	\N	kemer	Furkan Çelik
e292a708-7eeb-4963-af12-53f26fd5099b	fc255de4-515a-4751-afe5-413fc20d285b	\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-09	15:43:03.019877	2025-12-09	15:43:06.653022	returned	\N	2025-12-09 15:43:03.019877	2025-12-09 15:43:06.653022	\N	gg	ggggggg
47be5615-815a-41a1-88a1-2dd077bede5f	fc255de4-515a-4751-afe5-413fc20d285b	\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-11	17:39:44.099161	2025-12-11	17:39:58.022361	returned	\N	2025-12-11 17:39:44.099161	2025-12-11 17:39:58.022361	\N	dd	dd
\.


--
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vehicles (id, brand, plate, status, is_active, created_at, updated_at, deleted_at) FROM stdin;
fd5c8b45-32c6-4d15-bb3a-5b877adb56cb	VW Transporter	06 CC 3333	available	t	2025-12-09 11:35:17.961317	2025-12-16 10:55:21.096066	\N
fc255de4-515a-4751-afe5-413fc20d285b	Audi A6	06 EE 5555	available	t	2025-12-09 11:35:17.961317	2025-12-16 10:55:23.855042	\N
dd8e644f-d851-45f6-8898-75bb327e22f7	Mercedes-Benz Vito	06 DD 4444	available	t	2025-12-09 11:35:17.961317	2025-12-16 10:56:40.562619	\N
22c4552c-944e-4f4c-9d9b-fe5a07b15ce0	Mercedes-Benz E200	06 AA 1111	available	t	2025-12-09 11:35:17.961317	2025-12-16 10:56:47.285982	\N
1bd828e4-ae66-40c3-a73d-3a71b878c8f2	BMW X5	06 BB 2222	available	t	2025-12-09 11:35:17.961317	2025-12-16 12:34:15.210002	\N
\.


--
-- Data for Name: visitor_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.visitor_records (id, vehicle_plate, full_name, company_name, visiting_person, person_count, phone, notes, personnel_id, entry_date, entry_time, exit_date, exit_time, status, created_at, updated_at, deleted_at, subcontractor_worker, for_electric_station) FROM stdin;
9caecf5a-7fe9-4b54-9ef6-b79d4bc2e0d7	ASDASD	asdasd	qasdasd	sadasd	1	bababa	\N	3a4e8487-ca90-4a87-9bdd-67fd71665cab	2025-12-11	11:22:35.844888	2025-12-11	11:22:44.574717	exited	2025-12-11 11:22:35.844888	2025-12-11 11:22:51.980121	\N	f	f
08e8d078-9667-4a91-9d9a-bd5529fd751f	JJ	aaa	jj	jj	1	jk	jj	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-11	12:01:53.63009	2025-12-11	12:04:18.112814	exited	2025-12-11 12:01:53.63009	2025-12-11 12:04:18.112814	\N	f	f
16761953-2a90-45cd-a0f7-a4d9411a6218	34 ABC 48	Furkan 	Dosinia	Adem Çelik	1	0506 162 23 22	iş içim\n	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-11	11:58:36.929819	2025-12-11	12:04:29.896319	exited	2025-12-11 11:58:36.929819	2025-12-11 12:04:29.896319	\N	f	f
72e7917b-dafb-4abe-98fe-1761547e9d02		furkan çelik			1		\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-11	12:26:37.642083	2025-12-11	12:27:00.546396	exited	2025-12-11 12:26:37.642083	2025-12-11 12:27:00.546396	\N	f	f
6e9f7807-7fa9-4889-b8cb-ab36bdbceafe	AA	Furkan Çelik	aa	aaaaa	1	aa	\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-11	12:20:31.013471	2025-12-11	12:27:06.607161	exited	2025-12-11 12:20:31.013471	2025-12-11 12:27:06.607161	\N	f	f
84d46cf7-1168-4fdb-be63-25801859ba4d	47 FDG 58	Furkan Çelik	deneme	Adem Çelik	1	0506 162 23 22	test\n	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-11	12:28:30.898295	2025-12-11	12:29:13.255615	exited	2025-12-11 12:28:30.898295	2025-12-11 12:29:13.255615	\N	f	f
7f7f94a7-ba07-4d65-82b1-813cb6cb8006		 nn			1		\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-11	12:27:56.032428	2025-12-11	12:29:17.007688	exited	2025-12-11 12:27:56.032428	2025-12-11 12:29:17.007688	\N	f	f
86963e3e-603a-4a04-9d66-4235aca4aa89		adsşlmsklfnklfklf			1		\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-11	13:41:56.242848	2025-12-11	13:42:14.837968	exited	2025-12-11 13:41:56.242848	2025-12-11 13:42:14.837968	\N	f	f
e224ab9f-7e0b-4760-aaa5-b8fc64d25087				dgf	1		\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-11	13:27:05.947284	2025-12-11	13:55:17.302122	exited	2025-12-11 13:27:05.947284	2025-12-11 13:55:17.302122	\N	f	f
b411415f-e585-4085-9b96-d5fe8cae4c6e	DFG				1		\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-11	13:27:00.56906	2025-12-11	13:55:19.654573	exited	2025-12-11 13:27:00.56906	2025-12-11 13:55:19.654573	\N	f	f
e6dcccab-3190-480b-a026-9cd57424c611		dgdfg			1		\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-11	13:27:03.112976	2025-12-11	13:55:22.619046	exited	2025-12-11 13:27:03.112976	2025-12-11 13:55:22.619046	\N	f	f
ff9df5dd-38e9-443b-82ab-a995af087da5		aa			1		\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-11	13:11:50.861566	2025-12-11	17:41:14.123834	exited	2025-12-11 13:11:50.861566	2025-12-11 17:41:14.123834	\N	f	f
1b1d17ff-6d96-454a-bcd6-fa56611dfb02		furkan çelik			1		\N	3a4e8487-ca90-4a87-9bdd-67fd71665cab	2025-12-12	09:57:13.356228	2025-12-12	09:57:58.511583	exited	2025-12-12 09:57:13.356228	2025-12-12 09:57:58.511583	\N	f	t
4ee2d562-0f2b-4753-a9c5-d65c8c1120e2		furkan			1		\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-16	08:21:03.522365	2025-12-16	08:21:16.938919	exited	2025-12-16 08:21:03.522365	2025-12-16 08:21:16.938919	\N	f	f
f1763bfd-81dd-489c-b62f-7e286a8c711d	\N	\N	\N	ss	1	\N	\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-16	12:17:16.394307	2025-12-16	12:24:04.860846	exited	2025-12-16 12:17:16.394307	2025-12-16 12:24:04.860846	\N	f	t
37c73882-4997-4ed3-91ce-c50a69418ac7	ADSAD	\N	\N	\N	1	\N	\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-16	12:17:10.956138	2025-12-16	12:35:40.091051	exited	2025-12-16 12:17:10.956138	2025-12-16 12:35:40.091051	\N	t	f
9c607f33-c039-431e-8bf7-911d000941e7	\N	elektirk	\N	\N	1	\N	\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-16	12:17:05.988579	2025-12-16	14:37:37.656647	exited	2025-12-16 12:17:05.988579	2025-12-16 14:37:37.656647	\N	f	t
97969d30-ebe6-4c94-a7fb-bfefba2a04bf	\N	taşearon	\N	\N	1	\N	\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-16	12:17:00.490405	2025-12-16	14:37:39.943155	exited	2025-12-16 12:17:00.490405	2025-12-16 14:37:39.943155	\N	t	f
e0523a91-da26-4149-8290-0eac2f420162	\N	Adem Çelik	\N	\N	1	\N	\N	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-16	12:15:38.929313	2025-12-16	14:37:41.976432	exited	2025-12-16 12:15:38.929313	2025-12-16 14:37:41.976432	\N	f	f
7734af34-d6a6-439c-9101-30320afa38dd	45HD303	Furkan Çelik	Sadesa	Adem Çelik	1	05053370029	Not	f41dfe41-f041-4a6b-b2f9-1d1810938f30	2025-12-16	12:10:27.540451	2025-12-16	14:37:43.370953	exited	2025-12-16 12:10:27.540451	2025-12-16 14:37:43.370953	\N	f	f
\.


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
-- Name: idx_fire_alarms_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fire_alarms_resolved ON public.fire_alarms USING btree (resolved) WHERE (deleted_at IS NULL);


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
-- Name: idx_managers_records_entry_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managers_records_entry_date ON public.managers_records USING btree (entry_date) WHERE (deleted_at IS NULL);


--
-- Name: idx_managers_records_manager; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managers_records_manager ON public.managers_records USING btree (manager_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_managers_records_manager_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managers_records_manager_name ON public.managers_records USING btree (manager_name) WHERE (deleted_at IS NULL);


--
-- Name: idx_managers_records_recorded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managers_records_recorded_by ON public.managers_records USING btree (recorded_by) WHERE (deleted_at IS NULL);


--
-- Name: idx_managers_records_recorded_by_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managers_records_recorded_by_name ON public.managers_records USING btree (recorded_by_name);


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
-- Name: idx_vehicle_records_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_records_date ON public.vehicle_records USING btree (given_date) WHERE (deleted_at IS NULL);


--
-- Name: idx_vehicle_records_manager; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_records_manager ON public.vehicle_records USING btree (manager_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_vehicle_records_personnel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicle_records_personnel ON public.vehicle_records USING btree (personnel_id) WHERE (deleted_at IS NULL);


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
-- Name: idx_visitor_records_personnel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_personnel ON public.visitor_records USING btree (personnel_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_visitor_records_plate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_plate ON public.visitor_records USING btree (vehicle_plate) WHERE (deleted_at IS NULL);


--
-- Name: idx_visitor_records_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_records_status ON public.visitor_records USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: vehicle_records trigger_sync_manager_name; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_manager_name BEFORE INSERT OR UPDATE ON public.vehicle_records FOR EACH ROW EXECUTE FUNCTION public.sync_manager_name();


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
-- Name: managers_records managers_records_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.managers_records
    ADD CONSTRAINT managers_records_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.managers(id) ON DELETE CASCADE;


--
-- Name: managers_records managers_records_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.managers_records
    ADD CONSTRAINT managers_records_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.personnel(id) ON DELETE SET NULL;


--
-- Name: vehicle_records vehicle_records_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_records
    ADD CONSTRAINT vehicle_records_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.managers(id) ON DELETE CASCADE;


--
-- Name: vehicle_records vehicle_records_personnel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_records
    ADD CONSTRAINT vehicle_records_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- Name: vehicle_records vehicle_records_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_records
    ADD CONSTRAINT vehicle_records_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: visitor_records visitor_records_personnel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_records
    ADD CONSTRAINT visitor_records_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

