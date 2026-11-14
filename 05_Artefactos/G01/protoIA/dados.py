"""Leitura e validação dos resultados eleitorais agregados do protótipo."""

import csv
from dataclasses import dataclass
from pathlib import Path


# Todas as colunas que o CSV tem de ter para o protótipo funcionar.
COLUNAS_OBRIGATORIAS = {
    "eleicao_id",
    "ano",
    "lista",
    "votos_lista",
    "votos_validos",
    "participacao_pct",
    "origem",
    "fonte",
}
# Os dados podem ser reais (oficiais) ou sintéticos (inventados para demonstração).
ORIGENS_PERMITIDAS = {"real", "sintetico"}


# Cada objecto deste tipo guarda os dados de uma lista numa eleição.
# "frozen=True" impede alterações acidentais depois de criado.
@dataclass(frozen=True)
class ResultadoEleitoral:
    eleicao_id: str
    ano: int
    lista: str
    votos_lista: int
    votos_validos: int
    participacao_pct: float
    origem: str
    fonte: str

    # Calcula a percentagem de votos desta lista em relação ao total de votos válidos.
    @property
    def percentagem_votos(self) -> float:
        return self.votos_lista / self.votos_validos * 100


def carregar_resultados(caminho: Path | None = None) -> list[ResultadoEleitoral]:
    """Carrega o CSV e rejeita registos incompletos ou inconsistentes."""
    # Se não nos deram um caminho, procuramos "dados.csv" na mesma pasta deste script.
    ficheiro = caminho or Path(__file__).with_name("dados.csv")

    with ficheiro.open(encoding="utf-8-sig", newline="") as arquivo:
        leitor = csv.DictReader(arquivo)
        if leitor.fieldnames is None:
            raise ValueError(f"O ficheiro {ficheiro} não tem cabeçalho.")

        # Verificamos que o CSV tem todas as colunas necessárias.
        colunas_em_falta = COLUNAS_OBRIGATORIAS - set(leitor.fieldnames)
        if colunas_em_falta:
            nomes = ", ".join(sorted(colunas_em_falta))
            raise ValueError(f"Faltam colunas obrigatórias no CSV: {nomes}.")

        resultados = []
        chaves_vistas = set()
        dados_por_eleicao = {}

        # Lemos o CSV linha a linha, convertemos os valores, e validamos tudo.
        for numero_linha, linha in enumerate(leitor, start=2):
            try:
                resultado = ResultadoEleitoral(
                    eleicao_id=linha["eleicao_id"].strip(),
                    ano=int(linha["ano"]),
                    lista=linha["lista"].strip(),
                    votos_lista=int(linha["votos_lista"]),
                    votos_validos=int(linha["votos_validos"]),
                    participacao_pct=float(linha["participacao_pct"]),
                    origem=linha["origem"].strip().lower(),
                    fonte=linha["fonte"].strip(),
                )
            except (TypeError, ValueError) as erro:
                raise ValueError(
                    f"Valores inválidos na linha {numero_linha} do CSV."
                ) from erro

            # Verificações de integridade: valores dentro de limites razoáveis.
            if not resultado.eleicao_id or not resultado.lista or not resultado.fonte:
                raise ValueError(
                    f"Eleição, lista e fonte são obrigatórias (linha {numero_linha})."
                )
            if resultado.ano < 1900:
                raise ValueError(f"Ano inválido na linha {numero_linha}.")
            if resultado.votos_lista < 0 or resultado.votos_validos <= 0:
                raise ValueError(f"Contagem de votos inválida na linha {numero_linha}.")
            if resultado.votos_lista > resultado.votos_validos:
                raise ValueError(
                    f"Votos da lista excedem os votos válidos "
                    f"(linha {numero_linha})."
                )
            if not 0 <= resultado.participacao_pct <= 100:
                raise ValueError(
                    f"Participação fora do intervalo 0–100 "
                    f"(linha {numero_linha})."
                )
            if resultado.origem not in ORIGENS_PERMITIDAS:
                raise ValueError(
                    f"Origem deve ser 'real' ou 'sintetico' "
                    f"(linha {numero_linha})."
                )

            # A mesma lista não pode aparecer duas vezes na mesma eleição.
            chave = (resultado.eleicao_id, resultado.lista)
            if chave in chaves_vistas:
                raise ValueError(
                    f"Lista repetida na mesma eleição (linha {numero_linha})."
                )
            chaves_vistas.add(chave)

            # Dentro da mesma eleição, o ano, votos válidos e participação
            # devem ser iguais em todas as listas.
            resumo = (
                resultado.ano,
                resultado.votos_validos,
                resultado.participacao_pct,
            )
            anterior = dados_por_eleicao.setdefault(resultado.eleicao_id, resumo)
            if anterior != resumo:
                raise ValueError(
                    f"Ano, votos válidos e participação devem ser iguais "
                    f"em todas as listas da eleição {resultado.eleicao_id}."
                )

            resultados.append(resultado)

    if not resultados:
        raise ValueError(f"O ficheiro {ficheiro} não contém resultados.")

    return resultados


def main() -> None:
    resultados = carregar_resultados()
    print(
        f"Resultados carregados: {len(resultados)} linhas, "
        f"{len({r.eleicao_id for r in resultados})} eleições."
    )
    for resultado in resultados:
        print(
            f"{resultado.ano} | {resultado.lista} | "
            f"{resultado.percentagem_votos:.1f}% | origem={resultado.origem}"
        )


if __name__ == "__main__":
    main()