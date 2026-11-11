-- Migração 003: autenticação de dois fatores (TOTP) por utilizador.
-- O segredo só existe depois de o utilizador começar a configuração; o estado diz se o
-- segundo fator é exigido. Endpoints: POST /auth/totp/configurar, /ativar e /desativar.

ALTER TABLE utilizador ADD COLUMN IF NOT EXISTS ut_totp_secret VARCHAR(64);
ALTER TABLE utilizador ADD COLUMN IF NOT EXISTS ut_totp_ativo BOOLEAN NOT NULL DEFAULT FALSE;
