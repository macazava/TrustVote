"""Treina e executa uma previsão demonstrativa da percentagem de votos."""

import argparse
from collections import defaultdict
from math import isfinite

from sklearn.linear_model import LinearRegression
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

    return sorted(
        grupos.items(),
        key=lambda item: (item[1][0].ano, item[0]),
    )


def criar_amostras(
    resultados: list[ResultadoEleitoral],
) -> tuple[list[list[float]], list[float], list[int]]:
    """Cria exemplos usando só a eleição anterior como entrada."""
    eleicoes = agrupar_por_eleicao(resultados)
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
    for (_, anterior), (_, atual) in zip(eleicoes, eleicoes[1:]):
        listas_anteriores = {resultado.lista: resultado for resultado in anterior}
        # Se uma lista não existia na eleição anterior, usamos uma divisão igual
        # como estimativa inicial. Isto é apenas uma regra simples para o protótipo.
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
    # Mantemos separados os dados reais e os sintéticos para não misturar
    # resultados oficiais com exemplos inventados.
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
    # As previsões das listas podem não somar 100%, por isso ajustamo-las
    # para formar uma distribuição percentual.
    previsoes_positivas = [max(0.0, valor) for valor in previsoes_brutas]
    soma = sum(previsoes_positivas)
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

    # Usamos a eleição mais recente como teste, como se ainda não conhecêssemos
    # os resultados dela.
    ano_teste = max(anos)
    indices_treino = [i for i, ano in enumerate(anos) if ano < ano_teste]
    indices_teste = [i for i, ano in enumerate(anos) if ano == ano_teste]
    if not indices_treino or not indices_teste:
        raise ValueError(
            "Não foi possível separar eleições antigas para treino "
            "e a mais recente para teste."
        )

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

    # Depois do teste, treinamos com todos os dados para produzir a estimativa final.
    modelo_final = LinearRegression()
    modelo_final.fit(caracteristicas, alvos)
    previsoes = prever_proxima_eleicao(modelo_final, resultados)

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
    parser = argparse.ArgumentParser(
        description="Prevê percentagens de votos a partir de resultados anteriores."
    )
    parser.add_argument(
        "--origem",
        choices=("real", "sintetico"),
        help="Escolhe a origem dos dados quando o CSV contém ambas.",
    )
    argumentos = parser.parse_args()

    try:
        executar(argumentos.origem)
    except ValueError as erro:
        parser.error(str(erro))


if __name__ == "__main__":
    main()