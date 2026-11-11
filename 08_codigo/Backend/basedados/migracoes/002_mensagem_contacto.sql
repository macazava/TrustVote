-- Migração 002: mensagens enviadas pelo formulário de contacto (Ajuda → Contactos).
-- A comissão eleitoral lê-as no separador "Mensagens" da área da equipa.

CREATE TABLE IF NOT EXISTS mensagem_contacto (
    mc_id SERIAL PRIMARY KEY,
    mc_nome VARCHAR(80) NOT NULL,
    mc_email VARCHAR(255) NOT NULL,
    mc_assunto VARCHAR(80) NOT NULL,
    mc_mensagem VARCHAR(1500) NOT NULL,
    mc_lida BOOLEAN NOT NULL DEFAULT FALSE,
    mc_data TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS mensagem_contacto_data_idx ON mensagem_contacto (mc_data DESC);

COMMENT ON TABLE mensagem_contacto IS 'Mensagens do formulário de contacto, lidas pela comissão eleitoral.';
