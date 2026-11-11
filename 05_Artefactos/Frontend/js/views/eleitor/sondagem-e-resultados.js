/* View · área do eleitor, separadores "Sondagem IA" e "Resultados" */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml, number, percent, initials } = TV.format;
  const { head } = TV.blocks;

  // ===== Sondagem =====
  const pollHead = () =>
    head("MODELO PREDITIVO · SEM VALOR ELEITORAL", "Sondagem de intenção de voto", "Projeção bayesiana feita a partir das intenções de voto declaradas pelos eleitores.");

  const modelTag = (s) => `<span class="model-tag">MODELO ${escapeHtml(String(s.modelo || "TRUSTVOTE").toUpperCase())}</span>`;

  const projectionRow = (p) => `
    <div class="result-row">
      <span class="avatar">${p.candidato_id ? escapeHtml(initials(p.nome)) : "?"}</span>
      <span><b style="font-size:13px">${escapeHtml(p.nome)}</b></span>
      <div class="bar"><i style="width:${Math.min(100, p.percentagem)}%"></i></div>
      <b>${percent(p.percentagem)}</b>
    </div>`;

  const pollBody = (e, s) => `
    <div class="poll-grid grid-cols-1 lg:grid-cols-[1.95fr_1fr]">
      <article class="dash-card">
        <div class="card-head">
          <div><p class="eyebrow">PROJEÇÃO ATUAL</p><h2>Estimativa para ${e.ano}</h2></div>
          <small class="muted">RESPOSTAS · N=${number(s.amostra)}</small>
        </div>
        ${(s.projecao || []).map(projectionRow).join("")}
        <p class="notice"><b>Margem de erro estimada (95%): ±${escapeHtml(String(s.intervalo ?? "—"))} p.p.</b>Com poucas respostas a projeção fica perto da igualdade entre candidatos. Não é uma sondagem oficial.</p>
      </article>
      <article class="dash-card">
        <p class="eyebrow">PARTICIPAÇÃO ANÓNIMA</p>
        <h2>Se a eleição fosse hoje?</h2>
        <p>A resposta é anónima, só conta uma vez e não afeta o voto.</p>
        ${s.respondeu
      ? '<p class="notice"><b>Já respondeu a esta sondagem.</b>Obrigado pela participação.</p>'
      : `<form class="poll-form" data-poll-form>
          ${e.candidatosRonda.map((c) => `<label class="radio-line"><input type="radio" name="poll" value="${c.id}" required> ${escapeHtml(c.nome)}</label>`).join("")}
          <p class="form-message" role="status"></p>
          <button class="button button-primary" type="submit">Enviar resposta</button>
        </form>`}
      </article>
    </div>`;

  // ===== Resultados (o quadro de cada eleição vem de views/resultados.js) =====
  const resultsHead = () => head("INFORMAÇÃO ELEITORAL", "Resultados", "Participação e apuramento das eleições em curso e concluídas.");

  Object.assign((TV.voterView = TV.voterView || {}), { pollHead, modelTag, pollBody, resultsHead });
})();
