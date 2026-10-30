SET ROLE trustvote;

CREATE TABLE utilizador (
    ut_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ut_nome VARCHAR(255) NOT NULL UNIQUE,
    ut_email VARCHAR(255) NOT NULL UNIQUE,
    ut_num_estudante VARCHAR(20) NOT NULL UNIQUE,
    ut_curso VARCHAR(150),
    ut_password_hash VARCHAR(255) NOT NULL,
    ut_perfil VARCHAR(20) NOT NULL DEFAULT 'eleitor',
    ut_ativo BOOLEAN DEFAULT TRUE,
    ut_datareg TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ut_ck_perfil CHECK (ut_perfil IN ('eleitor', 'administrador')),
    CONSTRAINT ut_ck_num_estudante CHECK (ut_num_estudante ~ '^[A-Za-z0-9]{4,20}$')
);

-- ============================================
-- ELEICAO (RF03)
-- ============================================
CREATE TABLE eleicao (
    ele_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ele_titulo VARCHAR(150) NOT NULL,
    ele_descricao TEXT,
    ele_estado VARCHAR(50) NOT NULL DEFAULT 'rascunho',
    ele_ut_id BIGINT NOT NULL,
    ele_data TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ele_ck_estado CHECK (ele_estado IN ('rascunho', 'agendada', 'em_curso', 'encerrada')),
    CONSTRAINT eleicao_fk_utilizador FOREIGN KEY (ele_ut_id) REFERENCES utilizador (ut_id)
);

-- ============================================
-- RONDA (1.ª e 2.ª volta) (RF08)
-- ============================================
CREATE TABLE ronda (
    ron_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ron_ele_id BIGINT NOT NULL,
    ron_numero SMALLINT NOT NULL,
    ron_data_inicio TIMESTAMPTZ NOT NULL,
    ron_data_fim TIMESTAMPTZ NOT NULL,
    ron_estado VARCHAR(50) NOT NULL DEFAULT 'agendada',
    CONSTRAINT ron_uq_eleicao_numero UNIQUE (ron_ele_id, ron_numero),
    CONSTRAINT ron_ck_numero CHECK (ron_numero IN (1, 2)),
    CONSTRAINT ron_ck_periodo CHECK (ron_data_fim > ron_data_inicio),
    CONSTRAINT ron_ck_estado CHECK (ron_estado IN ('agendada', 'aberta', 'encerrada', 'apurada')),
    CONSTRAINT ronda_fk_eleicao FOREIGN KEY (ron_ele_id) REFERENCES eleicao (ele_id) ON DELETE CASCADE
);

-- ============================================
-- CANDIDATO (RF04)
-- ============================================
CREATE TABLE candidato (
    cand_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cand_ele_id BIGINT NOT NULL,
    cand_nome VARCHAR(255) NOT NULL,
    cand_partido VARCHAR(200),
    cand_orgao VARCHAR(50) NOT NULL DEFAULT 'direcao',
    cand_curso VARCHAR(150),
    cand_ano SMALLINT,
    cand_descricao TEXT,
    cand_ativo BOOLEAN DEFAULT TRUE,
    CONSTRAINT cand_ck_orgao CHECK (cand_orgao IN ('direcao', 'assembleia', 'conselho_fiscal')),
    CONSTRAINT candidato_fk_eleicao FOREIGN KEY (cand_ele_id) REFERENCES eleicao (ele_id) ON DELETE CASCADE
);

-- ============================================
-- RONDA_CANDIDATO (quem concorre em cada ronda)
-- ============================================
CREATE TABLE ronda_candidato (
    rc_ron_id BIGINT NOT NULL,
    rc_cand_id BIGINT NOT NULL,
    PRIMARY KEY (rc_ron_id, rc_cand_id),
    CONSTRAINT rc_fk_ronda FOREIGN KEY (rc_ron_id) REFERENCES ronda (ron_id) ON DELETE CASCADE,
    CONSTRAINT rc_fk_candidato FOREIGN KEY (rc_cand_id) REFERENCES candidato (cand_id) ON DELETE CASCADE
);

-- ============================================
-- HABILITACAO (RF05: quem pode votar em cada eleição)
-- ============================================
CREATE TABLE habilitacao (
    hab_ele_id BIGINT NOT NULL,
    hab_ut_id BIGINT NOT NULL,
    hab_data TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (hab_ele_id, hab_ut_id),
    CONSTRAINT hab_fk_eleicao FOREIGN KEY (hab_ele_id) REFERENCES eleicao (ele_id) ON DELETE CASCADE,
    CONSTRAINT hab_fk_utilizador FOREIGN KEY (hab_ut_id) REFERENCES utilizador (ut_id) ON DELETE CASCADE
);

-- ============================================
-- PARTICIPACAO (RF07: QUEM votou, sem dizer em quem)
-- ============================================
CREATE TABLE participacao (
    part_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    part_ron_id BIGINT NOT NULL,
    part_ut_id BIGINT NOT NULL,
    part_data TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT part_uq_ronda_utilizador UNIQUE (part_ron_id, part_ut_id),
    CONSTRAINT part_fk_ronda FOREIGN KEY (part_ron_id) REFERENCES ronda (ron_id),
    CONSTRAINT part_fk_utilizador FOREIGN KEY (part_ut_id) REFERENCES utilizador (ut_id)
);

-- ============================================
-- VOTO (RF06: EM QUEM se votou, sem dizer quem votou)
-- Sem ligação a utilizador e sem data, para o voto ser anónimo.
-- vot_id é um UUID aleatório (e não identity) para a ordem de
-- inserção não permitir cruzar votos com participações.
-- vot_hash é calculado pelo backend (ex.: SHA-256) para verificar integridade.
-- ============================================
CREATE TABLE voto (
    vot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vot_ron_id BIGINT NOT NULL,
    vot_cand_id BIGINT NOT NULL,
    vot_hash CHAR(64) NOT NULL,
    CONSTRAINT voto_fk_ronda_candidato FOREIGN KEY (vot_ron_id, vot_cand_id) REFERENCES ronda_candidato (rc_ron_id, rc_cand_id)
);

-- ============================================
-- RESULTADO (RF09, RF10: apuramento feito pelo worker)
-- ============================================
CREATE TABLE resultado (
    res_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    res_ron_id BIGINT NOT NULL,
    res_cand_id BIGINT NOT NULL,
    res_total_votos INT NOT NULL DEFAULT 0,
    res_percentagem DECIMAL(5, 2) NOT NULL DEFAULT 0,
    res_data TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT res_uq_ronda_candidato UNIQUE (res_ron_id, res_cand_id),
    CONSTRAINT resultado_fk_ronda_candidato FOREIGN KEY (res_ron_id, res_cand_id) REFERENCES ronda_candidato (rc_ron_id, rc_cand_id)
);

-- ============================================
-- AUDITORIA (RF11)
-- aud_hash_anterior / aud_hash_atual são opcionais (encadeamento para
-- detetar adulterações). Se não forem usados, ficam a NULL.
-- ============================================
CREATE TABLE auditoria (
    aud_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aud_ut_id BIGINT,
    aud_acao VARCHAR(80) NOT NULL,
    aud_entidade VARCHAR(50),
    aud_entidade_id BIGINT,
    aud_detalhes JSONB,
    aud_ip VARCHAR(45),
    aud_hash_anterior CHAR(64),
    aud_hash_atual CHAR(64),
    aud_data TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT auditoria_fk_utilizador FOREIGN KEY (aud_ut_id) REFERENCES utilizador (ut_id) ON DELETE SET NULL
);

-- Índices nas colunas de chave estrangeira mais consultadas (o PostgreSQL não os cria sozinho)
CREATE INDEX ix_ronda_eleicao ON ronda (ron_ele_id);
CREATE INDEX ix_candidato_eleicao ON candidato (cand_ele_id);
CREATE INDEX ix_voto_ronda_candidato ON voto (vot_ron_id, vot_cand_id);
CREATE INDEX ix_auditoria_utilizador ON auditoria (aud_ut_id);
CREATE INDEX ix_auditoria_acao_data ON auditoria (aud_acao, aud_data);
