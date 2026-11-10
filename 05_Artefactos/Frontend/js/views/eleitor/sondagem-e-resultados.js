/* View · área do eleitor, separadores "Sondagem IA" e "Resultados" */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml, number, percent, initials } = TV.format;
  const { head } = TV.blocks;
  const { resultRow, roundSummary } = TV.charts;

  // ===== Sondagem =====
  const pollHead = () =>
    head("MODELO PREDITIVO · SEM VALOR ELEITORAL", "Sondagem de intenção de voto", "Projeção bayesiana feita a partir das intenções de voto declaradas pelos eleitores.");

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
          <small class="muted">RESPOSTAS · N=${number(s.amostra)}</small>
        </div>
        ${(s.projecao || []).map(projectionRow).join("")}
        <p class="notice rounded-xl"><b>Margem de erro estimada (95%): ±${escapeHtml(String(s.intervalo ?? "—"))} p.p.</b>Com poucas respostas a projeção fica perto da igualdade entre candidatos. Não é uma sondagem oficial.</p>
      </article>
      <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
        <p class="eyebrow">PARTICIPAÇÃO ANÓNIMA</p>
        <h2>Se a eleição fosse hoje?</h2>
        <p>A resposta é anónima, só conta uma vez e não afeta o voto.</p>
        ${s.respondeu
      ? '<p class="notice rounded-xl"><b>Já respondeu a esta sondagem.</b>Obrigado pela participação.</p>'
      : `<form class="poll-form" data-poll-form>
          ${e.candidatosRonda.map((c) => `<label class="radio-line rounded-xl transition hover:border-tv-accent"><input type="radio" name="poll" value="${c.id}" required> ${escapeHtml(c.nome)}</label>`).join("")}
          <p class="form-message" role="status"></p>
          <button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="submit">Enviar resposta</button>
        </form>`}
      </article>
    </div>`;

  // ===== Resultados =====
  const resultsHead = () => head("INFORMAÇÃO ELEITORAL", "Resultados", "Apuramento das eleições em curso e concluídas.");

  // Cartão vazio de cada eleição (o conteúdo chega depois com resultsCard)
  const resultsSlot = (e) => `<article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift" data-result="${e.id}"></article>`;

  const resultsCard = (e, rondas) => `
    <div class="card-head"><div><p class="eyebrow">${e.estadoLabel}</p><h2>${escapeHtml(e.titulo)}</h2></div></div>
    ${rondas.map((r) => `<p class="eyebrow">${r.ronda === 2 ? "2.ª" : "1.ª"} VOLTA</p>${r.candidatos.map(resultRow).join("")}${roundSummary(r)}`).join("")}`;

  // Votação ainda aberta: os resultados só são públicos depois de fechar (não é um erro)
  const resultsPending = (e, mensagem) => `
    <div class="card-head"><div><p class="eyebrow">${e.estadoLabel}</p><h2>${escapeHtml(e.titulo)}</h2></div></div>
    ${TV.ui.empty("Resultados ainda não disponíveis", mensagem)}`;

  Object.assign((TV.voterView = TV.voterView || {}), { pollHead, modelTag, pollBody, resultsHead, resultsSlot, resultsCard, resultsPending });
})();
