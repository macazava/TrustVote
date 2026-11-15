"""Leitura e validação dos resultados eleitorais agregados do protótipo."""

# Usamos o módulo "csv" da biblioteca padrão do Python em vez do Pandas.
# Decisão: o ficheiro tem apenas 9 linhas — o Pandas (~30 MB de dependências)
# seria desproporcional. O módulo "csv" já faz tudo o que precisamos: lê linhas
# e devolve dicionários. Menos dependências = menos risco de incompatibilidades.
# Se o CSV crescesse para milhares de linhas, migraríamos para Pandas.
import csv

# Usamos dataclass em vez de dicionários simples.
# Decisão: a dataclass gera automaticamente __init__, __repr__ e __eq__,
# poupando ~20 linhas de código repetitivo. Além disso, dá type-safety
# (o IDE avisa se escrevermos "resultado.amo" em vez de "resultado.ano")
# e impede erros de ortografia nas chaves (que um dicionário não apanharia).
from dataclasses import dataclass

# Usamos Path em vez de strings para caminhos de ficheiros.
# Decisão: Path é multiplataforma (funciona em Windows e Linux sem alterar
# barras), tem métodos úteis como .with_name() e .open(), e torna o código
# mais legível do que concatenar strings com os.path.join().
from pathlib import Path


# Todas as colunas que o CSV tem de ter para o protótipo funcionar.
# Decisão: definidas como set (conjunto) para podermos calcular a diferença
# de conjuntos (COLUNAS_OBRIGATORIAS - colunas_do_ficheiro) de forma eficiente
# e encontrar quais colunas faltam. Uma lista não permitiria esta operação
# directamente. Centralizar aqui significa que, se adicionarmos uma coluna
# nova no futuro, basta mudar este set — todo o resto adapta-se.
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
# Decisão: centralizar os valores permitidos num set facilita a manutenção.
# Se amanhã surgir uma terceira origem (ex: "parcial" para dados incompletos),
# muda-se apenas aqui. O set também permite verificação O(1) com "in".
ORIGENS_PERMITIDAS = {"real", "sintetico"}


# Cada objecto deste tipo guarda os dados de uma lista numa eleição.
# Decisão: usamos "frozen=True" para tornar o objecto IMUTÁVEL. Depois de
# criado, nenhum campo pode ser alterado (resultado.votos_lista = 999 lançaria
# FrozenInstanceError). Em dados eleitorais, imutabilidade é integridade —
# se um bug pudesse alterar votos em memória, o sistema seria inseguro.
# Alternativa rejeitada: NamedTuple também seria imutável, mas não suporta
# @property directamente e herda de tuple (resultado[0] retornaria o eleicao_id,
# o que seria confuso).
# Alternativa rejeitada: dicionário — sem tipos, sem auto-complete, sem imutabilidade.
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

    # Decisão: a percentagem é calculada como @property em vez de armazenada
    # como campo. Isto garante que está SEMPRE correcta em relação aos votos.
    # Se fosse um campo, alguém poderia criar um objecto com votos_lista=420,
    # votos_validos=1000, percentagem=50.0 — uma inconsistência silenciosa.
    # Com @property, a percentagem é derivada: impossível estar errada
    # (a menos que os votos estejam errados, o que é validado antes).
    # Para 9 linhas, o custo de recalcular é irrelevante.
    @property
    def percentagem_votos(self) -> float:
        return self.votos_lista / self.votos_validos * 100


def carregar_resultados(caminho: Path | None = None) -> list[ResultadoEleitoral]:
    """Carrega o CSV e rejeita registos incompletos ou inconsistentes."""

    # Decisão: usamos Path(__file__).with_name("dados.csv") em vez de um
    # caminho relativo como "dados.csv". Porquê? Se alguém executar o script
    # de outra pasta (ex: "cd Desktop && python TrustVote/.../dados.py"),
    # um caminho relativo procuraria "dados.csv" no Desktop — que não existe.
    # Com __file__, procuramos sempre na pasta do script, independentemente
    # do directório de trabalho do terminal.
    # O parâmetro opcional permite passar caminhos custom (útil para testes).
    ficheiro = caminho or Path(__file__).with_name("dados.csv")

    # Decisão sobre encoding: usamos "utf-8-sig" em vez de "utf-8".
    # O Windows e o Excel frequentemente adicionam um BOM (Byte Order Mark) —
    # 3 bytes invisíveis (\xef\xbb\xbf) no início do ficheiro. Com "utf-8",
    # esses bytes ficam colados ao nome da primeira coluna, causando:
    #   fieldnames → ['\xef\xbb\xbfeleicao_id', 'ano', ...]
    # A validação falharia: "falta coluna eleicao_id" — porque tem o BOM antes!
    # Com "utf-8-sig", o BOM é removido automaticamente. Se não existir BOM,
    # comporta-se exactamente como "utf-8". Zero desvantagens.
    #
    # Decisão sobre newline="": exigido pela documentação oficial do módulo csv.
    # Sem isto, em Windows, os fins de linha \r\n podem ser processados
    # duplamente (uma vez pelo Python, outra pelo csv), causando linhas
    # em branco fantasma entre os registos reais.
    with ficheiro.open(encoding="utf-8-sig", newline="") as arquivo:
        leitor = csv.DictReader(arquivo)
        if leitor.fieldnames is None:
            raise ValueError(f"O ficheiro {ficheiro} não tem cabeçalho.")

        # Decisão: verificamos as colunas ANTES de ler qualquer linha.
        # Princípio "fail fast" — se o CSV foi aberto no Excel e gravado mal
        # (ex: colunas com nomes trocados), esta validação apanha o problema
        # imediatamente, com mensagem clara. Sem isto, o modelo falharia muito
        # mais tarde com um KeyError críptico tipo "KeyError: 'votos_lista'".
        # A operação de conjuntos (set - set) encontra eficientemente quais
        # colunas faltam. O sorted() garante que a mensagem é determinística
        # (sets não têm ordem garantida).
        colunas_em_falta = COLUNAS_OBRIGATORIAS - set(leitor.fieldnames)
        if colunas_em_falta:
            nomes = ", ".join(sorted(colunas_em_falta))
            raise ValueError(f"Faltam colunas obrigatórias no CSV: {nomes}.")

        resultados = []
        chaves_vistas = set()       # Para detectar listas duplicadas na mesma eleição
        dados_por_eleicao = {}      # Para verificar consistência dentro de cada eleição

        # Decisão: enumerate(leitor, start=2) começa a contar na linha 2 porque
        # a linha 1 do ficheiro é o cabeçalho (consumido pelo DictReader).
        # Assim, as mensagens de erro dizem "erro na linha 5" e o utilizador
        # pode abrir o CSV e ir directamente à linha 5. Se começássemos em 0
        # ou 1, o número não corresponderia à linha real no ficheiro.
        for numero_linha, linha in enumerate(leitor, start=2):
            # Decisão: fazemos a conversão de tipos (int, float) dentro de
            # try/except para apanhar células vazias, texto onde devia haver
            # número, ou valores mal formatados. A mensagem indica exactamente
            # qual linha tem o problema.
            try:
                resultado = ResultadoEleitoral(
                    eleicao_id=linha["eleicao_id"].strip(),
                    ano=int(linha["ano"]),
                    lista=linha["lista"].strip(),
                    votos_lista=int(linha["votos_lista"]),
                    votos_validos=int(linha["votos_validos"]),
                    participacao_pct=float(linha["participacao_pct"]),
                    # Decisão: .strip().lower() na origem é programação defensiva.
                    # Quem edita o CSV (possivelmente em Excel) pode inadvertidamente
                    # escrever "Sintetico", "SINTETICO", ou " sintetico ".
                    # Sem normalização, esses valores falhariam na validação
                    # (not in ORIGENS_PERMITIDAS), mesmo estando conceptualmente
                    # correctos. O .strip() remove espaços; o .lower() normaliza
                    # maiúsculas. Reduz frustração do utilizador.
                    origem=linha["origem"].strip().lower(),
                    fonte=linha["fonte"].strip(),
                )
            except (TypeError, ValueError) as erro:
                raise ValueError(
                    f"Valores inválidos na linha {numero_linha} do CSV."
                ) from erro

            # === VALIDAÇÕES DE INTEGRIDADE ===
            # Cada validação existe para apanhar um tipo específico de erro
            # ANTES de chegar ao modelo, com mensagem clara. Sem estas
            # verificações, o modelo treinaria com dados absurdos e as
            # previsões não teriam sentido — mas nenhum erro seria reportado.

            # Campos obrigatórios não podem ser strings vazias.
            # (Uma eleição sem ID ou uma lista sem nome não faz sentido.)
            if not resultado.eleicao_id or not resultado.lista or not resultado.fonte:
                raise ValueError(
                    f"Eleição, lista e fonte são obrigatórias (linha {numero_linha})."
                )

            # Sanity check: exclui erros como ano=0 ou ano=-1.
            # O valor 1900 é arbitrário mas razoável para este contexto.
            if resultado.ano < 1900:
                raise ValueError(f"Ano inválido na linha {numero_linha}.")

            # Votos não podem ser negativos; votos_validos > 0 é obrigatório
            # porque é o denominador da percentagem (divisão por zero).
            if resultado.votos_lista < 0 or resultado.votos_validos <= 0:
                raise ValueError(f"Contagem de votos inválida na linha {numero_linha}.")

            # Impossibilidade lógica: uma lista não pode ter mais votos que
            # o total. Se isto acontecer, o CSV tem um erro de digitação.
            # Sem esta validação, a percentagem seria > 100% (ex: 150%) e
            # o modelo aceitaria silenciosamente dados impossíveis.
            if resultado.votos_lista > resultado.votos_validos:
                raise ValueError(
                    f"Votos da lista excedem os votos válidos "
                    f"(linha {numero_linha})."
                )

            # Participação é uma percentagem: tem limites naturais de 0 a 100.
            if not 0 <= resultado.participacao_pct <= 100:
                raise ValueError(
                    f"Participação fora do intervalo 0–100 "
                    f"(linha {numero_linha})."
                )

            # Valor controlado: só aceitamos "real" ou "sintetico".
            # (O .lower() na linha acima já normalizou maiúsculas.)
            if resultado.origem not in ORIGENS_PERMITIDAS:
                raise ValueError(
                    f"Origem deve ser 'real' ou 'sintetico' "
                    f"(linha {numero_linha})."
                )

            # Decisão: a mesma lista não pode aparecer duas vezes na mesma eleição.
            # Se aparecesse, as contagens seriam inconsistentes e o modelo
            # receberia dados contraditórios. Usamos um set de tuplos
            # (eleicao_id, lista) para detecção O(1).
            chave = (resultado.eleicao_id, resultado.lista)
            if chave in chaves_vistas:
                raise ValueError(
                    f"Lista repetida na mesma eleição (linha {numero_linha})."
                )
            chaves_vistas.add(chave)

            # Decisão: dentro da mesma eleição, o ano, votos válidos e participação
            # devem ser IGUAIS em todas as listas. Se uma linha diz
            # votos_validos=1000 e outra diz votos_validos=1100 para a mesma
            # eleição, algo está errado — as percentagens seriam inconsistentes.
            #
            # Usamos setdefault() em vez de "if key in dict / else".
            # O setdefault guarda o primeiro resumo e retorna-o; para os seguintes,
            # apenas retorna o existente. É idiomático Python — faz o mesmo que:
            #   if eleicao_id in dados_por_eleicao:
            #       if dados_por_eleicao[eleicao_id] != resumo: raise ...
            #   else:
            #       dados_por_eleicao[eleicao_id] = resumo
            # ... mas numa única linha.
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

    # Última verificação: o ficheiro pode existir e ter cabeçalho mas zero linhas de dados.
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


# Decisão: o guard "if __name__" permite usar este ficheiro de duas formas:
# 1. Como script: "python dados.py" → executa main() e mostra os dados
# 2. Como módulo: "from dados import carregar_resultados" → NÃO executa main()
# Sem isto, fazer "import dados" para testes executaria imediatamente o print.
if __name__ == "__main__":
    main()
