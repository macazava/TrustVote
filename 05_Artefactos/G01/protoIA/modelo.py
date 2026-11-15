"""Treina e executa uma previsão demonstrativa da percentagem de votos."""

# argparse: permite "--origem real" ou "--origem sintetico" na linha de comando.
# Decisão: argparse em vez de sys.argv ou input(). O argparse auto-documenta
# com --help, valida os valores permitidos (choices), e segue o formato standard
# de programas CLI. sys.argv não teria validação; input() seria interactivo
# e impossível de automatizar em scripts ou CI/CD.
import argparse

# defaultdict: simplifica o agrupamento por eleição sem verificar se a chave
# já existe. Em vez de "if key not in dict: dict[key] = []", basta fazer
# dict[key].append(valor) — o defaultdict cria a lista automaticamente.
from collections import defaultdict

# isfinite: protege contra NaN (Not a Number) ou inf (infinito) que o modelo
# poderia produzir em casos degenerados (ex: features com valores muito
# extremos ou todos idênticos). Sem esta verificação, o output poderia
# ser "Candidato: nan% dos votos" sem nenhum erro.
from math import isfinite

# Decisão: usamos LinearRegression (regressão linear) — o modelo mais simples
# possível. Porquê não algo mais avançado?
# 1. POUCOS DADOS: com apenas 6 amostras (3 listas × 2 pares de eleições),
#    modelos complexos (Random Forest, Redes Neurais) fariam overfitting —
#    decorariam os dados em vez de aprender padrões.
# 2. INTERPRETABILIDADE: a regressão linear produz coeficientes que podem ser
#    explicados: "por cada ponto a mais na eleição anterior, o modelo prevê
#    X pontos a mais na seguinte".
# 3. BASELINE HONESTA: num protótipo, começar pelo mais simples é correcto.
#    Se funcionar razoavelmente, modelos mais complexos são desnecessários.
#    Se não funcionar, o problema está nos dados, não no modelo.
# Alternativas rejeitadas:
# - Random Forest: com 6 amostras e 100 árvores, cada árvore veria ~4 amostras
#   — overfitting garantido. Faria sentido com centenas de eleições.
# - Redes Neurais: completamente desproporcional para tão poucos dados.
# - Média Móvel: não usa as features (participação, nº listas); seria mais pobre
#   e não demonstraria o conceito de machine learning.
from sklearn.linear_model import LinearRegression

# Decisão: MAE (Mean Absolute Error) como métrica em vez de MSE, RMSE ou R².
# O MAE é o mais INTUITIVO: "o modelo erra em média X pontos percentuais".
# Qualquer pessoa (mesmo não-técnica) entende isto.
# Alternativas rejeitadas:
# - MSE: penaliza erros grandes desproporcionalmente; "erro quadrático médio"
#   não diz nada a um stakeholder não-técnico.
# - R²: com apenas 3 amostras de teste, é extremamente instável e pode ser
#   negativo — "R² = -0.5" é difícil de explicar.
# - MAPE: problemática quando os valores reais são pequenos (divisão perto de 0).
from sklearn.metrics import mean_absolute_error

from dados import ResultadoEleitoral, carregar_resultados


# Cada linha do CSV representa uma lista numa eleição.
# Aqui agrupamos essas linhas para podermos comparar eleições completas.
def agrupar_por_eleicao(
    resultados: list[ResultadoEleitoral],
) -> list[tuple[str, list[ResultadoEleitoral]]]:
    grupos = defaultdict(list)
    for resultado in resultados:
        grupos[resultado.eleicao_id].append(resultado)

    # Decisão: ordenar por (ano, eleicao_id). O modelo precisa da ordem
    # cronológica para comparar eleições consecutivas. O eleicao_id é o
    # critério de desempate caso haja duas eleições no mesmo ano
    # (ex: eleição regular + eleição intercalar no mesmo ano).
    return sorted(
        grupos.items(),
        key=lambda item: (item[1][0].ano, item[0]),
    )


def criar_amostras(
    resultados: list[ResultadoEleitoral],
) -> tuple[list[list[float]], list[float], list[int]]:
    """Cria exemplos usando só a eleição anterior como entrada."""
    eleicoes = agrupar_por_eleicao(resultados)

    # Decisão: exigir pelo menos 3 eleições. Porquê exactamente 3?
    # Com 3 eleições criam-se 2 pares consecutivos: (2023→2024) e (2024→2025).
    # O código exige pelo menos 1 par para treino + 1 par para teste.
    # Com 2 eleições haveria apenas 1 par — insuficiente para treinar E testar.
    # Com 1 eleição não existe sequer comparação entre "antes" e "depois".
    if len(eleicoes) < 3:
        raise ValueError(
            "São necessárias pelo menos três eleições para treinar "
            "e testar uma previsão cronológica."
        )

    caracteristicas = []
    alvos = []
    anos_alvo = []

    # Para aprender, comparamos cada eleição com a eleição que aconteceu antes.
    # As características vêm da eleição anterior; o resultado a aprender vem da seguinte.
    # Exemplo com os dados actuais:
    #   Par 1: 2023 (anterior) → 2024 (actual) — "dado o que aconteceu em 2023, o que aconteceu em 2024?"
    #   Par 2: 2024 (anterior) → 2025 (actual) — "dado o que aconteceu em 2024, o que aconteceu em 2025?"
    for (_, anterior), (_, atual) in zip(eleicoes, eleicoes[1:]):
        listas_anteriores = {resultado.lista: resultado for resultado in anterior}

        # Decisão: para listas novas (que não existiam na eleição anterior),
        # usamos uma divisão igual (100/N) como estimativa da percentagem anterior.
        # Porquê divisão igual e não 0% ou 50%?
        # - 0% seria um viés negativo injusto — penaliza novatos
        # - 50% seria um viés positivo — com 3 candidatos, 50% é acima da média
        # - 100/N = 33.3% (para 3 listas) é NEUTRO — assume ignorância total,
        #   sem favorecer nenhum resultado. É a estimativa de máxima entropia.
        # Alternativa possível: usar a média real dos outros candidatos.
        # Seria mais sofisticado mas introduz complexidade e pode ser enviesado
        # pela composição específica daquela eleição.
        percentagem_base = 100 / len(anterior)
        participacao_anterior = anterior[0].participacao_pct
        numero_listas_atual = len(atual)

        for resultado in atual:
            resultado_anterior = listas_anteriores.get(resultado.lista)
            lista_nova = resultado_anterior is None
            percentagem_anterior = (
                resultado_anterior.percentagem_votos
                if resultado_anterior
                else percentagem_base
            )

            # === AS 4 FEATURES ESCOLHIDAS ===
            # Decisão: usamos exactamente 4 características. Porquê estas?
            #
            # Feature 1 — percentagem_anterior:
            #   "Quanto teve este candidato da última vez?"
            #   É o melhor preditor: o resultado passado é a base da previsão.
            #   Sem esta feature, o modelo não teria referência nenhuma.
            #
            # Feature 2 — lista_nova (0.0 ou 1.0):
            #   "Este candidato é novo ou já existia?"
            #   Listas novas não têm histórico real — o modelo precisa saber
            #   que a "percentagem anterior" é uma estimativa, não um facto.
            #   Nota: convertemos bool para float com float() explicitamente.
            #   O sklearn aceita True/False (Python trata True como 1), mas a
            #   conversão explícita documenta a intenção: é um valor numérico,
            #   não uma flag lógica.
            #
            # Feature 3 — participacao_anterior:
            #   "Quantas pessoas votaram da última vez?"
            #   Participação alta pode favorecer certos perfis de candidato.
            #   Contextualiza o resultado anterior.
            #
            # Feature 4 — numero_listas_atual:
            #   "Quantos candidatos concorrem agora?"
            #   Mais candidatos = votos mais divididos. Sem isto, o modelo não
            #   saberia se 30% é bom (5 candidatos) ou mau (2 candidatos).
            #
            # Porquê NÃO mais features?
            # Com 6 amostras, cada feature extra aumenta o risco de overfitting.
            # Regra prática: ter pelo menos 10-20 amostras por feature.
            # Com 6 amostras e 4 features já estamos no limite.
            # Features rejeitadas:
            # - Tendência (diferença t-1 vs t-2): precisaria de 3+ eleições por candidato
            # - Posição no ranking: redundante com a percentagem
            # - Interações (% × nº listas): sistema subdeterminado com tão poucos dados
            caracteristicas.append(
                [
                    percentagem_anterior,
                    float(lista_nova),
                    participacao_anterior,
                    float(numero_listas_atual),
                ]
            )
            alvos.append(resultado.percentagem_votos)
            anos_alvo.append(resultado.ano)

    return caracteristicas, alvos, anos_alvo


def selecionar_origem(
    resultados: list[ResultadoEleitoral], origem: str | None
) -> tuple[str, list[ResultadoEleitoral]]:
    # Decisão de SEGURANÇA: nunca misturar dados reais com sintéticos
    # automaticamente. Se o CSV contém ambos, o utilizador TEM de escolher
    # explicitamente com --origem. Porquê um erro e não um warning?
    # - Dados reais + sintéticos juntos produzem um modelo que PARECE treinado
    #   com dados reais mas está contaminado por ficção.
    # - Um professor/orientador poderia ver "previsão com dados reais" sem
    #   saber que metade dos dados são inventados.
    # - Warnings são ignorados — toda a gente faz scroll e não lê.
    # - Um erro OBRIGA a uma decisão consciente.
    # Alternativa possível: ficheiros separados (real.csv + sintetico.csv).
    # Seria ainda mais seguro (separação física), mas duplicaria o formato
    # e a lógica de leitura.
    origens_disponiveis = {resultado.origem for resultado in resultados}
    if origem is None:
        if len(origens_disponiveis) != 1:
            raise ValueError(
                "O CSV mistura dados reais e sintéticos. Escolha um conjunto "
                "explicitamente com --origem real ou --origem sintetico."
            )
        origem = next(iter(origens_disponiveis))

    selecionados = [
        resultado for resultado in resultados if resultado.origem == origem
    ]
    if not selecionados:
        raise ValueError(f"O CSV não contém linhas com origem '{origem}'.")
    return origem, selecionados


def prever_proxima_eleicao(
    modelo: LinearRegression, resultados: list[ResultadoEleitoral]
) -> list[tuple[str, float]]:
    eleicoes = agrupar_por_eleicao(resultados)
    _, ultima_eleicao = eleicoes[-1]

    # Decisão: assumimos lista_nova=0.0 (segundo valor) para todos os candidatos.
    # Porquê? Estamos a prever assumindo que os MESMOS candidatos voltam a
    # concorrer. É uma simplificação declarada na documentação ("mesmas listas").
    # Se quiséssemos prever com listas novas, seria preciso saber QUEM são
    # (informação que não existe). Possível melhoria futura: adicionar
    # --nova-lista "Nome" ao argparse para simular este cenário.
    percentagens_anteriores = [
        [
            resultado.percentagem_votos,
            0.0,
            resultado.participacao_pct,
            float(len(ultima_eleicao)),
        ]
        for resultado in ultima_eleicao
    ]

    previsoes_brutas = [float(valor) for valor in modelo.predict(percentagens_anteriores)]

    # === NORMALIZAÇÃO DAS PREVISÕES ===
    # Decisão: a regressão linear prevê cada candidato INDEPENDENTEMENTE.
    # Não sabe que as percentagens devem somar 100%. Pode prever:
    #   Taha-Wur: 35.2%, Maria: 38.1%, Fabio: 29.8% → Total: 103.1% (não soma 100%!)
    # Ou pior, com extrapolação agressiva:
    #   Taha-Wur: 32.0%, Maria: 41.0%, Fabio: -3.5% → negativo!
    #
    # Passo 1: max(0.0, valor) — percentagens não podem ser negativas.
    # Passo 2: valor / soma * 100 — reescala para somar exactamente 100%.
    #
    # Alternativa rejeitada: Softmax (exp(x)/sum(exp(x))). Garantiria valores
    # positivos automaticamente, mas distorce as proporções — a exponencial
    # amplifica diferenças. Desproporcionado para este contexto.
    # Alternativa ideal (mas complexa): Dirichlet Regression — modelo que
    # prevê distribuições por construção. Não existe directamente no sklearn
    # e seria exagerado para um protótipo.
    previsoes_positivas = [max(0.0, valor) for valor in previsoes_brutas]
    soma = sum(previsoes_positivas)

    # Decisão: verificar isfinite(soma) e soma > 0.
    # Se todos os valores fossem negativos (após max(0,...) todos seriam 0),
    # a soma seria 0 e haveria divisão por zero → crash ou inf/nan.
    # O isfinite protege contra NaN ou inf de operações degeneradas no sklearn.
    if not isfinite(soma) or soma <= 0:
        raise ValueError(
            "O modelo não produziu percentagens positivas para normalizar."
        )

    return [
        (resultado.lista, valor / soma * 100)
        for resultado, valor in zip(ultima_eleicao, previsoes_positivas)
    ]


def executar(origem_pedida: str | None) -> None:
    resultados_csv = carregar_resultados()
    origem, resultados = selecionar_origem(resultados_csv, origem_pedida)
    caracteristicas, alvos, anos = criar_amostras(resultados)

    # === SEPARAÇÃO TREINO/TESTE CRONOLÓGICA ===
    # Decisão: separamos por ANO, não aleatoriamente. Porquê NÃO usar
    # train_test_split do sklearn?
    # Porque a separação aleatória em dados temporais é um ERRO GRAVE
    # chamado "data leakage" (fuga de dados do futuro para o passado):
    #   Separação aleatória (ERRADO):
    #     Treino: 2023, 2025  → o modelo "vê" 2025
    #     Teste:  2024        → e prevê 2024, que é ANTES!
    #     → O modelo usa informação do FUTURO para prever o PASSADO
    #   Separação cronológica (CORRECTO):
    #     Treino: 2023→2024   → aprende com o passado
    #     Teste:  2025        → testa no futuro desconhecido
    #     → Simula a situação real de previsão
    # Se usássemos separação aleatória, o erro reportado seria artificialmente
    # baixo e a avaliação não corresponderia à performance real.
    # Alternativa possível: TimeSeriesSplit do sklearn. Seria mais robusto,
    # mas com apenas 2 pares há 1 única forma de dividir — não acrescenta nada.
    # Faria sentido com 10+ eleições.
    ano_teste = max(anos)
    indices_treino = [i for i, ano in enumerate(anos) if ano < ano_teste]
    indices_teste = [i for i, ano in enumerate(anos) if ano == ano_teste]
    if not indices_treino or not indices_teste:
        raise ValueError(
            "Não foi possível separar eleições antigas para treino "
            "e a mais recente para teste."
        )

    # === DOIS MODELOS SEPARADOS ===
    # Decisão: criamos dois objectos LinearRegression distintos em vez de
    # reutilizar um. Porquê?
    #
    # Modelo 1 (modelo_teste): treina SÓ com dados antigos (2023→2024).
    # Serve apenas para calcular o erro — "quão bem o modelo prevê quando
    # não viu os dados de teste?"
    modelo_teste = LinearRegression()
    modelo_teste.fit(
        [caracteristicas[i] for i in indices_treino],
        [alvos[i] for i in indices_treino],
    )
    valores_teste = [alvos[i] for i in indices_teste]
    previsoes_teste = modelo_teste.predict(
        [caracteristicas[i] for i in indices_teste]
    )
    # O erro médio indica, em média, quantos pontos percentuais o modelo falhou
    # ao prever os resultados do teste.
    erro_medio = mean_absolute_error(valores_teste, previsoes_teste)
    ano_treino_maximo = max(anos[i] for i in indices_treino)

    # Modelo 2 (modelo_final): treina com TODOS os dados (incluindo 2025).
    # Porquê não reutilizar o modelo_teste?
    # Porque o modelo_teste NÃO VIU os dados de 2025. Se o usássemos para
    # prever 2026, estaríamos a desperdiçar os dados mais recentes — que são
    # precisamente os mais relevantes para prever o futuro.
    # Porquê não treinar só um modelo com tudo e não avaliar?
    # Porque não haveria nenhuma medida de qualidade. Seria "confiar cegamente"
    # — inaceitável num contexto eleitoral.
    modelo_final = LinearRegression()
    modelo_final.fit(caracteristicas, alvos)
    previsoes = prever_proxima_eleicao(modelo_final, resultados)

    # Decisão: aviso explícito quando os dados são sintéticos.
    # Transparência obrigatória — sem este aviso, alguém poderia interpretar
    # os números como uma previsão real. Num contexto de eleições, apresentar
    # ficção como facto seria irresponsável.
    if origem == "sintetico":
        print("AVISO: demonstração com dados sintéticos; não representa resultados reais.")
    print(
        f"Validação cronológica: treino até {ano_treino_maximo}, "
        f"teste em {ano_teste}; erro absoluto médio: {erro_medio:.2f} "
        "pontos percentuais."
    )
    print("Estimativa demonstrativa para a próxima eleição (mesmas listas):")
    for lista, percentagem in previsoes:
        print(f"  {lista}: {percentagem:.2f}% dos votos válidos")


def main() -> None:
    # Decisão: usamos argparse com choices=("real", "sintetico").
    # O "choices" faz validação automática: se alguém escrever "--origem rial"
    # (typo), recebe erro claro em vez de o programa produzir resultado vazio.
    parser = argparse.ArgumentParser(
        description="Prevê percentagens de votos a partir de resultados anteriores."
    )
    parser.add_argument(
        "--origem",
        choices=("real", "sintetico"),
        help="Escolhe a origem dos dados quando o CSV contém ambas.",
    )
    argumentos = parser.parse_args()

    # Decisão: converter ValueError em parser.error().
    # parser.error() imprime a mensagem, mostra o "usage:" do programa, e
    # sai com código de saída 2 (standard para erros de argumentos).
    # Uma ValueError raw imprimiria um traceback Python com 10+ linhas de
    # internals — intimidante para um utilizador não-técnico.
    # Código de saída: 2 (erro de argumentos) em vez de 1 (erro genérico).
    try:
        executar(argumentos.origem)
    except ValueError as erro:
        parser.error(str(erro))


# Decisão: o guard "if __name__" permite usar este ficheiro de duas formas:
# 1. Como script: "python modelo.py" → executa main()
# 2. Como módulo: "from modelo import criar_amostras" → NÃO executa main()
# Sem isto, fazer "import modelo" para testes executaria imediatamente a previsão.
if __name__ == "__main__":
    main()
