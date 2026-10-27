-- =====================================================================
-- TrustVote — esquema completo da base de dados (CÓPIA DE REFERÊNCIA)
--
-- Gerado automaticamente com pg_dump --schema-only a partir da BD em
-- funcionamento (PostgreSQL 16), em 2026-10-27.
--
-- NÃO é este o ficheiro que cria a BD. A fonte única do esquema é:
--   05_Artefactos/Backend/config/database/init/docker_sql_and_sh/
--     00-trustvote-user.sql  (utilizador trustvote e permissões)
--     trustvote.sql          (tabelas, restrições e índices)
-- Qualquer alteração ao esquema faz-se lá; depois volta-se a gerar esta cópia.
-- =====================================================================
--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg13+2)

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria (
    aud_id bigint NOT NULL,
    aud_ut_id bigint,
    aud_acao character varying(80) NOT NULL,
    aud_entidade character varying(50),
    aud_entidade_id bigint,
    aud_detalhes jsonb,
    aud_ip character varying(45),
    aud_hash_anterior character(64),
    aud_hash_atual character(64),
    aud_data timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: auditoria_aud_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.auditoria ALTER COLUMN aud_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.auditoria_aud_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: candidato; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidato (
    cand_id bigint NOT NULL,
    cand_ele_id bigint NOT NULL,
    cand_nome character varying(255) NOT NULL,
    cand_partido character varying(255),
    cand_descricao text,
    cand_ativo boolean DEFAULT true
);


--
-- Name: candidato_cand_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.candidato ALTER COLUMN cand_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.candidato_cand_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: eleicao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eleicao (
    ele_id bigint NOT NULL,
    ele_titulo character varying(150) NOT NULL,
    ele_descricao text,
    ele_estado character varying(50) DEFAULT 'rascunho'::character varying NOT NULL,
    ele_ut_id bigint NOT NULL,
    ele_data timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ele_ck_estado CHECK (((ele_estado)::text = ANY ((ARRAY['rascunho'::character varying, 'agendada'::character varying, 'em_curso'::character varying, 'encerrada'::character varying])::text[])))
);


--
-- Name: eleicao_ele_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.eleicao ALTER COLUMN ele_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.eleicao_ele_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: habilitacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.habilitacao (
    hab_ele_id bigint NOT NULL,
    hab_ut_id bigint NOT NULL,
    hab_data timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: participacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.participacao (
    part_id bigint NOT NULL,
    part_ron_id bigint NOT NULL,
    part_ut_id bigint NOT NULL,
    part_data timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: participacao_part_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.participacao ALTER COLUMN part_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.participacao_part_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: resultado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resultado (
    res_id bigint NOT NULL,
    res_ron_id bigint NOT NULL,
    res_cand_id bigint NOT NULL,
    res_total_votos integer DEFAULT 0 NOT NULL,
    res_percentagem numeric(5,2) DEFAULT 0 NOT NULL,
    res_data timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: resultado_res_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.resultado ALTER COLUMN res_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.resultado_res_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ronda; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ronda (
    ron_id bigint NOT NULL,
    ron_ele_id bigint NOT NULL,
    ron_numero smallint NOT NULL,
    ron_data_inicio timestamp with time zone NOT NULL,
    ron_data_fim timestamp with time zone NOT NULL,
    ron_estado character varying(50) DEFAULT 'agendada'::character varying NOT NULL,
    CONSTRAINT ron_ck_estado CHECK (((ron_estado)::text = ANY ((ARRAY['agendada'::character varying, 'aberta'::character varying, 'encerrada'::character varying, 'apurada'::character varying])::text[]))),
    CONSTRAINT ron_ck_numero CHECK ((ron_numero = ANY (ARRAY[1, 2]))),
    CONSTRAINT ron_ck_periodo CHECK ((ron_data_fim > ron_data_inicio))
);


--
-- Name: ronda_candidato; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ronda_candidato (
    rc_ron_id bigint NOT NULL,
    rc_cand_id bigint NOT NULL
);


--
-- Name: ronda_ron_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.ronda ALTER COLUMN ron_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ronda_ron_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: utilizador; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.utilizador (
    ut_id bigint NOT NULL,
    ut_nome character varying(255) NOT NULL,
    ut_email character varying(255) NOT NULL,
    ut_password_hash character varying(255) NOT NULL,
    ut_perfil character varying(20) DEFAULT 'eleitor'::character varying NOT NULL,
    ut_ativo boolean DEFAULT true,
    ut_datareg timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    ut_totp_segredo text,
    ut_totp_ativo boolean DEFAULT false NOT NULL,
    ut_totp_ultimo_passo bigint,
    CONSTRAINT ut_ck_perfil CHECK (((ut_perfil)::text = ANY ((ARRAY['eleitor'::character varying, 'administrador'::character varying])::text[])))
);


--
-- Name: utilizador_ut_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.utilizador ALTER COLUMN ut_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.utilizador_ut_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: voto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voto (
    vot_id uuid DEFAULT gen_random_uuid() NOT NULL,
    vot_ron_id bigint NOT NULL,
    vot_cand_id bigint NOT NULL,
    vot_hash character(64) NOT NULL
);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (aud_id);


--
-- Name: candidato candidato_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidato
    ADD CONSTRAINT candidato_pkey PRIMARY KEY (cand_id);


--
-- Name: eleicao eleicao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eleicao
    ADD CONSTRAINT eleicao_pkey PRIMARY KEY (ele_id);


--
-- Name: habilitacao habilitacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.habilitacao
    ADD CONSTRAINT habilitacao_pkey PRIMARY KEY (hab_ele_id, hab_ut_id);


--
-- Name: participacao part_uq_ronda_utilizador; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participacao
    ADD CONSTRAINT part_uq_ronda_utilizador UNIQUE (part_ron_id, part_ut_id);


--
-- Name: participacao participacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participacao
    ADD CONSTRAINT participacao_pkey PRIMARY KEY (part_id);


--
-- Name: resultado res_uq_ronda_candidato; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resultado
    ADD CONSTRAINT res_uq_ronda_candidato UNIQUE (res_ron_id, res_cand_id);


--
-- Name: resultado resultado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resultado
    ADD CONSTRAINT resultado_pkey PRIMARY KEY (res_id);


--
-- Name: ronda ron_uq_eleicao_numero; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ronda
    ADD CONSTRAINT ron_uq_eleicao_numero UNIQUE (ron_ele_id, ron_numero);


--
-- Name: ronda_candidato ronda_candidato_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ronda_candidato
    ADD CONSTRAINT ronda_candidato_pkey PRIMARY KEY (rc_ron_id, rc_cand_id);


--
-- Name: ronda ronda_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ronda
    ADD CONSTRAINT ronda_pkey PRIMARY KEY (ron_id);


--
-- Name: utilizador utilizador_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilizador
    ADD CONSTRAINT utilizador_pkey PRIMARY KEY (ut_id);


--
-- Name: utilizador utilizador_ut_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilizador
    ADD CONSTRAINT utilizador_ut_email_key UNIQUE (ut_email);


--
-- Name: voto voto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voto
    ADD CONSTRAINT voto_pkey PRIMARY KEY (vot_id);


--
-- Name: ix_auditoria_acao_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auditoria_acao_data ON public.auditoria USING btree (aud_acao, aud_data);


--
-- Name: ix_auditoria_utilizador; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auditoria_utilizador ON public.auditoria USING btree (aud_ut_id);


--
-- Name: ix_candidato_eleicao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_candidato_eleicao ON public.candidato USING btree (cand_ele_id);


--
-- Name: ix_ronda_eleicao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ronda_eleicao ON public.ronda USING btree (ron_ele_id);


--
-- Name: ix_voto_ronda_candidato; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_voto_ronda_candidato ON public.voto USING btree (vot_ron_id, vot_cand_id);


--
-- Name: auditoria auditoria_fk_utilizador; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_fk_utilizador FOREIGN KEY (aud_ut_id) REFERENCES public.utilizador(ut_id) ON DELETE SET NULL;


--
-- Name: candidato candidato_fk_eleicao; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidato
    ADD CONSTRAINT candidato_fk_eleicao FOREIGN KEY (cand_ele_id) REFERENCES public.eleicao(ele_id) ON DELETE CASCADE;


--
-- Name: eleicao eleicao_fk_utilizador; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eleicao
    ADD CONSTRAINT eleicao_fk_utilizador FOREIGN KEY (ele_ut_id) REFERENCES public.utilizador(ut_id);


--
-- Name: habilitacao hab_fk_eleicao; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.habilitacao
    ADD CONSTRAINT hab_fk_eleicao FOREIGN KEY (hab_ele_id) REFERENCES public.eleicao(ele_id) ON DELETE CASCADE;


--
-- Name: habilitacao hab_fk_utilizador; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.habilitacao
    ADD CONSTRAINT hab_fk_utilizador FOREIGN KEY (hab_ut_id) REFERENCES public.utilizador(ut_id) ON DELETE CASCADE;


--
-- Name: participacao part_fk_ronda; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participacao
    ADD CONSTRAINT part_fk_ronda FOREIGN KEY (part_ron_id) REFERENCES public.ronda(ron_id);


--
-- Name: participacao part_fk_utilizador; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participacao
    ADD CONSTRAINT part_fk_utilizador FOREIGN KEY (part_ut_id) REFERENCES public.utilizador(ut_id);


--
-- Name: ronda_candidato rc_fk_candidato; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ronda_candidato
    ADD CONSTRAINT rc_fk_candidato FOREIGN KEY (rc_cand_id) REFERENCES public.candidato(cand_id) ON DELETE CASCADE;


--
-- Name: ronda_candidato rc_fk_ronda; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ronda_candidato
    ADD CONSTRAINT rc_fk_ronda FOREIGN KEY (rc_ron_id) REFERENCES public.ronda(ron_id) ON DELETE CASCADE;


--
-- Name: resultado resultado_fk_ronda_candidato; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resultado
    ADD CONSTRAINT resultado_fk_ronda_candidato FOREIGN KEY (res_ron_id, res_cand_id) REFERENCES public.ronda_candidato(rc_ron_id, rc_cand_id);


--
-- Name: ronda ronda_fk_eleicao; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ronda
    ADD CONSTRAINT ronda_fk_eleicao FOREIGN KEY (ron_ele_id) REFERENCES public.eleicao(ele_id) ON DELETE CASCADE;


--
-- Name: voto voto_fk_ronda_candidato; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voto
    ADD CONSTRAINT voto_fk_ronda_candidato FOREIGN KEY (vot_ron_id, vot_cand_id) REFERENCES public.ronda_candidato(rc_ron_id, rc_cand_id);


--
-- PostgreSQL database dump complete
--


