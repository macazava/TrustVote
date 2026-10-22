# Backend do TrustVote

Este backend é a API do TrustVote, construída com FastAPI. Atualmente, a aplicação tem um endpoint inicial de verificação (`GET /`) e alguns módulos em desenvolvimento para autenticação e TOTP. As funcionalidades de eleições, votação, resultados e a integração completa com a base de dados ainda não estão implementadas.

## Estrutura atual

```text
Backend/
├── app/
│   ├── models/          # modelos Python em desenvolvimento
│   ├── repositories/    # acesso a dados em desenvolvimento
│   ├── routers/         # rotas em desenvolvimento
│   ├── schemas/         # validação dos dados da API
│   ├── security/        # componentes de segurança, incluindo TOTP
│   ├── services/        # regras de negócio em desenvolvimento
│   ├── testes/          # testes em desenvolvimento
│   └── worker/          # reservado para tarefas assíncronas
├── config/
│   └── database/
│       └── init/
│           └── docker_sql_and_sh/  # Compose e scripts SQL atuais
├── Dockerfile
├── main.py
└── requirements.txt
```

O `main.py` na raiz cria a aplicação FastAPI. O `Dockerfile` instala as dependências e executa essa aplicação na porta `8001`. As pastas em `app/` estão a ser construídas; a sua presença não significa que todas essas funcionalidades já estejam disponíveis.

## Pré-requisitos

- Python 3.12 ou compatível com as versões declaradas em `requirements.txt`, para execução local.
- Docker Desktop iniciado, para execução em container.

## Executar localmente no Windows

Abre o PowerShell na pasta `Backend`:

```powershell
cd "C:\Users\<utilizador>\PycharmProjects\TrustVote\05_Artefactos\Backend"
```

Cria e ativa um ambiente virtual, instala as dependências e inicia a API:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

Se o PowerShell bloquear a ativação do ambiente virtual, podes executar o servidor sem ativá-lo:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

Mantém o terminal aberto enquanto usas a API. Abre:

- API: <http://localhost:8001/>
- Documentação interativa: <http://localhost:8001/docs>

`0.0.0.0` é o endereço de escuta do servidor; no navegador usa `localhost`.

## Executar com Docker

Na pasta `Backend`, constrói a imagem:

```powershell
docker build -t trustvote-backend .
```

Inicia o container:

```powershell
docker run --rm --name trustvote-api -p 8001:8001 trustvote-backend
```

Abre <http://localhost:8001/> ou <http://localhost:8001/docs>. O comando mantém o container ligado no terminal; `Ctrl+C` termina-o.

Se a porta `8001` já estiver ocupada no computador, podes mapear outra porta do computador para a porta `8001` do container. Por exemplo:

```powershell
docker run --rm --name trustvote-api -p 8002:8001 trustvote-backend
```

Nesse caso, abre <http://localhost:8002/>.

## PostgreSQL e Redis

O Compose existente encontra-se em:

```text
config/database/init/docker_sql_and_sh/docker-compose.yml
```

Esse Compose inicia PostgreSQL e Redis; não inicia a API. Os scripts SQL montados no container são executados pelo PostgreSQL na primeira inicialização do volume. A API atual ainda não usa esses serviços no endpoint inicial.

O Compose exige um ficheiro `.env` nessa mesma pasta, com `POSTGRES_PASSWORD` e `TRUSTVOTE_DB_PASSWORD`. O ficheiro `.env.example` contém valores de exemplo: copia-o para `.env` e substitui-os por valores locais próprios. Não partilhes nem commits o `.env` real. O Compose também declara ficheiros de secrets JWT e TOTP; se o Docker Compose exigir esses ficheiros ao validar a configuração, cria-os localmente conforme a configuração, sem os adicionar ao Git.

Para iniciar apenas as dependências, a partir da pasta `Backend`:

```powershell
Copy-Item config\database\init\docker_sql_and_sh\.env.example config\database\init\docker_sql_and_sh\.env
docker compose -f config\database\init\docker_sql_and_sh\docker-compose.yml up -d
```

Para as parar:

```powershell
docker compose -f config\database\init\docker_sql_and_sh\docker-compose.yml down
```

Não uses `docker compose down -v` se quiseres preservar os dados do volume PostgreSQL.

## Resolução de problemas

- **`can't open file ...\Backend\main.py` ao executar um caminho antigo:** a partir da raiz de `Backend`, inicia com `python -m uvicorn main:app ...`; não uses `python app\main.py`.
- **`ERR_CONNECTION_REFUSED`:** confirma que o comando Uvicorn ou o container continua em execução e abre a porta publicada, `localhost:8001`.
- **Porta em uso:** escolhe outra porta local, por exemplo `8002`; com Docker usa `-p 8002:8001`.
- **Docker não liga ao daemon:** inicia o Docker Desktop e confirma com `docker info`.
- **Dependências não instaladas:** ativa o ambiente virtual e executa `python -m pip install -r requirements.txt`.

## Estado e próximos componentes

Autenticação TOTP, JWT RS256, ligação à base de dados, votação, apuramento, worker, replicação PostgreSQL, load balancer e previsão por IA são objetivos de desenvolvimento e não são todos fornecidos pela API inicial. Antes de usar o sistema para uma votação real, é necessário implementar e testar essas funcionalidades, definir o modelo de ameaça e rever especificamente as garantias de anonimato do voto.
