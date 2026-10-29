/* View · área do eleitor, separadores "Sondagem IA" e "Resultados" */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml, number, percent, initials } = TV.format;
  const { head } = TV.blocks;
  const { resultRow } = TV.charts;

  // ===== Sondagem =====
  const pollHead = () =>
    head("MODELO PREDITIVO · SIMULAÇÃO ACADÉMICA", "Sondagem eleitoral com IA", "Projeção experimental baseada em resultados históricos e numa amostra simulada de intenção de voto.");

  const modelTag = (s) => `<span class="model-tag rounded-lg">MODELO ${escapeHtml(String(s.modelo || "TRUSTVOTE").toUpperCase())}</span>`;

  const projectionRow = (p) => `
    <div class="result-row">
      <span class="avatar">${p.candidato_id ? escapeHtml(initials(p.nome)) : "?"}</span>
      <span><b style="font-size:13px">${escapeHtml(p.nome)}</b></span>
      <div class="bar"><i style="width:${Math.min(100, p.percentagem)}%"></i></div>
      <b>${percent(p.percentagem)}</b>
    </div>`;

  const pollBody = (e, s) => `
    <div class="poll-grid grid-cols-1 lg:grid-cols-[1.95fr_1fr]">
      <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
        <div class="card-head">
          <div><p class="eyebrow">PROJEÇÃO ATUAL</p><h2>Estimativa para ${e.ano}</h2></div>
          <small class="muted" style="font-size:9px">AMOSTRA SIMULADA · N=${number(s.amostra)}</small>
        </div>
        ${(s.projecao || []).map(projectionRow).join("")}
        <p class="notice rounded-xl"><b>Intervalo de confiança estimado: ±${escapeHtml(String(s.intervalo ?? "—"))} p.p.</b>Esta projeção não representa uma sondagem oficial nem utiliza dados pessoais reais.</p>
      </article>
      <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
        <p class="eyebrow">PARTICIPAÇÃO ANÓNIMA</p>
        <h2>Se a eleição fosse hoje?</h2>
        <p>A resposta é agregada à demonstração e não afeta o voto.</p>
        <form class="poll-form" data-poll-form>
          ${e.candidatosRonda.map((c) => `<label class="radio-line rounded-xl transition hover:border-tv-accent"><input type="radio" name="poll" value="${c.id}" required> ${escapeHtml(c.nome)}</label>`).join("")}
          <p class="form-message" role="status"></p>
          <button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="submit">Incluir na simulação</button>
        </form>
      </article>
    </div>`;

  // ===== Resultados =====
  const resultsHead = () => head("INFORMAÇÃO ELEITORAL", "Resultados", "Apuramento das eleições em curso e concluídas.");

  // Cartão vazio de cada eleição (o conteúdo chega depois com resultsCard)
  const resultsSlot = (e) => `<article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift" data-result="${e.id}"></article>`;

  const resultsCard = (e, rondas) => `
    <div class="card-head"><div><p class="eyebrow">${e.estadoLabel}</p><h2>${escapeHtml(e.titulo)}</h2></div></div>
    ${rondas.map((r) => `<p class="eyebrow">${r.ronda === 2 ? "2.ª" : "1.ª"} VOLTA</p>${r.candidatos.map(resultRow).join("")}`).join("")}`;

  Object.assign((TV.voterView = TV.voterView || {}), { pollHead, modelTag, pollBody, resultsHead, resultsSlot, resultsCard });
})();
