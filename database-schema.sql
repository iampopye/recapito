--
-- PostgreSQL database dump
--

\restrict l5bDPQWsEi0xcb2wFquejwb3fdXPEHkCIVj2pkaVyhcTFFLD30ZwlpqhnDHgpzW

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid,
    draft_id uuid,
    filename character varying(500) NOT NULL,
    content_type character varying(200) NOT NULL,
    size integer NOT NULL,
    storage_path character varying(1000) NOT NULL,
    content_id character varying(500),
    is_inline boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255),
    company character varying(255),
    phone character varying(50),
    notes text,
    avatar_url character varying(500),
    is_favorite boolean DEFAULT false NOT NULL,
    last_contacted_at timestamp without time zone,
    contact_count integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mailbox_id uuid NOT NULL,
    thread_id uuid,
    in_reply_to character varying(500),
    to_addresses text[] DEFAULT '{}'::text[] NOT NULL,
    cc_addresses text[] DEFAULT '{}'::text[] NOT NULL,
    bcc_addresses text[] DEFAULT '{}'::text[] NOT NULL,
    subject character varying(500) DEFAULT ''::character varying NOT NULL,
    body_text text,
    body_html text,
    scheduled_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.labels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    color character varying(20) DEFAULT '#3B82F6'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: mailboxes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mailboxes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    email character varying NOT NULL,
    imap_host character varying NOT NULL,
    imap_port integer NOT NULL,
    imap_ssl boolean DEFAULT true NOT NULL,
    imap_username character varying NOT NULL,
    imap_password character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_sync_at timestamp without time zone,
    last_uid integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    smtp_provider_id uuid
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    thread_id uuid NOT NULL,
    mailbox_id uuid NOT NULL,
    message_id character varying NOT NULL,
    in_reply_to character varying,
    direction character varying(20) NOT NULL,
    from_address character varying NOT NULL,
    from_name character varying,
    to_addresses text[] NOT NULL,
    cc_addresses text[] DEFAULT '{}'::text[] NOT NULL,
    subject character varying NOT NULL,
    body_text text,
    body_html text,
    received_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: outbound_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbound_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    message_id uuid NOT NULL,
    mailgun_id character varying,
    status character varying(20) DEFAULT 'queued'::character varying NOT NULL,
    status_details text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key character varying NOT NULL,
    value text NOT NULL,
    description character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    content text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: smtp_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.smtp_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name character varying NOT NULL,
    type character varying DEFAULT 'mailgun'::character varying NOT NULL,
    from_email character varying NOT NULL,
    from_name character varying,
    mailgun_api_key character varying,
    mailgun_domain character varying,
    mailgun_base_url character varying DEFAULT 'https://api.mailgun.net'::character varying,
    brevo_api_key character varying,
    smtp_host character varying,
    smtp_port integer,
    smtp_secure boolean DEFAULT true NOT NULL,
    smtp_username character varying,
    smtp_password character varying,
    is_active boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    subject character varying(500),
    body_text text,
    body_html text,
    shortcut character varying(50) DEFAULT ''::character varying NOT NULL,
    use_count integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: thread_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thread_labels (
    thread_id uuid NOT NULL,
    label_id uuid NOT NULL
);


--
-- Name: threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.threads (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    mailbox_id uuid NOT NULL,
    subject character varying NOT NULL,
    participants text[] DEFAULT '{}'::text[] NOT NULL,
    last_message_at timestamp without time zone NOT NULL,
    message_count integer DEFAULT 0 NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    folder character varying(20) DEFAULT 'inbox'::character varying NOT NULL,
    is_starred boolean DEFAULT false NOT NULL,
    priority character varying(10) DEFAULT 'normal'::character varying NOT NULL,
    snoozed_until timestamp without time zone
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying NOT NULL,
    name character varying NOT NULL,
    "passwordHash" character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    is_admin boolean DEFAULT false NOT NULL
);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- Name: mailboxes PK_mailboxes; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailboxes
    ADD CONSTRAINT "PK_mailboxes" PRIMARY KEY (id);


--
-- Name: messages PK_messages; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT "PK_messages" PRIMARY KEY (id);


--
-- Name: outbound_logs PK_outbound_logs; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbound_logs
    ADD CONSTRAINT "PK_outbound_logs" PRIMARY KEY (id);


--
-- Name: threads PK_threads; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT "PK_threads" PRIMARY KEY (id);


--
-- Name: users PK_users; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_users" PRIMARY KEY (id);


--
-- Name: outbound_logs UQ_c093f3e40bbae1d28dbddb24b92; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbound_logs
    ADD CONSTRAINT "UQ_c093f3e40bbae1d28dbddb24b92" UNIQUE (message_id);


--
-- Name: messages UQ_messages_message_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT "UQ_messages_message_id" UNIQUE (message_id);


--
-- Name: users UQ_users_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_users_email" UNIQUE (email);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_user_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_user_id_email_key UNIQUE (user_id, email);


--
-- Name: drafts drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drafts
    ADD CONSTRAINT drafts_pkey PRIMARY KEY (id);


--
-- Name: labels labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_pkey PRIMARY KEY (id);


--
-- Name: settings settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_key_key UNIQUE (key);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: signatures signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signatures
    ADD CONSTRAINT signatures_pkey PRIMARY KEY (id);


--
-- Name: smtp_providers smtp_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smtp_providers
    ADD CONSTRAINT smtp_providers_pkey PRIMARY KEY (id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: thread_labels thread_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_labels
    ADD CONSTRAINT thread_labels_pkey PRIMARY KEY (thread_id, label_id);


--
-- Name: IDX_attachments_draft; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_attachments_draft" ON public.attachments USING btree (draft_id);


--
-- Name: IDX_attachments_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_attachments_message" ON public.attachments USING btree (message_id);


--
-- Name: IDX_contacts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_contacts_email" ON public.contacts USING btree (user_id, email);


--
-- Name: IDX_contacts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_contacts_user" ON public.contacts USING btree (user_id);


--
-- Name: IDX_drafts_mailbox; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_drafts_mailbox" ON public.drafts USING btree (mailbox_id);


--
-- Name: IDX_drafts_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_drafts_scheduled" ON public.drafts USING btree (scheduled_at) WHERE (scheduled_at IS NOT NULL);


--
-- Name: IDX_labels_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_labels_user" ON public.labels USING btree (user_id);


--
-- Name: IDX_templates_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_templates_user" ON public.templates USING btree (user_id);


--
-- Name: IDX_threads_mailbox_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_threads_mailbox_folder" ON public.threads USING btree (mailbox_id, folder);


--
-- Name: IDX_threads_mailbox_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_threads_mailbox_subject" ON public.threads USING btree (mailbox_id, subject);


--
-- Name: IDX_threads_snoozed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_threads_snoozed" ON public.threads USING btree (snoozed_until) WHERE (snoozed_until IS NOT NULL);


--
-- Name: idx_threads_mailbox_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_mailbox_folder ON public.threads USING btree (mailbox_id, folder);


--
-- Name: idx_threads_mailbox_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_mailbox_subject ON public.threads USING btree (mailbox_id, subject);


--
-- Name: smtp_providers FK_843bae7c46996d4c4910e9a70a3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smtp_providers
    ADD CONSTRAINT "FK_843bae7c46996d4c4910e9a70a3" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages FK_ba93901e8118b25e339a9d7c295; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT "FK_ba93901e8118b25e339a9d7c295" FOREIGN KEY (mailbox_id) REFERENCES public.mailboxes(id) ON DELETE CASCADE;


--
-- Name: messages FK_bb3af7f695d50083e6523290d41; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT "FK_bb3af7f695d50083e6523290d41" FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: outbound_logs FK_c093f3e40bbae1d28dbddb24b92; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbound_logs
    ADD CONSTRAINT "FK_c093f3e40bbae1d28dbddb24b92" FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: mailboxes FK_c1f669670cedb8c0398d5f9fe73; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailboxes
    ADD CONSTRAINT "FK_c1f669670cedb8c0398d5f9fe73" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: mailboxes FK_dad759d32d0ce862b8a7539508f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailboxes
    ADD CONSTRAINT "FK_dad759d32d0ce862b8a7539508f" FOREIGN KEY (smtp_provider_id) REFERENCES public.smtp_providers(id) ON DELETE SET NULL;


--
-- Name: threads FK_dc13fb36ea88d963e9cff1349ea; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT "FK_dc13fb36ea88d963e9cff1349ea" FOREIGN KEY (mailbox_id) REFERENCES public.mailboxes(id) ON DELETE CASCADE;


--
-- Name: attachments attachments_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.drafts(id) ON DELETE CASCADE;


--
-- Name: attachments attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: drafts drafts_mailbox_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drafts
    ADD CONSTRAINT drafts_mailbox_id_fkey FOREIGN KEY (mailbox_id) REFERENCES public.mailboxes(id) ON DELETE CASCADE;


--
-- Name: drafts drafts_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drafts
    ADD CONSTRAINT drafts_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE SET NULL;


--
-- Name: labels labels_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: signatures signatures_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signatures
    ADD CONSTRAINT signatures_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: templates templates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: thread_labels thread_labels_label_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_labels
    ADD CONSTRAINT thread_labels_label_id_fkey FOREIGN KEY (label_id) REFERENCES public.labels(id) ON DELETE CASCADE;


--
-- Name: thread_labels thread_labels_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_labels
    ADD CONSTRAINT thread_labels_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict l5bDPQWsEi0xcb2wFquejwb3fdXPEHkCIVj2pkaVyhcTFFLD30ZwlpqhnDHgpzW

