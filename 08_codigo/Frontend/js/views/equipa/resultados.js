/* View · área da equipa, separador "Resultados": um painel por eleição (separadores), com indicadores,
   desfecho, classificação, distribuição dos votos, votos ao longo do tempo e a comparação histórica */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { ui } = TV;
  const { escapeHtml, number, percent, initials, plural, volta, dateTime } = TV.format;
  const { head, cardHead, stateBadge } = TV.blocks;
  const { barChart, columnChart, lineChart } = TV.charts;
  const { resultRows, listRows } = TV.results;


  // ===== Separadores: uma eleição a decorrer ou encerrada por separador =====
  const electionTab = ({ e }, escolhida) => `
    <button class="cand-election-tab" type="button" role="tab" data-result-election="${e.id}" aria-selected="${e.id === escolhida}">
      <span class="cand-election-dot is-${escapeHtml(e.estado)}" aria-hidden="true"></span>
      <span class="cand-election-name">${escapeHtml(e.titulo)}</span>
      <span class="cand-election-count">${e.estado === "em_curso" ? "ao vivo" : e.ano}</span>
    </button>`;

  const resultsPage = (itens, historico, escolhida) => `
    ${head("APURAMENTO", "Resultados", "")}
    ${itens.length
      ? `<div class="cand-election-tabs" role="tablist" aria-label="Eleição">${itens.map((d) => electionTab(d, escolhida)).join("")}</div>
         <div data-results-board></div>`
      : `<article class="dash-card">${ui.empty("Ainda não há resultados", "Os resultados provisórios aparecem quando uma votação abre.")}</article>`}
    ${historico.length > 1 ? participationCard(historico) : ""}`;

  // ===== Desfecho da volta: o que os números querem dizer =====
  function outcome(r, linhas, e) {
    const [lider, segundo] = linhas;
    const total = linhas.reduce((s, l) => s + l.votos, 0);
    if (!total) return ["neutral", "clock", "Ainda sem votos em candidaturas", r.apurada ? "A volta terminou sem votos válidos em candidaturas." : "Os números aparecem à medida que os votos chegam."];
    const empatados = linhas.filter((l) => l.votos === lider.votos);
    if (empatados.length > 1)
      return ["warn", "circle-alert", `Empate entre ${empatados.map((l) => l.nome).join(" e ")}`, `${plural(lider.votos, "voto", "votos")} cada. ${r.apurada && r.ronda === 1 ? "Uma 2.ª volta entre os empatados decide o resultado." : r.apurada ? "O resultado fica empatado." : "A contagem ainda é provisória."}`];
    const vantagem = `${plural(lider.votos - (segundo ? segundo.votos : 0), "voto", "votos")} de vantagem`;
    if (!r.apurada) return ["live", "vote", `${lider.nome} lidera`, `${percent(lider.percentagem)} dos votos · ${vantagem} · contagem provisória`];
    if (r.quorum && !r.quorum_atingido) return ["warn", "circle-alert", "Quórum não atingido", `Participação de ${percent(r.participacao)}, abaixo do mínimo de ${percent(r.quorum)}: o resultado não é válido.`];
    if (lider.percentagem > 50) return ["win", "circle-check", `${lider.nome} eleito`, `${percent(lider.percentagem)} dos votos · ${vantagem}`];
    const segunda = r.ronda === 1 && segundo && !(e.rondas || []).some((x) => x.numero === 2);
    return ["warn", "info", `${lider.nome} é o mais votado, sem maioria absoluta`, `${percent(lider.percentagem)} dos votos.${segunda ? ` Uma 2.ª volta seria entre ${lider.nome} e ${segundo.nome}.` : ""}`];
  }

  const outcomeBanner = ([tipo, icone, titulo, texto]) => `
    <div class="result-outcome is-${tipo}">
      <span class="result-outcome-icon">${TV.icon(icone)}</span>
      <div><b>${escapeHtml(titulo)}</b><p>${escapeHtml(texto)}</p></div>
    </div>`;

  // ===== Indicadores =====
  const kpi = (rotulo, valor, detalhe, extra = "", tipo = "") => `
    <div class="voter-stat${tipo ? ` is-${tipo}` : ""}">
      <b>${valor}</b><span>${rotulo}</span>${detalhe ? `<small>${detalhe}</small>` : ""}${extra}
    </div>`;

  function kpis(r, total) {
    const quorumBar = `
      <div class="kpi-bar" aria-hidden="true"><i style="width:${Math.min(100, r.participacao || 0)}%"></i>${r.quorum ? `<em style="left:${Math.min(100, r.quorum)}%"></em>` : ""}</div>`;
    return `
      <div class="voter-stats result-kpis">
        ${kpi("Participação", percent(r.participacao), `${number(r.votantes)} de ${plural(r.habilitados, "eleitor", "eleitores")}`, quorumBar, "brand")}
        ${kpi("Votos em candidaturas", number(total), "votos válidos")}
        ${kpi("Votos em branco", number(r.brancos), percent(r.percentagem_brancos))}
        ${r.quorum
          ? kpi("Quórum", r.quorum_atingido ? "Atingido" : "Não atingido", `mínimo de ${percent(r.quorum)}`, "", r.quorum_atingido ? "brand" : "warn")
          : kpi("Quórum", "—", "sem mínimo definido")}
        ${r.invalidos ? kpi("Votos excluídos", number(r.invalidos), "selo de integridade inválido", "", "warn") : ""}
      </div>`;
  }

  // ===== Classificação =====
  const rankRow = (l, i, max, lider) => `
    <li class="rank-row${i === 0 && lider ? " is-leader" : ""}">
      <span class="rank-pos">${i + 1}</span>
      <span class="cand-avatar" aria-hidden="true">${escapeHtml(initials(l.nome))}</span>
      <div class="rank-main">
        <div class="rank-name"><b>${escapeHtml(l.nome)}</b>${l.detalhe ? `<small>${escapeHtml(l.detalhe)}</small>` : ""}</div>
        <div class="rank-track"><i style="width:${max ? (l.votos / max) * 100 : 0}%"></i></div>
      </div>
      <div class="rank-value"><b>${percent(l.percentagem)}</b><small>${plural(l.votos, "voto", "votos")}</small></div>
    </li>`;

  // ===== Distribuição dos votos (anel): candidaturas e brancos =====
  function donut(linhas, brancos) {
    const fatias = [...linhas.map((l, i) => ({ nome: l.nome, votos: l.votos, cor: `seg-${i % 5}` })), { nome: "Em branco", votos: brancos, cor: "seg-blank" }].filter((f) => f.votos > 0);
    const total = fatias.reduce((s, f) => s + f.votos, 0);
    if (!total) return '<p class="muted">Sem votos para mostrar.</p>';
    const raio = 15.915; // perímetro de 100: cada fatia em percentagem
    let acumulado = 0;
    const arcos = fatias
      .map((f) => {
        const pct = (f.votos / total) * 100;
        const arco = `<circle class="${f.cor}" r="${raio}" cx="21" cy="21" fill="none" stroke-width="6" stroke-dasharray="${pct.toFixed(3)} ${(100 - pct).toFixed(3)}" stroke-dashoffset="${(25 - acumulado).toFixed(3)}"></circle>`;
        acumulado += pct;
        return arco;
      })
      .join("");
    return `
      <div class="donut">
        <svg viewBox="0 0 42 42" role="img" aria-label="Distribuição de ${plural(total, "voto", "votos")}">
          <circle r="${raio}" cx="21" cy="21" fill="none" stroke-width="6" class="seg-track"></circle>${arcos}
        </svg>
        <div class="donut-center"><b>${number(total)}</b><small>votos</small></div>
      </div>
      <ul class="donut-legend">
        ${fatias.map((f) => `<li><span class="donut-key ${f.cor}"></span><span>${escapeHtml(f.nome)}</span><b>${percent((f.votos / total) * 100)}</b></li>`).join("")}
      </ul>`;
  }

  // ===== Painel de uma eleição =====
  function resultsBoard({ e, stats, rondas, erro, atualizado }, numero) {
    const ordenadas = [...rondas].sort((a, b) => a.ronda - b.ronda);
    const r = ordenadas.find((x) => x.ronda === numero) || ordenadas[ordenadas.length - 1];
    const aoVivo = e.estado === "em_curso";

    const acoes = `
      <div class="result-actions">
        ${aoVivo ? `<span class="live-chip">Atualizado às ${escapeHtml(TV.format.time(atualizado))}</span>` : ""}
        <button class="button button-light" type="button" data-integrity="${e.id}">Verificar integridade</button>
        ${rondas.length ? `<button class="button button-outline" type="button" data-export="${e.id}">Exportar CSV</button>` : ""}
      </div>`;

    const topo = `
      <article class="dash-card result-hero">
        <div class="result-hero-main">
          <div class="result-hero-badges">${stateBadge(e.estado)}<span class="result-mode${r && r.apurada ? " is-final" : ""}">${TV.icon(r && r.apurada ? "shield-check" : "clipboard-list")} ${r && r.apurada ? "Apuramento final" : "Contagem provisória"}</span></div>
          <h2>${escapeHtml(e.titulo)}</h2>
          <p class="muted">${TV.icon("calendar")} ${escapeHtml(e.periodo)}</p>
        </div>
        ${acoes}
        <div class="result-integrity" data-integrity-result="${e.id}"></div>
      </article>`;

    if (!r)
      return `${topo}<article class="dash-card"><div class="empty-box">${escapeHtml(erro ? erro.message : "Ainda não existem votos.")}</div></article>`;

    const linhas = resultRows(r, e.candidatos);
    const listas = listRows(linhas);
    const total = linhas.reduce((s, l) => s + l.votos, 0);
    const max = Math.max(0, ...linhas.map((l) => l.votos));
    const desfecho = outcome(r, linhas, e);
    const liderUnico = total > 0 && (!linhas[1] || linhas[1].votos !== linhas[0].votos);

    const seletorVolta = ordenadas.length > 1
      ? `<div class="segmented result-rounds" role="group" aria-label="Volta">${ordenadas
          .map((x) => `<label><input type="radio" name="volta-${e.id}" value="${x.ronda}" data-result-round${x.ronda === r.ronda ? " checked" : ""}><span>${volta(x.ronda)}</span></label>`)
          .join("")}</div>`
      : "";

    const serie = stats && stats.serie && stats.serie.length > 1
      ? `<article class="dash-card">${cardHead("", "Votos ao longo do tempo")}${lineChart(stats.serie)}</article>`
      : "";

    return `
      ${topo}
      ${seletorVolta}
      ${outcomeBanner(desfecho)}
      ${kpis(r, total)}
      <div class="result-grid">
        <article class="dash-card">
          ${cardHead("", `Classificação · ${volta(r.ronda)}`)}
          ${linhas.length ? `<ol class="rank-list">${linhas.map((l, i) => rankRow(l, i, max, liderUnico)).join("")}</ol>` : '<p class="muted">Esta volta não tem candidaturas.</p>'}
        </article>
        <article class="dash-card">
          ${cardHead("", "Distribuição dos votos")}
          ${donut(linhas, r.brancos)}
        </article>
      </div>
      ${listas.length > 1 && listas.length < linhas.length ? `<article class="dash-card">${cardHead("", "Votos por lista")}${barChart(listas, `Votos por lista · ${e.titulo}`)}</article>` : ""}
      ${serie}`;
  }

  // Resultado de "Verificar integridade": selos dos votos e urna contra participações
  const integrityResult = (r) => `
    <div class="result-outcome ${r.valida ? "is-win" : "is-warn"}">
      <span class="result-outcome-icon">${TV.icon(r.valida ? "shield-check" : "circle-alert")}</span>
      <div>
        <b>${r.valida ? "Urna íntegra" : "Foram encontrados problemas na urna"}</b>
        <p>${r.rondas
          .map((v) => `${volta(v.ronda)}: ${number(v.votos)} votos para ${number(v.participacoes)} participações${v.coincide ? "" : " (não coincide)"}${v.selos_invalidos ? ` · ${number(v.selos_invalidos)} com selo inválido` : ""}`)
          .join(" · ") || "Ainda não há voltas."} · verificado às ${escapeHtml(dateTime(new Date().toISOString()))}</p>
      </div>
    </div>`;

  const participationCard = (historico) => `
    <article class="dash-card">
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

  Object.assign((TV.teamView = TV.teamView || {}), { resultsPage, resultsBoard, integrityResult });
})();
