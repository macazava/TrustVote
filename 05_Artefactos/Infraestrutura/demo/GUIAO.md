# Guião da demonstração

Objetivo: mostrar o sistema distribuído a funcionar e a continuar quando um servidor falha.
Os comandos correm em PowerShell, a partir de `05_Artefactos`.

## Preparação

1. Arrancar os dois servidores e o monitor (na primeira vez também cria os dados):

   ```powershell
   cd Infraestrutura
   .\stack.cmd up -Dev
   cd ..
   ```

2. Se a BD tiver dados de ensaios, limpá-la e recriar os dados:

   ```powershell
   docker exec trustvote-db-primary psql -U trustvote -d trustvote -c "TRUNCATE utilizador, eleicao, ronda, candidato, ronda_candidato, habilitacao, participacao, voto, resultado, auditoria, sondagem_participacao, sondagem_resposta, estudante_inscrito RESTART IDENTITY CASCADE"
   Infraestrutura\stack.cmd demo
   ```

   Se `trustvote-db-primary` for a réplica, usar `trustvote-db-replica` no primeiro comando.

3. Abrir dois terminais e o browser em <http://127.0.0.1:8080>:

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
| 1 | Explicar o Terminal 1 | Servidor 1 e 2, worker `A APURAR` e reserva, BD primária e réplica `sync`, Redis principal e réplica |
| 2 | `1..6 \| % { (Invoke-RestMethod http://127.0.0.1:8080/api/health).instance }` | A entrada e os nginx repartem os pedidos pelas duas instâncias |
| 3 | Entrar como `eleitor01` e votar | Recibo; `votos=1` nos dois nós do Terminal 1 |
| 4 | `docker kill trustvote-servidor1` e votar com `eleitor02` | Continua a funcionar pela outra instância |
| 5 | `docker kill trustvote-worker` | O `worker-reserva` passa a `A APURAR` |
| 6 | `Infraestrutura\stack.cmd parar 1` (Servidor 1 inteiro) | Monitor regista `FAILOVER`; a BD réplica e o `redis-replica` passam a principais (~10 s); o site continua em `http://127.0.0.1:8080` (recarregar a página: abre pelo Servidor 2) |
| 7 | Terminar sessão e voltar a entrar com `eleitor03` | Login, logout e limite de tentativas continuam a funcionar (Redis promovido) |
| 8 | Votar com `eleitor03` (se aparecer erro nos primeiros segundos, repetir) | Voto aceite na nova primária; contagem mantém-se |
| 9 | Verificar o recibo do `eleitor01` | O voto anterior à falha continua contado |
| 10 | Tentar votar outra vez com `eleitor03` | Voto recusado |
| 11 | Entrar como equipa, encerrar a volta e abrir Resultados | O `worker-reserva` apura logo; resultados com todos os votos |
| 12 | `Infraestrutura\stack.cmd ligar 1` | O antigo primário volta como réplica (`sync`), o `redis` como réplica; o worker principal volta a apurar |

Para mostrar a queda do outro lado, repetir 6–12 com `parar 2` e `ligar 2`.

## Explicação curta

- Dois servidores, cada um com o seu nginx (site e API), API e worker; o site passa sozinho
  para o Nginx 2 se o Nginx 1 não responder.
- O apuramento é feito por um worker, a partir de uma fila no Redis; se ele cair, o worker
  reserva assume em segundos.
- Há um Redis em cada servidor; três Sentinels (um em cada servidor e um no árbitro) promovem
  a réplica quando o principal cai, porque os dois que restam fazem maioria.
- A API não guarda sessões em memória, por isso qualquer instância serve qualquer pedido.
- Cada voto só é confirmado depois de estar nas duas bases de dados.
- O monitor promove a réplica apenas se ela estava síncrona, para nunca perder votos confirmados.
- A API procura sozinha a base de dados que aceita escritas.
- Um antigo primário nunca volta a aceitar escritas: é reconstruído como réplica.

## Limitações a referir

- Registo aberto por omissão (`REGISTO_RESTRITO=true` limita à lista oficial de inscritos).
- Um único PC: os servidores são grupos de contentores na mesma máquina.
- O árbitro (monitor e `sentinel3`) é um ponto único de falha para novos failovers.
- Nos ~10 s entre a queda e a promoção, os votos recebem erro temporário e têm de ser repetidos.
- Sem réplica ativa, os votos ficam sem proteção síncrona.

## Se algo correr mal

- **Failover não acontece:** ver `docker logs trustvote-monitor`. Se indicar promoção recusada,
  o nó que falhou tem de voltar: `docker start <nó>`. Para o Redis: `docker logs trustvote-sentinel3`
  (procurar `+switch-master`).
- **Página sem resposta:** confirmar `docker ps` e fazer `Ctrl + F5`.
- **Sem recuperação em direto:** usar o vídeo de reserva.
