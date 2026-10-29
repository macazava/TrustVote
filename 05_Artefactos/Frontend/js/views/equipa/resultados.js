/* View · área da equipa, separador "Resultados": eleição a decorrer e histórico com gráficos */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { ui } = TV;
  const { escapeHtml, number, percent } = TV.format;
  const { head, cardHead } = TV.blocks;
  const { barChart, columnChart } = TV.charts;
  const { resultRows, listRows } = TV.results;

  // Gráficos de uma volta: votos por candidato e, se houver listas com vários candidatos, votos por lista
  function roundCharts(e, r, variasVoltas) {
    const linhas = resultRows(r, e.candidatos);
    const listas = listRows(linhas);
    return `
      ${variasVoltas ? `<p class="eyebrow">${r.ronda === 2 ? "2.ª" : "1.ª"} VOLTA</p>` : ""}
      <div class="results-split grid-cols-1 lg:grid-cols-2">
        <div><h3>Votos por candidato</h3>${barChart(linhas, `Votos por candidato · ${e.titulo}`)}</div>
        ${listas.length > 1 && listas.length < linhas.length ? `<div><h3>Votos por lista</h3>${barChart(listas, `Votos por lista · ${e.titulo}`)}</div>` : ""}
      </div>`;
  }

  // Cartão de uma eleição: cabeçalho com participação e botão de exportar, depois os gráficos de cada volta
  function electionCard({ e, stats, rondas, erro }, provisorio) {
    const acoes = `<div class="row-actions">${stats ? `<span class="model-tag rounded-lg">Participação ${percent(stats.participacao)} · ${number(stats.votantes)} / ${number(stats.habilitados)}</span>` : ""}${rondas.length ? `<button type="button" data-export="${e.id}">Exportar CSV</button>` : ""}</div>`;
    return `
      <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
        ${cardHead(`${provisorio ? "RESULTADOS PROVISÓRIOS" : "RESULTADOS FINAIS"} · ${e.ano} · ${escapeHtml(e.periodo)}`, escapeHtml(e.titulo), acoes)}
        ${rondas.length
        ? rondas.map((r) => roundCharts(e, r, rondas.length > 1)).join("")
        : `<div class="empty-box rounded-xl">${escapeHtml(erro ? erro.message : "Ainda não existem votos.")}</div>`}
      </article>`;
  }

  const participationCard = (historico) => `
    <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
      ${cardHead("COMPARAÇÃO", "Participação por eleição")}
      ${columnChart(
    historico.map(({ e, stats }) => ({
      nome: e.titulo,
      valor: stats ? stats.participacao : 0,
      detalhe: stats ? `${number(stats.votantes)} de ${number(stats.habilitados)} votaram` : "sem dados",
    })),
    "Participação em cada eleição encerrada"
  )}
    </article>`;

  const emptyCard = (titulo, texto) => `<article class="dash-card rounded-2xl shadow-soft">${ui.empty(titulo, texto)}</article>`;

  const resultsPage = (atuais, historico) => `
    ${head("APURAMENTO", "Resultados", "Votos por candidato e por lista, na eleição a decorrer e nas eleições anteriores.")}
    <h2 class="results-section-title">A decorrer</h2>
    ${atuais.length
      ? atuais.map((d) => electionCard(d, true)).join("")
      : emptyCard("Nenhuma eleição a decorrer", "Os resultados provisórios aparecem quando uma votação abre.")}
    <h2 class="results-section-title">Histórico</h2>
    ${historico.length
      ? `${participationCard(historico)}${historico.slice().reverse().map((d) => electionCard(d, false)).join("")}`
      : emptyCard("Ainda não há eleições encerradas")}`;

  Object.assign((TV.teamView = TV.teamView || {}), { resultsPage });
})();
