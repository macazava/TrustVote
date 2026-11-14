# Protótipo IA — previsão de votos

Este protótipo organiza resultados eleitorais agregados e usa uma regressão
linear simples para estimar a percentagem de votos por lista.

## Estado dos dados

Ainda não foi confirmada uma fonte pública oficial com resultados de votos da
Associação de Estudantes da Universidade Europeia. Por isso, `dados.csv` contém
apenas linhas **sintéticas**, criadas para testar o formato e o leitor. Não são
resultados reais e não devem ser usados para afirmar que o modelo prevê eleições.

Quando forem encontrados resultados oficiais:

1. confirmar os valores numa ata, comunicado ou publicação oficial;
2. acrescentar os resultados agregados, sem dados pessoais;
3. indicar `real` em `origem` e guardar o URL ou referência em `fonte`;
4. manter as linhas sintéticas identificadas como `sintetico`.

## Formato do CSV

Cada linha representa uma lista numa eleição. As colunas são:

| Coluna | Significado |
|---|---|
| `eleicao_id` | Identificador da eleição |
| `ano` | Ano da eleição |
| `lista` | Nome ou identificador da lista |
| `votos_lista` | Votos obtidos pela lista |
| `votos_validos` | Total de votos válidos nessa eleição |
| `participacao_pct` | Participação eleitoral, em percentagem |
| `origem` | `real` ou `sintetico` |
| `fonte` | URL/referência oficial ou nota de que os dados são fictícios |

Mais tarde, a previsão deverá usar apenas informação que estaria disponível
antes da eleição prevista. A percentagem de votos da eleição será o alvo a
prever:

`percentagem_votos = votos_lista / votos_validos * 100`

## Executar

Instala a dependência a partir da pasta `protoIA`:

```powershell
cd "C:\...\05_Artefactos\G01\protoIA"
python -m pip install -r requirements.txt
python dados.py
python modelo.py
```

`dados.py` verifica o CSV e apresenta as percentagens observadas. `modelo.py`
cria exemplos de treino a partir de eleições consecutivas, testa o modelo na
eleição mais recente e depois treina com todos os dados para estimar a próxima.
Se o CSV contiver dados reais e sintéticos, escolhe a origem explicitamente,
por exemplo `python modelo.py --origem sintetico`.

## Como funciona a previsão

O modelo é uma **regressão linear**. Para cada lista usa:

- a percentagem que obteve na eleição anterior (ou uma divisão igual entre
  listas anteriores, se a lista não existia);
- um indicador de lista nova;
- a participação da eleição anterior;
- o número de listas na eleição a prever.

O alvo de treino é a percentagem de votos válidos obtida na eleição seguinte.
Para evitar testar em dados que o modelo já viu, a eleição mais recente fica
fora do treino durante a avaliação cronológica. O erro apresentado é o erro
absoluto médio em pontos percentuais.

Depois da avaliação, o modelo é treinado novamente com todos os registos e
estima a próxima eleição, assumindo que concorrem as mesmas listas da eleição
mais recente. As percentagens previstas são ajustadas para somarem 100%.

## Limitações da demonstração

- Os exemplos atuais são **sintéticos**; a métrica calculada não demonstra
  capacidade de prever eleições reais.
- Há apenas três eleições de exemplo, pelo que a avaliação é muito instável.
- A estimativa é de percentagem de votos válidos, não de número absoluto de
  votos; para converter em votos seria necessário estimar também a participação.
- A previsão assume que as listas da eleição mais recente voltam a concorrer.
- O modelo não está ligado ao backend ou à base de dados do TrustVote.

## Próximas etapas

1. Procurar resultados oficiais agregados e registar as fontes.
2. Substituir ou complementar os exemplos sintéticos com esses resultados.
3. Reavaliar o modelo quando houver mais eleições reais.
4. Descrever a futura ligação ao TrustVote sem alegar que já está integrada.