-- Migração 001: descrição de cada tabela, visível no pgAdmin, DBeaver ou IntelliJ.
-- (Primeira migração: serve também de exemplo de como se escreve uma.)

COMMENT ON TABLE utilizador IS 'Contas: eleitores e administradores (palavra-passe com Argon2).';
COMMENT ON TABLE eleicao IS 'Atos eleitorais: rascunho, agendada, em curso ou encerrada, e o quórum.';
COMMENT ON TABLE ronda IS 'Voltas de cada eleição (1.ª e 2.ª): agendada, aberta, encerrada, apurada.';
COMMENT ON TABLE candidato IS 'Candidaturas de cada eleição, por órgão e lista.';
COMMENT ON TABLE ronda_candidato IS 'Candidatos que concorrem em cada volta.';
COMMENT ON TABLE habilitacao IS 'Caderno eleitoral: quem pode votar em cada eleição.';
COMMENT ON TABLE participacao IS 'Quem votou em cada volta (sem dizer em quem): impede votos repetidos.';
COMMENT ON TABLE voto IS 'Em quem se votou, sem utilizador nem data; selo HMAC e hash do recibo.';
COMMENT ON TABLE resultado IS 'Apuramento de cada volta (a linha sem candidato são os votos em branco).';
COMMENT ON TABLE auditoria IS 'Registo de ações, encadeado por hashes (deteta alterações e apagamentos).';
COMMENT ON TABLE sondagem_participacao IS 'Quem respondeu à sondagem (sem a resposta).';
COMMENT ON TABLE sondagem_resposta IS 'Respostas da sondagem (sem quem respondeu).';
COMMENT ON TABLE estudante_inscrito IS 'Lista oficial de números de estudante (registo restrito).';
COMMENT ON TABLE schema_migracao IS 'Migrações já aplicadas a esta base de dados (app/migracoes.py).';
