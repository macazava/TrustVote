# Guião da demonstração

Objetivo: mostrar o sistema distribuído a funcionar e a continuar quando um servidor falha.
Os comandos correm em PowerShell, a partir de `05_Artefactos`.

## Preparação

1. Arrancar a stack e confirmar que todos os serviços estão a correr:

   ```powershell
   cd Infraestrutura
   docker compose -f compose.yaml -f compose.debug.yaml up -d --wait
   cd ..
   ```

2. Se a BD tiver dados de ensaios, limpá-la e recriar os dados:

   ```powershell
   docker exec trustvote-db-primary psql -U trustvote -d trustvote -c "TRUNCATE utilizador, eleicao, ronda, candidato, ronda_candidato, habilitacao, participacao, voto, resultado, auditoria RESTART IDENTITY CASCADE"
   .\.venv\Scripts\python.exe Infraestrutura\demo\dados_demo.py
   ```

   Se `trustvote-db-primary` for a réplica, usar `trustvote-db-replica` no primeiro comando.

3. Iniciar o Live Server, abrir dois terminais e o browser em
   <http://127.0.0.1:5500/Frontend/pages/inicio.html>:

   ```powershell
   # Terminal 1: estado em direto
   .\.venv\Scripts\python.exe Infraestrutura\demo\estado.py --seguir

   # Terminal 2: registos do monitor
   docker logs -f trustvote-monitor
   ```

Contas: `equipa@trustvote.pt` e `eleitor01@trustvote.pt` a `eleitor20@trustvote.pt`, com a
palavra-passe `Demonstracao2026`.

## Demonstração

| # | Ação | O que mostrar |
|---|---|---|
| 1 | Explicar o Terminal 1 | Nginx, duas API, BD primária e réplica `sync` |
| 2 | `1..6 \| % { (Invoke-RestMethod http://127.0.0.1:8080/api/health).instance }` | As instâncias alternam |
| 3 | Entrar como `eleitor01` e votar | Recibo; `votos=1` nos dois nós do Terminal 1 |
| 4 | `docker kill trustvote-servidor1` e votar com `eleitor02` | Continua a funcionar pela outra instância |
| 5 | `docker kill <primário>` | Monitor regista `FAILOVER`; a réplica passa a primária |
| 6 | Votar com `eleitor03`, repetindo se aparecer erro temporário | Voto aceite na nova primária; contagem mantém-se |
| 7 | Verificar o recibo do `eleitor01` | O voto anterior à falha continua contado |
| 8 | Tentar votar outra vez com `eleitor03` | Voto recusado |
| 9 | `docker start <nó que falhou>` e `docker start trustvote-servidor1` | Nó reconstruído como réplica; volta a `sync` |

Trocar `<primário>` pelo nome que aparece no Terminal 1 como `PRIMÁRIO`.

## Explicação curta

- A API não guarda sessões em memória, por isso qualquer instância serve qualquer pedido.
- Cada voto só é confirmado depois de estar nas duas bases de dados.
- O monitor promove a réplica apenas se ela estava síncrona, para nunca perder votos confirmados.
- A API procura sozinha a base de dados que aceita escritas.
- Um antigo primário nunca volta a aceitar escritas: é reconstruído como réplica.

## Limitações a referir

- Registo aberto: qualquer pessoa pode criar conta e votar. Fica resolvido em dezembro.
- Um único PC: os servidores são contentores na mesma máquina.
- O nginx é um ponto único de falha, tal como o monitor para novos failovers.
- Sem réplica ativa, os votos ficam sem proteção síncrona.

## Se algo correr mal

- **Failover não acontece:** ver `docker logs trustvote-monitor`. Se indicar promoção recusada,
  o nó que falhou tem de voltar: `docker start <nó>`.
- **Página sem resposta:** confirmar `docker ps` e fazer `Ctrl + F5`.
- **Sem recuperação em direto:** usar o vídeo de reserva.
