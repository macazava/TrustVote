/* Controller · área da equipa, separador "Resultados": junta os dados de cada eleição e exporta o CSV */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, elections, download } = TV;
  const { percent, slug } = TV.format;
  const { resultRows } = TV.results;
  const { panel, attempt } = TV.panels;

  async function renderResults() {
    const el = panel("results");
    const lista = await api.eleicoes.listar();
    const aDecorrer = lista.filter((e) => e.estado === "em_curso");
    const anteriores = lista.filter((e) => e.estado === "encerrada");
    const todas = [...aDecorrer, ...anteriores];
    const [detalhes, estatisticas, resultados] = await Promise.all([
      Promise.all(todas.map((e) => api.eleicoes.detalhe(e.id).then(elections.view))),
      Promise.all(todas.map((e) => attempt(api.votacao.estatisticas(e.id)))),
      Promise.all(todas.map((e) => attempt(api.votacao.resultados(e.id)))),
    ]);
    const dados = detalhes.map((e, i) => ({ e, stats: estatisticas[i].data, rondas: resultados[i].data || [], erro: resultados[i].error }));
    const atuais = dados.slice(0, aDecorrer.length);
    // Histórico da mais antiga para a mais recente (o gráfico de colunas lê-se da esquerda para a direita)
    const inicio = (d) => Date.parse(d.e.inicio || d.e.data_criacao);
    const historico = dados.slice(aDecorrer.length).sort((a, b) => inicio(a) - inicio(b));

    el.innerHTML = TV.teamView.resultsPage(atuais, historico);

    // Relatório de resultados: uma linha por candidato e por volta
    el.querySelectorAll("[data-export]").forEach((b) =>
      b.addEventListener("click", () => {
        const { e, stats, rondas } = dados.find((d) => d.e.id === Number(b.dataset.export));
        const linhas = rondas.flatMap((r) =>
          resultRows(r, e.candidatos).map((l) => [e.titulo, `${r.ronda}.ª volta`, l.nome, l.detalhe, l.votos, percent(l.percentagem)])
        );
        if (stats) linhas.push([], ["Participação", "", "", "", `${stats.votantes} de ${stats.habilitados}`, percent(stats.participacao)]);
        download.csv(`resultados-${slug(e.titulo)}`, ["Eleição", "Volta", "Candidato", "Lista", "Votos", "Percentagem"], linhas);
      })
    );
  }

  (TV.team = TV.team || {}).renderResults = renderResults;
})();
