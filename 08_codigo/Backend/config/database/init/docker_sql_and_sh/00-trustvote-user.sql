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

ALTER DATABASE trustvote OWNER TO trustvote;
GRANT CONNECT ON DATABASE trustvote TO trustvote;
GRANT USAGE, CREATE ON SCHEMA public TO trustvote;
