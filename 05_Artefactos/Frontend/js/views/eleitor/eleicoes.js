/* View · área do eleitor: cartão de cada eleição, passos do voto, lista de eleições e detalhes */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { ui, elections } = TV;
  const { escapeHtml, countdown, initials } = TV.format;
  const { head } = TV.blocks;

  // Tempo que falta para fechar ou abrir (o número é atualizado a cada 30 s pelo arranque)
  const timeInfo = (e) =>
    e.aberta && e.fim
      ? `Termina em <b data-countdown="${e.fim}">${countdown(e.fim)}</b>`
      : e.inicio && Date.parse(e.inicio) > Date.now()
        ? `Começa em <b data-countdown="${e.inicio}">${countdown(e.inicio)}</b>`
        : escapeHtml(e.periodo);

  const statusLine = (e) =>
    `<span class="status-pill rounded-full status-plain"><i></i> ${e.votou ? "VOTO REGISTADO" : e.aberta ? "VOTAÇÃO ABERTA" : e.estadoLabel}</span>`;

  // Botão principal: votar, ver o recibo ou votação fechada
  function voteAction(e, label = "Iniciar votação →") {
    if (e.votou) return '<button class="button rounded-xl button-outline" type="button" data-go="receipts">Ver recibo →</button>';
    if (!e.aberta) return '<button class="button rounded-xl button-outline" type="button" disabled>Votação fechada</button>';
    return `<button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="button" data-vote="${e.id}">${label}</button>`;
  }

  // Identidade → Votação → Recibo
  function stepsTrack(e) {
    const votou = e && e.votou;
    return `
      <div class="steps-track">
        <span class="is-done"><i>✓</i><b>Identidade</b><small>Confirmada</small></span>
        <hr>
        <span class="${votou ? "is-done" : "is-current"}"><i>${votou ? "✓" : "2"}</i><b>Votação</b><small>${votou ? "Concluída" : "Por concluir"}</small></span>
        <hr>
        <span class="${votou ? "is-done" : ""}"><i>${votou ? "✓" : "3"}</i><b>Recibo</b><small>${votou ? "Emitido" : "Após o voto"}</small></span>
      </div>`;
  }

  function electionCard(e, withDetails) {
    return `
      <article class="election-card rounded-2xl overflow-hidden shadow-soft">
        <div class="election-card-top">${statusLine(e)}<span>${timeInfo(e)}</span></div>
        <div class="election-card-body">
          <span class="round-mark">✓</span>
          <div>
            <small>ELEIÇÃO · ${e.ano}</small>
            <h2>${escapeHtml(e.titulo)}</h2>
            <p>${escapeHtml(e.descricao || `${e.periodo} · ${e.voltaLabel}`)}</p>
          </div>
          <div class="election-card-actions">
            ${withDetails ? `<button class="button rounded-xl button-outline" type="button" data-details="${e.id}">Ver detalhes</button>` : ""}
            ${voteAction(e)}
          </div>
        </div>
        ${withDetails ? "" : stepsTrack(e)}
      </article>`;
  }

  // Uma opção do boletim (com rádio) ou só a apresentação (na revisão)
  function candidateOption(c, i, selectable = true, checked = false) {
    const info = [c.partido, ...elections.candidateInfo(c), c.descricao].filter(Boolean).join(" · ") || "Candidatura registada";
    return `
      <label${selectable ? "" : ' class="is-static"'}>
        <span class="avatar">${escapeHtml(initials(c.nome))}</span>
        <span>
          <small>OPÇÃO ${String(i + 1).padStart(2, "0")}</small>
          <b>${escapeHtml(c.nome)}</b>
          <small>${escapeHtml(info)}</small>
        </span>
        ${selectable ? `<input type="radio" name="candidate" value="${c.id}" required aria-label="${escapeHtml(c.nome)}"${checked ? " checked" : ""}>` : ""}
      </label>`;
  }

  const emptyCard = (titulo, texto) =>
    `<article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">${ui.empty(titulo, texto)}</article>`;

  // ===== Separador "Eleições": ativas em cima, concluídas em baixo =====
  const electionsPage = (ativas, concluidas) => `
    ${head("ELEIÇÕES ACADÉMICAS", "As tuas eleições", "Consulta eleições ativas, agendadas e anteriores.")}
    ${ativas.length ? ativas.map((e) => electionCard(e, true)).join("") : emptyCard("Sem eleições ativas", "Ainda não estás habilitado em nenhuma eleição a decorrer.")}
    <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
      <p class="eyebrow">HISTÓRICO</p>
      <h2>Eleições concluídas</h2>
      ${concluidas.length
      ? `<div class="history-rows">${concluidas
        .map(
          (e) => `
              <div><span class="year">${e.ano}</span><span><b>${escapeHtml(e.titulo)}</b><small>${escapeHtml(e.periodo)}</small></span>
              <span class="ok-label">✓ ${e.votou ? "VOTOU" : "ENCERRADA"}</span></div>`
        )
        .join("")}</div>`
      : '<p class="muted">Ainda não existem eleições concluídas.</p>'}
    </article>`;

  const detailsPage = (e) => `
    ${head(`ELEIÇÃO · ${e.ano}`, escapeHtml(e.titulo), "Informação completa sobre o ato eleitoral.")}
    <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">
      <p class="eyebrow"><i></i> ${e.aberta ? "VOTAÇÃO ABERTA" : e.estadoLabel}</p>
      <h2>Dados da eleição</h2>
      <label class="field-label">Período de votação<input value="${escapeHtml(e.periodo)}" readonly></label>
      <label class="field-label">Ronda<input value="${escapeHtml(e.voltaLabel)}" readonly></label>
      <label class="field-label">Candidaturas<input value="${escapeHtml(e.candidatosRonda.map((c) => c.nome).join(" · ") || "—")}" readonly></label>
      ${e.descricao ? `<p class="notice rounded-xl"><b>Sobre esta eleição</b>${escapeHtml(e.descricao)}</p>` : ""}
      <div class="form-actions" style="justify-content:flex-start">
        ${voteAction(e, "Abrir boletim digital →")}
        <button class="link-button" type="button" data-back>← Voltar às eleições</button>
      </div>
    </article>`;

  Object.assign((TV.voterView = TV.voterView || {}), { electionCard, candidateOption, emptyCard, electionsPage, detailsPage });
})();
