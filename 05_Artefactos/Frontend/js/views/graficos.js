/* View · gráficos da área da equipa: linha (votos por hora), barras e colunas (TrustVote.charts) */
(function () {
  "use strict";

  const { escapeHtml, number, percent, time } = window.TrustVote.format;

  // Tabela com os mesmos dados do gráfico (para quem prefere ler números ou usa leitor de ecrã)
  const dataTable = (titulo, colunas, linhas) => `
    <details class="chart-table">
      <summary>Ver como tabela</summary>
      <div class="table-scroll">
        <table>
          <caption class="sr-only">${escapeHtml(titulo)}</caption>
          <thead><tr>${colunas.map((c) => `<th scope="col">${escapeHtml(c)}</th>`).join("")}</tr></thead>
          <tbody>${linhas.map((l) => `<tr>${l.map((v, i) => (i ? `<td>${escapeHtml(v)}</td>` : `<th scope="row">${escapeHtml(v)}</th>`)).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </details>`;

  // Linha: votos ao longo do tempo. Passar o rato (ou usar as setas) mostra a hora e os votos de cada ponto.
  function lineChart(serie) {
    const w = 1000;
    const h = 260;
    const max = Math.max(1, ...serie.map((p) => p.votos));
    const x = (i) => 40 + (i / Math.max(1, serie.length - 1)) * (w - 60);
    const y = (v) => h - 30 - (v / max) * (h - 60);
    const d = serie.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.votos).toFixed(1)}`).join(" ");
    const area = serie.length ? `${d} L${x(serie.length - 1).toFixed(1)},${h - 30} L${x(0).toFixed(1)},${h - 30} Z` : "";
    // Linhas da grelha em valores inteiros e sem repetir (com poucos votos: 0, 1, 2…)
    const marcas = [...new Set([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f)))];
    const grid = marcas
      .map((v) => `<line x1="40" x2="${w - 20}" y1="${y(v)}" y2="${y(v)}"></line><text x="0" y="${y(v) + 3}">${number(v)}</text>`)
      .join("");
    const labels = serie
      .filter((_, i) => i % Math.ceil(serie.length / 6) === 0 || i === serie.length - 1)
      .map((p) => `<text x="${x(serie.indexOf(p)) - 12}" y="${h - 8}">${time(p.hora)}</text>`)
      .join("");
    // Posição de cada ponto em % da caixa: o marcador e a legenda são HTML por cima do SVG
    const pontos = serie.map((p, i) => [
      +((x(i) / w) * 100).toFixed(2),
      +((y(p.votos) / h) * 100).toFixed(2),
      time(p.hora),
      `${number(p.votos)} ${p.votos === 1 ? "voto" : "votos"}`,
    ]);
    return `
      <div class="line-chart-box" data-line-chart="${escapeHtml(JSON.stringify(pontos))}" tabindex="0"
        role="group" aria-label="Votos ao longo do tempo. Use as setas para percorrer as horas.">
        <svg class="line-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${grid}${labels}<path class="line-chart-area" d="${area}"></path><path d="${d}"></path></svg>
        <span class="chart-marker" hidden></span>
        <span class="chart-tip" role="status" hidden></span>
      </div>
      ${dataTable("Votos por hora", ["Hora", "Votos"], pontos.map((p) => [p[2], p[3]]))}`;
  }

  // Comportamento do gráfico de linha (um só ouvinte para todos os gráficos, mesmo os que chegam depois)
  function showPoint(box, index) {
    const pontos = JSON.parse(box.dataset.lineChart || "[]");
    if (!pontos.length) return;
    const i = Math.max(0, Math.min(pontos.length - 1, index));
    const [px, py, hora, votos] = pontos[i];
    const marker = box.querySelector(".chart-marker");
    const tip = box.querySelector(".chart-tip");
    box.dataset.index = i;
    marker.hidden = tip.hidden = false;
    marker.style.left = tip.style.left = `${px}%`;
    marker.style.top = `${py}%`;
    tip.style.top = `${py}%`;
    tip.classList.toggle("is-left", px > 75);
    tip.innerHTML = `<b>${escapeHtml(votos)}</b><small>${escapeHtml(hora)}</small>`;
  }
  function hidePoint(box) {
    box.querySelectorAll(".chart-marker, .chart-tip").forEach((el) => (el.hidden = true));
    delete box.dataset.index;
  }
  document.addEventListener("pointermove", (event) => {
    const box = event.target.closest?.("[data-line-chart]");
    if (!box) return;
    const pontos = JSON.parse(box.dataset.lineChart || "[]");
    const rect = box.getBoundingClientRect();
    const pct = ((event.clientX - rect.left) / rect.width) * 100;
    let melhor = 0;
    pontos.forEach((p, i) => {
      if (Math.abs(p[0] - pct) < Math.abs(pontos[melhor][0] - pct)) melhor = i;
    });
    showPoint(box, melhor);
  });
  document.addEventListener("pointerout", (event) => {
    const box = event.target.closest?.("[data-line-chart]");
    if (box && !box.contains(event.relatedTarget) && document.activeElement !== box) hidePoint(box);
  });
  document.addEventListener("keydown", (event) => {
    const box = event.target.closest?.("[data-line-chart]");
    if (!box || event.target !== box) return;
    const total = JSON.parse(box.dataset.lineChart || "[]").length;
    const atual = box.dataset.index === undefined ? total - 1 : +box.dataset.index;
    const passos = { ArrowRight: atual + 1, ArrowLeft: atual - 1, Home: 0, End: total - 1 };
    if (!(event.key in passos)) return;
    event.preventDefault();
    showPoint(box, passos[event.key]);
  });
  document.addEventListener("focusin", (event) => {
    if (event.target.matches?.("[data-line-chart]")) showPoint(event.target, JSON.parse(event.target.dataset.lineChart || "[]").length - 1);
  });
  document.addEventListener("focusout", (event) => {
    if (event.target.matches?.("[data-line-chart]")) hidePoint(event.target);
  });

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
      </div>
      ${dataTable(label, ["Nome", "Votos", "Percentagem"], linhas.map((l) => [l.nome, number(l.votos), percent(l.percentagem)]))}`;
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
      </div>
      ${dataTable(label, ["Eleição", "Participação", "Detalhe"], colunas.map((c) => [c.nome, percent(c.valor), c.detalhe || ""]))}`;
  }

  // Barras simples (resultados nas páginas públicas e na área do eleitor)
  const resultRow = (c) => `
    <div class="result-row">
      <span>${escapeHtml(c.nome)}</span>
      <div class="bar"><i style="width:${Math.min(100, c.percentagem || 0)}%"></i></div>
      <b>${percent(c.percentagem)}</b>
      <small>${number(c.total_votos)} votos</small>
    </div>`;

  // Linha por baixo dos resultados de uma volta: brancos, participação, quórum e votos excluídos
  const roundSummary = (r) =>
    `<p class="muted round-summary">${[
      `Brancos: ${number(r.brancos)} (${percent(r.percentagem_brancos)})`,
      `Participação ${percent(r.participacao)} · ${number(r.votantes)} de ${number(r.habilitados)}`,
      r.quorum ? `Quórum de ${percent(r.quorum)}: <b>${r.quorum_atingido ? "atingido" : "não atingido"}</b>` : "",
      r.invalidos ? `<b>${number(r.invalidos)} voto(s) com selo inválido excluído(s)</b>` : "",
      r.apurada ? "Apuramento final" : "Contagem provisória",
    ]
      .filter(Boolean)
      .join(" · ")}</p>`;

  window.TrustVote.charts = { lineChart, barChart, columnChart, resultRow, roundSummary };
})();
