/* View · área da equipa, separador "Visão geral": números da eleição, votos por hora e resultados provisórios */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml, number, percent, dateTime } = TV.format;
  const { head, cardHead, pill } = TV.blocks;
  const { lineChart, barChart } = TV.charts;
  const { resultRows } = TV.results;
  const { statusLabels } = TV.elections;

  const metricCard = (titulo, destaque, valor, extra) => `
    <article class="metric-card rounded-2xl shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <span class="check-box rounded-lg">✓</span>
      <small>${titulo}</small><em>${destaque}</em>
      <b>${valor}</b>
      ${extra}
    </article>`;

  // d = { eleicao, lista, stats, resultados, serie, ultimaHora, emCurso, encerradas, rondaAtual, restante }
  function overview(d) {
    const { eleicao, lista, stats, resultados, serie, ultimaHora, emCurso, encerradas, rondaAtual, restante } = d;
    const s = stats.data;
    return `
      ${head("CENTRO DE OPERAÇÕES", "Visão geral", "Acompanhe a participação e os resultados das eleições.", eleicao ? pill(eleicao.estadoLabel, !eleicao.aberta) : "")}
      <div class="admin-metrics grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4">
        ${metricCard(
      "PARTICIPAÇÃO",
      s ? percent(s.participacao) : "",
      s ? `${number(s.votantes)} <small style="font-size:11px">/ ${number(s.habilitados)}</small>` : "—",
      `<div class="bar"><i style="width:${s ? Math.min(100, s.participacao) : 0}%"></i></div>`
    )}
        ${metricCard(
      "VOTOS REGISTADOS",
      eleicao ? escapeHtml(statusLabels[eleicao.estado]) : "",
      s ? number(s.votantes) : "—",
      `<span>${ultimaHora !== null ? `${number(ultimaHora)} na última hora` : escapeHtml(stats.error ? stats.error.message : "Sem eleição ativa")}</span>`
    )}
        ${metricCard(
      "TEMPO RESTANTE",
      eleicao ? escapeHtml(eleicao.voltaLabel.split(" · ")[0].toUpperCase()) : "",
      restante || "—",
      `<span>${eleicao && eleicao.fim ? `Fecha a ${dateTime(eleicao.fim)}` : "Sem votação marcada"}</span>`
    )}
        ${metricCard(
      "ELEIÇÕES",
      `${number(lista.length)} NO TOTAL`,
      `${number(emCurso)} <small style="font-size:11px">em curso</small>`,
      `<span>${number(encerradas)} encerradas · ${number(lista.length - emCurso - encerradas)} em preparação</span>`
    )}
      </div>
      <div class="overview-grid grid-cols-1 xl:grid-cols-[1.6fr_1fr]">
        <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
          ${cardHead("PARTICIPAÇÃO", "Votos ao longo do tempo", eleicao ? `<span class="model-tag rounded-lg">${escapeHtml(eleicao.titulo)}</span>` : "")}
          ${serie.length ? lineChart(serie) : `<div class="empty-box rounded-xl">${escapeHtml(stats.error ? stats.error.message : "Ainda não existem votos registados.")}</div>`}
        </article>
        <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
          ${cardHead("RESULTADOS PROVISÓRIOS", "Votos por candidato")}
          ${rondaAtual && rondaAtual.candidatos.length
        ? barChart(resultRows(rondaAtual, eleicao.candidatos).slice(0, 5), "Votos por candidato na eleição em curso")
        : `<div class="empty-box rounded-xl">${escapeHtml(resultados.error ? resultados.error.message : "Sem resultados por enquanto.")}</div>`
      }
          <button class="button rounded-xl button-outline" type="button" data-go="results">Ver todos os resultados →</button>
        </article>
      </div>`;
  }

  (TV.teamView = TV.teamView || {}).overview = overview;
})();
