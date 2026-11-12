/* View · área do eleitor, separadores "Sondagem IA" e "Resultados" */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml, number, percent, initials } = TV.format;
  const { head } = TV.blocks;

  // ===== Sondagem =====
  const pollHead = () =>
    head("MODELO PREDITIVO · SEM VALOR ELEITORAL", "Sondagem de intenção de voto", "Projeção estatística feita a partir das intenções de voto declaradas, de forma anónima, pelos eleitores.");

  // Uma candidatura na projeção: posição, barra com o intervalo de confiança e a percentagem
  function projectionRow(p, i, margem, listas) {
    const pct = Math.max(0, Math.min(100, p.percentagem || 0));
    const de = Math.max(0, pct - margem);
    const ate = Math.min(100, pct + margem);
    const lista = listas.get(p.candidato_id);
    return `
      <li>
        <span class="poll-pos">${i + 1}</span>
        <span class="avatar" aria-hidden="true">${p.candidato_id ? escapeHtml(initials(p.nome)) : "?"}</span>
        <div class="poll-name">
          <b>${escapeHtml(p.nome)}</b>${lista ? `<small>${escapeHtml(lista)}</small>` : ""}
          <div class="poll-bar" role="img" aria-label="${percent(pct)}, entre ${percent(de)} e ${percent(ate)}">
            ${margem ? `<span style="left:${de}%;width:${ate - de}%"></span>` : ""}<i style="width:${pct}%"></i>
          </div>
        </div>
        <div class="poll-value"><b>${percent(pct)}</b>${margem ? `<small>${percent(de)} – ${percent(ate)}</small>` : ""}</div>
      </li>`;
  }

  const pollFact = (rotulo, valor) => `<div><small>${rotulo}</small><b>${valor}</b></div>`;

  // Opção do formulário (mesmo aspeto das opções do boletim)
  const pollOption = (c, i) => `
    <label>
      <span class="avatar">${escapeHtml(initials(c.nome))}</span>
      <span><small>OPÇÃO ${String(i + 1).padStart(2, "0")}</small><b>${escapeHtml(c.nome)}</b>${c.partido ? `<small>${escapeHtml(c.partido)}</small>` : ""}</span>
      <input type="radio" name="poll" value="${c.id}" required aria-label="${escapeHtml(c.nome)}">
    </label>`;

  const pollBody = (e, s) => {
    const margem = Number(s.intervalo) || 0;
    const listas = new Map((e.candidatosRonda || []).map((c) => [c.id, c.partido]));
    const projecao = [...(s.projecao || [])].sort((a, b) => b.percentagem - a.percentagem);
    const poucas = s.amostra < 30;
    return `
    <div class="poll-layout">
      <article class="dash-card poll-main">
        <header class="poll-main-head">
          <div><h2>${escapeHtml(e.titulo)}</h2></div>
          <span class="poll-live">${TV.icon("chart-column")} Atualizada com cada resposta</span>
        </header>
        <div class="poll-facts">
          ${pollFact("Respostas", number(s.amostra))}
          ${pollFact("Margem de erro (95%)", margem ? `±${number(margem)} p.p.` : "—")}
          ${pollFact("Modelo", escapeHtml(String(s.modelo || "—")))}
        </div>
        ${poucas ? `<p class="poll-warning">${TV.icon("circle-alert")} <span><b>Amostra reduzida.</b> Com menos de 30 respostas a projeção é pouco fiável e tende para a igualdade entre candidaturas.</span></p>` : ""}
        ${projecao.length ? `<ol class="poll-ranking">${projecao.map((p, i) => projectionRow(p, i, margem, listas)).join("")}</ol>` : `<p class="muted">Ainda não há respostas suficientes para projetar.</p>`}
        <p class="poll-legend"><span><i></i> Estimativa</span><span><i class="is-range"></i> Intervalo provável (95%)</span></p>
        <p class="poll-method">${TV.icon("info")} <span>A projeção combina as respostas com uma distribuição inicial igual para todas as candidaturas (modelo bayesiano). Não é uma sondagem oficial nem antecipa o resultado da eleição.</span></p>
      </article>

      <aside class="poll-aside">
        <article class="dash-card">
          <h2>Se a eleição fosse hoje, em quem votaria?</h2>
          ${s.respondeu
        ? `<div class="poll-done"><span>${TV.icon("circle-check")}</span><div><b>Já respondeu a esta sondagem</b><small>Obrigado pela participação. A sua resposta já conta na projeção.</small></div></div>`
        : `<form class="poll-form" data-poll-form>
                <div class="candidate-list">${(e.candidatosRonda || []).map(pollOption).join("")}</div>
                <p class="form-message" role="status"></p>
                <button class="button button-primary" type="submit">Enviar resposta ${TV.icon("arrow-right")}</button>
              </form>`}
        </article>
        <article class="dash-card">
          <h2>Como funciona</h2>
          <ul class="profile-list">
            <li class="is-yes">A resposta é anónima: não fica ligada à sua conta</li>
            <li class="is-yes">Só pode responder uma vez por eleição</li>
            <li class="is-no">Não é um voto e não altera o resultado da eleição</li>
          </ul>
        </article>
      </aside>
    </div>`;
  };

  // ===== Resultados (o quadro de cada eleição vem de views/resultados.js) =====
  const resultsHead = () => head("INFORMAÇÃO ELEITORAL", "Resultados", "Participação e apuramento das eleições em curso e concluídas.");

  Object.assign((TV.voterView = TV.voterView || {}), { pollHead, pollBody, resultsHead });
})();
