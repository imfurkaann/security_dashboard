--
-- PostgreSQL database dump
--

-- Dumped from database version 17.2
-- Dumped by pg_dump version 17.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

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
    send_whatsapp boolean DEFAULT false,
    CONSTRAINT visitor_records_person_count_check CHECK ((person_count > 0)),
    CONSTRAINT visitor_records_status_check CHECK (((status)::text = ANY ((ARRAY['inside'::character varying, 'exited'::character varying])::text[])))
);


--
-- Name: COLUMN visitor_records.send_whatsapp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.visitor_records.send_whatsapp IS 'WhatsApp grubuna bildirim gönderilsin mi?';


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_log (id, table_name, record_id, action, old_values, new_values, changed_by, ip_address, user_agent, changed_at) FROM stdin;
\.


--
-- Data for Name: fire_alarms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fire_alarms (id, location, alarm_time, resolved, resolution_time, resolution_notes, false_alarm, recorded_by, created_at, updated_at, deleted_at, alarm_number) FROM stdin;
\.


--
-- Data for Name: incidents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.incidents (id, incident_type, severity, location, description, incident_time, resolved, resolution_notes, resolved_at, recorded_by, resolved_by, created_at, updated_at, deleted_at, shift_label, report_content, report_date, report_file_path) FROM stdin;
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
7fefebfd-ef8d-4f05-89f8-7fe22f40d52b	Raziye	Toraman	raziye.toraman	$2a$10$V1oUHKcWe8wbW.gFaepGoO.4w1yNmofAGaIKEd7MUUlaK1TECoQkm	personnel	t	2025-12-16 18:36:49.418131	2025-12-16 18:36:49.418131	\N
1cec7a33-4764-432c-9480-7285965e5f78	Ferhat	Kurt	ferhat.kurt	$2a$10$QCMbOY9hT9y2rzamcr.exOSxDlft0r5VJHvJQ7Ql6A6p6ZnDhAsUq	personnel	t	2025-12-16 18:36:49.422515	2025-12-16 18:36:49.422515	\N
5d4eb90c-03cd-4034-9be9-d2504f09ff6c	Ahmet	Akgül	ahmet.akgul	$2a$10$zh1znM2WdH0ReljSkYMKpeJ.K3GmTkOdPs5Y6/SeL3iYnV1/zJGAO	personnel	t	2025-12-16 18:36:49.423253	2025-12-16 18:36:49.423253	\N
64619a78-594a-446b-8e39-4958d9484163	Mustan	Bozdağ	mustan.bozdag	$2a$10$sCBlZbIU3vSGdH518VABS.BAsNyzaRUBMYBI1261f9WAOPHaYeDxC	personnel	t	2025-12-16 18:36:49.42404	2025-12-16 18:36:49.42404	\N
35446e4b-d11a-425d-9d76-f4d93a6336fe	Hatice	Öztürk	hatice.ozturk	$2a$10$1HSz20x5hub6MiL8c.Wkce3hm60LppBiTmgOX9UCWAyVvl/e7/.Dy	personnel	t	2025-12-16 18:36:49.424612	2025-12-16 18:36:49.424612	\N
c2eb0d05-93e8-4e3a-97f4-3541cebdf61e	Furkan	Çelik	furkan.celik	$2a$10$6G9dEDveMb.xRH5aDBDCx.oyc0VgtNe5y4CFPgjfT6T7q8Eow8uSa	personnel	t	2025-12-16 18:36:49.425124	2025-12-16 18:36:49.425124	\N
072c24fd-f4fc-40f9-b25d-93aab3edea56	Hanifi	Çelik	hanifi.celik	$2a$10$svGRZ8U.qRZ/J09hM40TJOu1uoLtSNZJXEaM2XWn8iiGbMivIImaq	personnel	t	2025-12-16 18:36:49.425664	2025-12-16 18:36:49.425664	\N
938b9c36-b187-4481-8cef-9890ba00b0f9	İsmail	Aksoy	ismail.aksoy	$2a$10$SJalr4jRVrztmS.CninW7uyLx.jxrf5QxSm.QkE7j04Qnrrumb78G	personnel	t	2025-12-16 18:36:49.426196	2025-12-16 18:36:49.426196	\N
5fd7f6d8-e6bb-4e33-8f03-d062a96cf55d	Umut	Hıncal	umut.hincal	$2a$10$qrLK9vsDUz.cLYi8ueResOhL9gFKmqcRaJLaVtcGoufP7X0HHT8QC	personnel	t	2025-12-16 18:36:49.426666	2025-12-16 18:36:49.426666	\N
372a1bb5-c71f-4199-bfab-13e602964243	Adem	Çelik	adem.celik	$2a$10$dbweBKNsLvJGLCs.wTK2L.b99WfX.TvZrUUiE3rWI/IawXpyU3FNi	admin	t	2025-12-16 18:36:49.427133	2025-12-16 18:36:49.427133	\N
\.


--
-- Data for Name: vehicle_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vehicle_records (id, vehicle_id, manager_id, personnel_id, given_date, given_time, return_date, return_time, status, notes, created_at, updated_at, deleted_at, destination, manager_name) FROM stdin;
\.


--
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vehicles (id, brand, plate, status, is_active, created_at, updated_at, deleted_at) FROM stdin;
24381b26-2db2-45b9-abba-9ace5ee99d29	Otokar Atlas	07BEE763	available	t	2025-12-16 18:36:49.427817	2025-12-16 18:36:49.427817	\N
38a6939e-6e08-48ce-9066-4ac6e0021818	Ford Transit	07AEN693	available	t	2025-12-16 18:36:49.43085	2025-12-16 18:36:49.43085	\N
7aff358c-7e15-4ab0-8e88-175e9d8b8b43	Fiat Doblo	07ABJ290	available	t	2025-12-16 18:36:49.431586	2025-12-16 18:36:49.431586	\N
8b038c93-3084-4540-8991-1e00a1994d9b	Opel Vivaro	07CCU63	available	t	2025-12-16 18:36:49.432213	2025-12-16 18:36:49.432213	\N
\.


--
-- Data for Name: visitor_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.visitor_records (id, vehicle_plate, full_name, company_name, visiting_person, person_count, phone, notes, personnel_id, entry_date, entry_time, exit_date, exit_time, status, created_at, updated_at, deleted_at, subcontractor_worker, for_electric_station, send_whatsapp) FROM stdin;
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

