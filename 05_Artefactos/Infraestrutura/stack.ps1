<#
TrustVote — arranca, para e mostra a infraestrutura (compose.yaml).

  .\stack.cmd up [-Dev] [-Build]   arranca tudo; na 1.ª vez cria o .env e os dados de demonstração
  .\stack.cmd down                 para e remove os contentores (mantém os dados)
  .\stack.cmd parar 1|2            simula a queda do Servidor 1 (ou 2) inteiro
  .\stack.cmd ligar 1|2            volta a ligar esse servidor
  .\stack.cmd ps                   estado de todos os contentores
  .\stack.cmd logs <serviço>       segue os logs de um serviço (ex.: worker, nginx2)
  .\stack.cmd demo                 cria os dados de demonstração (só numa base de dados vazia)

O stack.cmd corre este script sem depender da política de execução do PowerShell.
-Dev também arranca o pgAdmin (http://127.0.0.1:5050).
-Build reconstrói a imagem do backend (depois de mudar código em ../Backend).
#>
param(
    [Parameter(Position = 0)][ValidateSet("up", "down", "parar", "ligar", "ps", "logs", "demo")][string]$Acao = "ps",
    [Parameter(Position = 1)][string]$Servico,
    [switch]$Dev,
    [switch]$Build
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
# A saída dos contentores vem em UTF-8: sem isto, os acentos aparecem trocados na consola.
[Console]::OutputEncoding = New-Object Text.UTF8Encoding $false

$rede = "trustvote-network"
# Os serviços de cada "servidor" (ver compose.yaml)
$servidores = @{
    "1" = @("nginx1", "servidor1", "worker", "db-primary", "redis", "sentinel1")
    "2" = @("nginx2", "servidor2", "worker-reserva", "db-replica", "redis-replica", "sentinel2")
}

function Compose([string[]]$argumentos) {
    & docker compose --profile dev @argumentos
    if ($LASTEXITCODE -ne 0) { throw "docker compose $($argumentos -join ' ') falhou" }
}

function Confirmar-Docker {
    & docker info *> $null
    if ($LASTEXITCODE -ne 0) { throw "O Docker não está a correr. Abra o Docker Desktop, espere que fique pronto e repita." }
}

# Primeira vez neste PC: cria o .env a partir do .env.example, com passwords aleatórias.
function Criar-Env {
    if (Test-Path ".env") { return }
    $texto = [IO.File]::ReadAllText((Join-Path $PSScriptRoot ".env.example"))
    $texto = [regex]::Replace($texto, "mudar_[A-Za-z_]*", { param($m) -join ((1..40) | ForEach-Object { "abcdefghijkmnpqrstuvwxyz23456789"[(Get-Random -Maximum 32)] }) })
    [IO.File]::WriteAllText((Join-Path $PSScriptRoot ".env"), $texto, (New-Object Text.UTF8Encoding $false))
    Write-Host "Criado o .env com passwords aleatórias (só neste PC; não vai para o git)." -ForegroundColor Yellow
}

# Uma rede trustvote-network de versões antigas (criada à mão, sem o Compose) impede o
# Compose de criar a sua; sem contentores ligados, pode ser apagada.
function Limpar-Rede-Antiga {
    if (-not (docker network ls -q --filter "name=^$rede$")) { return }
    # Filtro por etiqueta (sem aspas: o PowerShell 5.1 tira-as aos argumentos do docker)
    if (docker network ls -q --filter "name=^$rede$" --filter "label=com.docker.compose.project=trustvote") { return }
    if (docker ps -aq --filter "network=$rede") {
        throw "A rede $rede é de uma versão antiga e ainda tem contentores. Pare-os (docker stop) e repita."
    }
    docker network rm $rede | Out-Null
}

# Corre demo/dados_demo.py dentro do contentor da API (não precisa de Python no PC).
# Copiado com docker cp: passar o texto por um pipe do PowerShell 5.1 trocava os acentos por "?".
function Criar-Dados-Demo {
    & docker cp (Join-Path $PSScriptRoot "demo\dados_demo.py") trustvote-servidor1:/tmp/dados_demo.py
    if ($LASTEXITCODE -ne 0) { throw "O contentor trustvote-servidor1 não está a correr." }
    & docker exec -e PYTHONPATH=/app -w /app trustvote-servidor1 python /tmp/dados_demo.py
    if ($LASTEXITCODE -ne 0) { throw "Não foi possível criar os dados de demonstração." }
}

function Porta($nome, $omissao) {
    $linha = Get-Content ".env" | Where-Object { $_ -match "^$nome=(\d+)" } | Select-Object -First 1
    if ($linha) { return ($linha -split "=")[1].Trim() } else { return $omissao }
}

function Servicos-Do-Servidor {
    if (-not $servidores.ContainsKey($Servico)) { throw "Indique o servidor: .\stack.cmd $Acao 1  (ou 2)" }
    return $servidores[$Servico]
}

switch ($Acao) {
    "up" {
        Confirmar-Docker
        Criar-Env
        Limpar-Rede-Antiga
        $argumentos = @("up", "-d", "--wait") + $(if ($Build) { @("--build") } else { @() })
        if (-not $Dev) { $argumentos += @("--scale", "pgadmin=0") }
        Compose $argumentos
        Write-Host "== dados de demonstração" -ForegroundColor Cyan
        Criar-Dados-Demo
        Write-Host ""
        Write-Host "TrustVote a correr:" -ForegroundColor Green
        Write-Host "  Site:  http://127.0.0.1:$(Porta 'ENTRADA_PORT' 8080)   (passa sozinho para o servidor que estiver de pé)"
        Write-Host "  Direto: Servidor 1 em http://127.0.0.1:$(Porta 'NGINX1_PORT' 8081), Servidor 2 em http://127.0.0.1:$(Porta 'NGINX2_PORT' 8082)"
        Write-Host "  API:   http://127.0.0.1:$(Porta 'ENTRADA_PORT' 8080)/api/docs"
        if ($Dev) { Write-Host "  pgAdmin: http://127.0.0.1:5050" }
    }
    "down" {
        Confirmar-Docker
        # O árbitro primeiro, para não reagir à paragem das bases de dados.
        Compose @("stop", "monitor", "sentinel3")
        Compose @("down", "--remove-orphans")
    }
    "parar" {
        Confirmar-Docker
        $lista = Servicos-Do-Servidor
        Write-Host "A parar o Servidor $Servico inteiro: $($lista -join ', ')" -ForegroundColor Yellow
        Compose (@("stop") + $lista)
    }
    "ligar" {
        Confirmar-Docker
        $lista = Servicos-Do-Servidor
        Write-Host "A ligar o Servidor $Servico" -ForegroundColor Cyan
        Compose (@("up", "-d", "--wait") + $lista)
    }
    "ps" {
        docker ps -a --filter "network=$rede" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    }
    "demo" {
        Confirmar-Docker
        Criar-Dados-Demo
    }
    "logs" {
        if (-not $Servico) { throw "Indique o serviço: .\stack.cmd logs worker" }
        $nome = if ($Servico -like "trustvote-*") { $Servico } else { "trustvote-$Servico" }
        docker logs -f $nome
    }
}
