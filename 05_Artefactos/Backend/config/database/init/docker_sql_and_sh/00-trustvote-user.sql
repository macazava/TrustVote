\getenv trustvote_password TRUSTVOTE_DB_PASSWORD
\o /dev/null

SELECT format('CREATE ROLE trustvote WITH LOGIN PASSWORD %L', :'trustvote_password')
WHERE NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'trustvote'
);
\gexec

SELECT format('ALTER ROLE trustvote WITH LOGIN PASSWORD %L', :'trustvote_password');
\gexec
\o

-- No PostgreSQL 15+ o PUBLIC já não pode criar no schema public.
-- Tornar o trustvote dono da BD (e portanto do schema public) para o SET ROLE em 01-trustvote.sql funcionar.
ALTER DATABASE trustvote OWNER TO trustvote;

