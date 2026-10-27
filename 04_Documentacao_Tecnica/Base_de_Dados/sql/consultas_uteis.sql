-- =====================================================================
-- TrustVote — consultas úteis (só leitura)
-- Usar no pgAdmin (Query Tool) ou no psql:
--   docker compose exec db-primary psql -U trustvote -d trustvote
-- Nenhuma destas consultas revela em quem um eleitor votou.
-- =====================================================================

-- 1. Eleições e o estado de cada ronda
SELECT e.ele_id, e.ele_titulo, e.ele_estado,
       r.ron_numero, r.ron_estado, r.ron_data_inicio, r.ron_data_fim
FROM eleicao e
LEFT JOIN ronda r ON r.ron_ele_id = e.ele_id
ORDER BY e.ele_id, r.ron_numero;

-- 2. Candidatos de cada ronda
SELECT e.ele_titulo, r.ron_numero, c.cand_nome, c.cand_partido
FROM ronda_candidato rc
JOIN ronda r     ON r.ron_id = rc.rc_ron_id
JOIN eleicao e   ON e.ele_id = r.ron_ele_id
JOIN candidato c ON c.cand_id = rc.rc_cand_id
ORDER BY e.ele_id, r.ron_numero, c.cand_nome;

-- 3. Participação por ronda (habilitados, votantes e taxa)
SELECT e.ele_titulo, r.ron_numero,
       (SELECT count(*) FROM habilitacao h WHERE h.hab_ele_id = e.ele_id) AS habilitados,
       (SELECT count(*) FROM participacao p WHERE p.part_ron_id = r.ron_id) AS votantes,
       round(100.0 * (SELECT count(*) FROM participacao p WHERE p.part_ron_id = r.ron_id)
             / NULLIF((SELECT count(*) FROM habilitacao h WHERE h.hab_ele_id = e.ele_id), 0), 2) AS taxa_pct
FROM ronda r
JOIN eleicao e ON e.ele_id = r.ron_ele_id
ORDER BY e.ele_id, r.ron_numero;

-- 4. Resultados apurados
SELECT e.ele_titulo, r.ron_numero, c.cand_nome, res.res_total_votos, res.res_percentagem
FROM resultado res
JOIN ronda r     ON r.ron_id = res.res_ron_id
JOIN eleicao e   ON e.ele_id = r.ron_ele_id
JOIN candidato c ON c.cand_id = res.res_cand_id
ORDER BY e.ele_id, r.ron_numero, res.res_total_votos DESC;

-- 5. Consistência: nº de votos tem de ser igual ao nº de participações em cada ronda
SELECT r.ron_id, r.ron_numero,
       (SELECT count(*) FROM voto v WHERE v.vot_ron_id = r.ron_id)          AS votos,
       (SELECT count(*) FROM participacao p WHERE p.part_ron_id = r.ron_id) AS participacoes,
       (SELECT count(*) FROM voto v WHERE v.vot_ron_id = r.ron_id)
         = (SELECT count(*) FROM participacao p WHERE p.part_ron_id = r.ron_id) AS consistente
FROM ronda r
ORDER BY r.ron_id;

-- 6. Eleitores habilitados numa eleição (trocar o 1 pelo id da eleição)
SELECT u.ut_id, u.ut_nome, u.ut_email, h.hab_data
FROM habilitacao h
JOIN utilizador u ON u.ut_id = h.hab_ut_id
WHERE h.hab_ele_id = 1
ORDER BY u.ut_nome;

-- 7. Utilizadores por perfil (sem dados sensíveis)
SELECT ut_id, ut_nome, ut_email, ut_perfil, ut_ativo, ut_totp_ativo, ut_datareg
FROM utilizador
ORDER BY ut_perfil, ut_nome;

-- 8. Auditoria: últimas 50 operações
SELECT a.aud_id, a.aud_data, a.aud_acao, u.ut_email, a.aud_entidade, a.aud_entidade_id, a.aud_detalhes
FROM auditoria a
LEFT JOIN utilizador u ON u.ut_id = a.aud_ut_id
ORDER BY a.aud_id DESC
LIMIT 50;

-- 9. Auditoria: tentativas de login falhadas por email (últimas 24 h)
SELECT coalesce(u.ut_email, a.aud_detalhes->>'email', '(desconhecido)') AS email, count(*) AS falhas
FROM auditoria a
LEFT JOIN utilizador u ON u.ut_id = a.aud_ut_id
WHERE a.aud_acao IN ('auth.login_falhado', 'auth.login_bloqueado')
  AND a.aud_data > now() - interval '24 hours'
GROUP BY 1
ORDER BY falhas DESC;

-- 10. Estado da replicação (correr no primário, como postgres)
-- SELECT application_name, state, sync_state, replay_lag FROM pg_stat_replication;
