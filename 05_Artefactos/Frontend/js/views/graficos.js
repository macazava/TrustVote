/* View · gráficos da área da equipa: linha (votos por hora), barras e colunas (TrustVote.charts) */
(function () {
  "use strict";

  const { escapeHtml, number, percent, time } = window.TrustVote.format;

  // Linha: votos ao longo do tempo
  function lineChart(serie) {
    const w = 1000;
    const h = 260;
    const max = Math.max(1, ...serie.map((p) => p.votos));
    const x = (i) => 40 + (i / Math.max(1, serie.length - 1)) * (w - 60);
    const y = (v) => h - 30 - (v / max) * (h - 60);
    const d = serie.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.votos).toFixed(1)}`).join(" ");
    const grid = [0, 0.25, 0.5, 0.75, 1]
      .map((f) => `<line x1="40" x2="${w - 20}" y1="${y(max * f)}" y2="${y(max * f)}"></line><text x="0" y="${y(max * f) + 3}">${number(Math.round(max * f))}</text>`)
      .join("");
    const labels = serie
      .filter((_, i) => i % Math.ceil(serie.length / 6) === 0 || i === serie.length - 1)
      .map((p) => `<text x="${x(serie.indexOf(p)) - 12}" y="${h - 8}">${time(p.hora)}</text>`)
      .join("");
    return `<svg class="line-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Votos ao longo do tempo">${grid}${labels}<path d="${d}"></path></svg>`;
  }

  // Barras horizontais: o comprimento é relativo ao maior valor, o texto mostra votos e percentagem
  function barChart(linhas, label) {
    const max = Math.max(1, ...linhas.map((l) => l.votos));
    return `
      <div class="bar-chart" role="img" aria-label="${escapeHtml(label)}">
        ${linhas
          .map(
            (l) => `
            <div class="bar-chart-row" title="${escapeHtml(`${l.nome} · ${number(l.votos)} votos (${percent(l.percentagem)})`)}">
              <span class="bar-chart-label"><b>${escapeHtml(l.nome)}</b>${l.detalhe ? `<small>${escapeHtml(l.detalhe)}</small>` : ""}</span>
              <span class="bar-chart-track"><i style="width:${(l.votos / max) * 100}%"></i></span>
              <span class="bar-chart-value"><b>${percent(l.percentagem)}</b><small>${number(l.votos)} votos</small></span>
            </div>`
          )
          .join("")}
      </div>`;
  }

  // Colunas: participação de cada eleição numa escala fixa de 0 a 100%
  function columnChart(colunas, label) {
    return `
      <div class="column-chart" role="img" aria-label="${escapeHtml(label)}">
        ${colunas
          .map(
            (c) => `
            <div class="column-chart-item" title="${escapeHtml(`${c.nome} · ${percent(c.valor)} (${c.detalhe})`)}">
              <b>${percent(c.valor)}</b>
              <span class="column-chart-track"><i style="height:${Math.min(100, c.valor || 0)}%"></i></span>
              <small>${escapeHtml(c.nome)}</small>
            </div>`
          )
          .join("")}
      </div>`;
  }

  // Barras simples (resultados nas páginas públicas e na área do eleitor)
  const resultRow = (c) => `
    <div class="result-row">
      <span>${escapeHtml(c.nome)}</span>
      <div class="bar"><i style="width:${Math.min(100, c.percentagem || 0)}%"></i></div>
      <b>${percent(c.percentagem)}</b>
      <small>${number(c.total_votos)} votos</small>
    </div>`;

  window.TrustVote.charts = { lineChart, barChart, columnChart, resultRow };
})();
