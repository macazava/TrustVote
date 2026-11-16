-- Migração 004: encerramento automático da eleição.
-- Com a opção ligada (por omissão), as tarefas automáticas (app/tarefas.py) encerram a
-- eleição logo que a última volta chega à hora de fim e é apurada, sem esperar pela equipa.
-- Desligada, a eleição fica em curso depois da 1.ª volta, para a equipa decidir a 2.ª volta.

ALTER TABLE eleicao ADD COLUMN IF NOT EXISTS ele_encerramento_auto BOOLEAN NOT NULL DEFAULT TRUE;
