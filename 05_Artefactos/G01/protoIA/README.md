# Protótipo IA — Previsão Demonstrativa de Votos

## O que é isto?

Este protótipo é uma **demonstração técnica** que mostra como seria possível
usar inteligência artificial (neste caso, um modelo de regressão linear) para
**estimar a percentagem de votos** que cada lista/candidato poderá obter numa
eleição futura, com base nos resultados de eleições anteriores.

> **⚠️ IMPORTANTE:** Os dados atuais são **totalmente fictícios** (sintéticos).
> O protótipo existe apenas para validar o conceito e o formato dos dados.
> Não deve ser interpretado como uma previsão real de qualquer eleição.

---

## Ficheiros do protótipo

O protótipo é composto por **4 ficheiros**, cada um com uma responsabilidade clara:

```
protoIA/
├── dados.csv          ← Os dados das eleições (entrada do sistema)
├── dados.py           ← Lê e valida o CSV, rejeita dados incorretos
├── modelo.py          ← Treina o modelo de IA e produz a previsão
└── requirements.txt   ← Biblioteca externa necessária (scikit-learn)
```

### `dados.csv` — Os dados de entrada

Contém os resultados eleitorais organizados em linhas. Cada linha representa
**uma lista/candidato numa eleição específica**. Atualmente tem 3 eleições
fictícias (2023, 2024, 2025), cada uma com 3 candidatos:

| Candidato | Papel nos dados |
|---|---|
| **Taha-Wur Pereira** | Candidato com mais votos nas primeiras eleições |
| **Maria Camila** | Candidata que cresce ao longo das eleições |
| **Fabio Romulo** | Candidato que mantém uma posição mais baixa |

### `dados.py` — Leitura e validação

Este script lê o ficheiro `dados.csv` e verifica se está tudo correto antes
de o entregar ao modelo. Funciona como um **filtro de qualidade** que rejeita
dados inválidos com mensagens de erro claras. Por exemplo, verifica:

- Se todas as colunas obrigatórias existem
- Se os números de votos fazem sentido (não negativos, lista ≤ total)
- Se a participação está entre 0% e 100%
- Se não há listas duplicadas na mesma eleição
- Se os totais são consistentes dentro de cada eleição

### `modelo.py` — O modelo de IA

Este é o coração do protótipo. Faz três coisas, por ordem:

1. **Teste** — Treina com as eleições mais antigas e testa na mais recente
   (como se não soubéssemos o resultado), para medir a qualidade da previsão
2. **Treino final** — Depois do teste, treina com **todos** os dados
3. **Previsão** — Usa o modelo treinado para estimar a próxima eleição

### `requirements.txt` — Dependências

Lista a biblioteca `scikit-learn` (versão ≥ 1.7), que fornece o algoritmo
de regressão linear usado pelo modelo.

---

## Formato do CSV — Coluna a coluna

Cada linha do `dados.csv` representa **uma lista numa eleição**. Eis o
significado de cada coluna, com exemplos concretos:

| Coluna | O que significa | Exemplo | Porquê? |
|---|---|---|---|
| `eleicao_id` | Identificador único da eleição | `demo-2025` | Agrupa todas as listas que concorreram na mesma eleição |
| `ano` | Ano em que a eleição aconteceu | `2025` | Permite ordenar as eleições no tempo (o modelo precisa da ordem cronológica) |
| `lista` | Nome do candidato ou lista | `Taha-Wur Pereira` | Identifica quem concorreu; o modelo compara a mesma lista entre eleições |
| `votos_lista` | Votos válidos que esta lista recebeu | `440` | Numerador da percentagem — quantos votos este candidato teve |
| `votos_validos` | Total de votos válidos na eleição | `1200` | Denominador da percentagem — é igual para todas as listas da mesma eleição |
| `participacao_pct` | Percentagem de eleitores que votaram | `55.0` | O modelo usa a participação como uma característica para aprender tendências |
| `origem` | Se os dados são reais ou inventados | `sintetico` | Impede que dados fictícios se misturem com resultados oficiais |
| `fonte` | De onde vieram os dados | `Dados ficticios...` | Rastreabilidade — permite verificar a origem de cada resultado |

**Como se calcula a percentagem de votos:**

```
percentagem = votos_lista ÷ votos_validos × 100

Exemplo: Taha-Wur Pereira em 2025
  440 ÷ 1200 × 100 = 36.67% dos votos válidos
```

---

## Como funciona a previsão — Passo a passo

### Passo 1: Agrupar por eleição

O CSV tem uma linha por lista. O primeiro passo é agrupar essas linhas para
termos uma visão completa de cada eleição (quem concorreu e quanto teve).

### Passo 2: Criar pares de eleições consecutivas

Para o modelo aprender, comparamos cada eleição com a que veio antes.
Por exemplo:

```
2023 → 2024 : "Na eleição de 2023 aconteceu X. Na de 2024 o resultado foi Y."
2024 → 2025 : "Na eleição de 2024 aconteceu X. Na de 2025 o resultado foi Y."
```

O modelo recebe as **características da eleição anterior** (o X) e tenta
aprender a prever o **resultado da eleição seguinte** (o Y).

### Passo 3: Escolher as características

Para cada lista em cada eleição, o modelo recebe 4 valores de entrada:

| # | Característica | Significado simples |
|---|---|---|
| 1 | Percentagem anterior | "Quanto teve este candidato da última vez?" |
| 2 | Lista nova (0 ou 1) | "Este candidato é novo ou já existia antes?" |
| 3 | Participação anterior | "Quantas pessoas votaram da última vez?" |
| 4 | Número de listas | "Quantos candidatos concorrem agora?" |

Se uma lista não existia na eleição anterior (é nova), usa-se uma **divisão
igual** como estimativa (ex: se havia 3 listas, cada uma "teria" ~33.3%).

### Passo 4: Testar antes de prever

Antes de produzir uma previsão, o modelo é testado para ver se funciona:

```
Treino:  eleições de 2023–2024 (usadas para aprender)
Teste:   eleição de 2025 (usada para avaliar — como se não soubéssemos o resultado)
```

O **erro absoluto médio** (MAE) diz, em média, quantos pontos percentuais o
modelo errou. Por exemplo, um MAE de 3.5 significa que, em média, a previsão
falhou por 3.5 pontos percentuais em relação ao resultado real.

### Passo 5: Prever a próxima eleição

Depois do teste, o modelo é treinado com **todos** os dados (incluindo 2025)
e produz uma estimativa para a eleição seguinte, assumindo que os mesmos
candidatos voltam a concorrer. As previsões são ajustadas para somarem 100%.

---

## Como executar

### 1. Abrir o terminal na pasta do protótipo

```powershell
cd "C:\Users\alexr\Desktop\TrustVote\05_Artefactos\G01\protoIA"
```

### 2. Instalar a dependência (só na primeira vez)

```powershell
python -m pip install -r requirements.txt
```

### 3. Verificar os dados

```powershell
python dados.py
```

Resultado esperado — mostra todas as linhas do CSV com as percentagens:

```
Resultados carregados: 9 linhas, 3 eleições.
2023 | Taha-Wur Pereira | 42.0% | origem=sintetico
2023 | Maria Camila      | 35.0% | origem=sintetico
2023 | Fabio Romulo       | 23.0% | origem=sintetico
...
```

### 4. Executar a previsão

```powershell
python modelo.py
```

Resultado esperado — mostra o erro do teste e a estimativa:

```
AVISO: demonstração com dados sintéticos; não representa resultados reais.
Validação cronológica: treino até 2024, teste em 2025; erro absoluto médio: X.XX pontos percentuais.
Estimativa demonstrativa para a próxima eleição (mesmas listas):
  Taha-Wur Pereira: XX.XX% dos votos válidos
  Maria Camila: XX.XX% dos votos válidos
  Fabio Romulo: XX.XX% dos votos válidos
```

### 5. Escolher a origem (quando houver dados reais e sintéticos)

Se o CSV tiver linhas com `origem=real` **e** `origem=sintetico`, o programa
pede que se escolha explicitamente:

```powershell
python modelo.py --origem real        # usa só dados oficiais
python modelo.py --origem sintetico   # usa só dados fictícios
```

---

## Estado atual dos dados

Ainda **não foi confirmada** uma fonte pública oficial com resultados de votos
da Associação de Estudantes da Universidade Europeia. O ficheiro `dados.csv`
contém **apenas dados sintéticos** (inventados para testar o formato).

### Quando forem encontrados resultados oficiais:

1. **Confirmar** os valores numa ata, comunicado ou publicação oficial
2. **Acrescentar** os resultados agregados ao CSV (sem dados pessoais)
3. **Indicar** `real` na coluna `origem`
4. **Guardar** o URL ou referência na coluna `fonte`
5. **Manter** as linhas sintéticas identificadas como `sintetico`

---

## Limitações — O que este protótipo NÃO faz

| Limitação | Explicação |
|---|---|
| **Dados fictícios** | Os exemplos atuais são inventados — a métrica calculada não demonstra capacidade de prever eleições reais |
| **Poucas eleições** | Apenas 3 eleições de exemplo; a avaliação é muito instável com tão poucos dados |
| **Só percentagens** | Prevê percentagem de votos válidos, não o número absoluto de votos |
| **Mesmas listas** | Assume que os candidatos da última eleição voltam a concorrer |
| **Sem integração** | Não está ligado ao backend nem à base de dados do TrustVote |
| **Modelo simples** | A regressão linear é o algoritmo mais básico — serve para demonstrar o conceito |

---

## Próximas etapas

1. 🔍 Procurar resultados oficiais agregados e registar as fontes
2. 📊 Substituir ou complementar os exemplos sintéticos com resultados reais
3. 🧪 Reavaliar o modelo quando houver mais eleições reais
4. 🔗 Descrever a futura ligação ao TrustVote sem alegar que já está integrada
5. 🤖 Considerar modelos mais avançados se houver dados suficientes
