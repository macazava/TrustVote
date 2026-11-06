# TrustVote — Frontend

Site do TrustVote em HTML, CSS e JavaScript simples (sem framework), servido pelos nginx do
Docker. Para o pôr a correr basta a stack (`Infraestrutura\stack.cmd up`) e abrir
<http://127.0.0.1:8080>. O Node só é preciso para os testes e para recompilar o Tailwind.

## Estrutura

```
Frontend/
├── pages/          # 13 páginas (públicas, login, área do eleitor e área da equipa)
├── js/
│   ├── models/     # dados: ligação à API (servidor.js, api.js), sessão, eleições, resultados
│   ├── views/      # HTML gerado a partir dos dados (uma pasta por área)
│   └── controllers/# o que acontece em cada página (uma pasta por área)
├── css/
│   ├── style.css   # índice: importa os outros pela ordem certa
│   ├── base/ componentes/ paginas/
│   └── tailwind.css  # gerado por "npm run css" (não editar à mão)
├── assets/         # imagens
├── testes/
│   ├── unidade/    # testes sem browser (node --test)
│   └── navegador/  # testes num Chrome real: computador, tablet e telemóvel
└── package.json    # comandos: npm test, npm run test:navegador, npm run css
```

Cada página carrega os scripts por esta ordem: models → views → controllers. Todos se
registam em `window.TrustVote`. O site fala com a API do nginx onde foi aberto e, se ele não
responder, tenta os outros (`js/models/servidor.js`).

## Testes

Precisam do Node 22 ou mais recente; não é preciso instalar pacotes.

```powershell
cd Frontend
npm test                      # testes unitários (~1 s), sem browser nem stack
npm run test:navegador        # testes num Chrome real; precisa da stack a correr
```

| Testes | O que verificam |
|---|---|
| `unidade/servidor.test.mjs` | Ligação à API: troca para o outro servidor quando um não responde, um voto nunca é repetido noutro servidor, token, mensagens de erro, sem cache do browser |
| `unidade/formatar-e-modelos.test.mjs` | Números e datas à portuguesa, estado das eleições (aberta/fechada), volta atual, contas dos resultados |
| `unidade/vistas.test.mjs` | HTML gerado com os dados certos e **sem HTML injetado** (um nome com `<script>` nunca é executado) |
| `unidade/css.test.mjs` | CSS limpo: nenhuma classe sem uso, nenhuma propriedade sempre substituída, nenhum ficheiro fora do `style.css` |
| `navegador/executar.mjs` | Em computador (1366 px), tablet (820 px) e telemóvel (390 px): cada página com dados da API, sem erros, sem deslocar para o lado, imagens com texto alternativo, campos com rótulo, menu ☰, login do eleitor e da equipa com todos os separadores, boletim até à confirmação (sem votar) |

Os testes no navegador usam o Chrome (ou o Edge) instalado no PC; outro endereço:
`$env:SITE="http://127.0.0.1:8081"; npm run test:navegador`.

## CSS

- O nosso CSS está em `css/` e é organizado por função (base, componentes, páginas).
  O `css.test.mjs` impede que volte a acumular regras mortas.
- O Tailwind só traz classes de layout usadas no HTML (`grid-cols-…`, `rounded-…`). Depois de
  mudar classes do Tailwind no HTML ou no JS: `npm install` (uma vez) e `npm run css`.
- Depois de mudar CSS ou JS, aumentar o `?v=` nas páginas, para o browser não usar a versão
  antiga.

## Testar num telemóvel real

1. Telemóvel e PC na **mesma rede Wi-Fi**.
2. Arrancar a stack aberta à rede: `Infraestrutura\stack.cmd up -Rede`. No fim mostra o
   endereço para o telemóvel, por exemplo `http://192.168.1.20:8080`.
3. Abrir esse endereço no telemóvel. Se não abrir, permitir o Docker na firewall do Windows.
4. No fim, voltar ao normal (só este PC): `Infraestrutura\stack.cmd up`.

## Testes com utilizadores (guião)

Para avaliar a usabilidade com 3 a 5 colegas que não conhecem o projeto. Cada pessoa faz as
tarefas sozinha, a pensar em voz alta; quem observa só anota, não ajuda.

| # | Tarefa | Sucesso se… |
|---|---|---|
| 1 | Descobrir até quando se pode votar | Encontra a data no calendário ou na página inicial |
| 2 | Ver as propostas da Lista B | Abre as listas e lê a proposta |
| 3 | Entrar como `eleitor05@trustvote.pt` (`Demonstracao2026`) e votar | Deposita o voto e vê o recibo |
| 4 | Confirmar que o voto foi contado | Usa "Verificar" nos recibos |
| 5 | (equipa) Ver quantos estudantes já votaram | Encontra a participação na Visão geral |
| 6 | Repetir a tarefa 3 num telemóvel | Consegue sem ampliar nem deslocar para o lado |

Anotar para cada tarefa: concluiu (sim/não), tempo, hesitações e comentários. No fim, cada
pessoa responde ao questionário **SUS** (System Usability Scale, 10 perguntas de 1 a 5); acima
de 68 pontos a usabilidade considera-se acima da média. Os resultados vão para
`06_Dados_Investigacao`.
