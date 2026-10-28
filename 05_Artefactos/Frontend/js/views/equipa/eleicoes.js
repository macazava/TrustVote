/* View · área da equipa, separador "Eleições": lista, formulário e cartões de candidatos, eleitores e rondas */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { ui, elections } = TV;
  const { escapeHtml, percent, dateTime, period } = TV.format;
  const { head, cardHead, pill, okLabel } = TV.blocks;

  const card = (conteudo) => `<article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift">${conteudo}</article>`;

  // ===== Lista de eleições =====
  const electionRow = (e, stats) => `
    <div class="election-row rounded-2xl transition hover:shadow-soft${e.estado === "em_curso" ? "" : " is-muted"}">
      <span class="round-mark">✓</span>
      <div>
        ${pill(e.estadoLabel, e.estado === "rascunho")}
        <h3>${escapeHtml(e.titulo)}</h3>
        <small>${escapeHtml(e.periodo)} · ${(e.candidatos || []).filter((c) => c.ativo).length} candidatos</small>
      </div>
      <div class="turnout"><b>${stats.data ? percent(stats.data.participacao) : "—"}</b><small>participação</small></div>
      <button class="button rounded-xl button-outline" type="button" data-edit="${e.id}">${e.estado === "rascunho" ? "Configurar" : "Gerir"}</button>
    </div>`;

  const electionList = (detalhes, stats) => `
    ${head("GESTÃO ELEITORAL", "Eleições", "Configure e acompanhe os atos eleitorais da plataforma.", '<button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="button" data-new>Nova eleição →</button>')}
    ${card(`
      ${cardHead("GESTÃO ELEITORAL", "Eleições configuradas")}
      ${detalhes.length
      ? `<div class="election-rows">${detalhes.map((e, i) => electionRow(e, stats[i])).join("")}</div>`
      : ui.empty("Ainda não existem eleições", "Crie a primeira eleição para começar.")}`)}`;

  // ===== Formulário da eleição (criar ou editar) =====
  function electionForm(e, { editavel, r1, next }) {
    const dis = editavel ? "" : " disabled";
    return `
      ${head("GESTÃO ELEITORAL", e ? "Editar eleição" : "Criar eleição", e ? "Atualize a configuração do ato eleitoral." : "Configure um novo ato eleitoral na plataforma.")}
      ${card(`
        ${cardHead("DADOS DA ELEIÇÃO", "Informação principal")}
        <form data-election-form>
          <label class="field-label">Título<input name="titulo" required maxlength="200" value="${escapeHtml(e ? e.titulo : "")}"${dis}></label>
          <label class="field-label">Estado
            <select name="estado"${e ? "" : " disabled"}>
              <option value="">${e ? elections.statusLabels[e.estado] : "Rascunho"} (atual)</option>
              ${next ? `<option value="${next[0]}">${next[1]}</option>` : ""}
            </select>
          </label>
          <label class="field-label">Início<input type="datetime-local" name="inicio" required value="${r1 ? elections.toLocalInput(r1.data_inicio) : ""}"${dis}></label>
          <label class="field-label">Fim<input type="datetime-local" name="fim" required value="${r1 ? elections.toLocalInput(r1.data_fim) : ""}"${dis}></label>
          <label class="field-label">Descrição<textarea name="descricao" rows="3"${dis}>${escapeHtml(e ? e.descricao || "" : "")}</textarea></label>
          <p class="form-message" role="status"></p>
          <div class="form-actions">
            ${e && e.estado === "rascunho" ? '<button class="button rounded-xl button-outline" type="button" data-remove>Apagar eleição</button>' : ""}
            <button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="submit">${e ? "Guardar alterações" : "Guardar eleição"}</button>
            <button class="button rounded-xl button-light" type="button" data-back>Cancelar</button>
          </div>
        </form>`)}
      ${e ? '<div data-candidates-card></div><div data-voters-card></div><div data-rounds-card></div>' : ""}`;
  }

  // ===== Cartão dos candidatos da eleição =====
  const candidateRow = (c, i, rascunho) => `
    <tr>
      <td class="mono">${String(i + 1).padStart(2, "0")}</td>
      <td><b>${escapeHtml(c.nome)}</b><br><small class="muted" style="font-size:11px">${escapeHtml(c.descricao || "")}</small></td>
      <td>${escapeHtml(c.partido || "—")}</td>
      <td>${okLabel(c.ativo ? "VALIDADO" : "INATIVO", c.ativo)}</td>
      <td><div class="row-actions">
        <button type="button" data-toggle="${c.id}" data-ativo="${c.ativo}">${c.ativo ? "Desativar" : "Ativar"}</button>
        ${rascunho ? `<button type="button" data-remove-cand="${c.id}">Remover</button>` : ""}
      </div></td>
    </tr>`;

  function candidatesCard(e) {
    const rascunho = e.estado === "rascunho";
    const lista = e.candidatos || [];
    return card(`
      ${cardHead("CANDIDATURAS", `Candidatos · ${lista.length}`)}
      ${lista.length
        ? `<div class="table-scroll rounded-xl"><table>
            <thead><tr><th>Opção</th><th>Candidato</th><th>Lista</th><th>Estado</th><th>Ações</th></tr></thead>
            <tbody>${lista.map((c, i) => candidateRow(c, i, rascunho)).join("")}</tbody></table></div>`
        : '<p class="muted">Ainda não existem candidatos. São precisos pelo menos 2 para agendar.</p>'}
      ${rascunho
        ? `<form class="inline-form" data-cand-form>
            <label class="field-label">Nome<input name="nome" required maxlength="200"></label>
            <label class="field-label">Lista<input name="partido" maxlength="200"></label>
            <label class="field-label">Descrição<input name="descricao" maxlength="500"></label>
            <button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="submit">Adicionar →</button>
          </form>`
        : '<p class="muted">Só é possível adicionar ou remover candidatos em rascunho.</p>'}`);
  }

  // ===== Cartão do caderno eleitoral (quem pode votar) =====
  function votersCard(habilitados, livres) {
    const acoes = `<div class="row-actions">${habilitados.length ? '<button type="button" data-voter-csv>Exportar CSV</button>' : ""}${livres.length ? `<button class="button rounded-xl button-outline" type="button" data-voter-all>Habilitar todos (${livres.length})</button>` : ""}</div>`;
    return card(`
      ${cardHead("CADERNO ELEITORAL", `Eleitores habilitados · ${habilitados.length}`, acoes)}
      ${habilitados.length
        ? `<div class="table-scroll rounded-xl voter-picker"><table>
            <thead><tr><th>Eleitor</th><th>E-mail</th><th>Habilitado em</th><th></th></tr></thead>
            <tbody>${habilitados
          .map(
            (h) => `
                <tr><td><b>${escapeHtml(h.nome)}</b></td><td>${escapeHtml(h.email)}</td><td>${dateTime(h.data)}</td>
                <td><div class="row-actions"><button type="button" data-unvoter="${h.utilizador_id}">Remover</button></div></td></tr>`
          )
          .join("")}</tbody></table></div>`
        : '<p class="muted">Nenhum eleitor habilitado. É preciso pelo menos 1 para agendar.</p>'}
      ${livres.length
        ? `<form class="inline-form" data-voter-form>
            <label class="field-label">Habilitar eleitor
              <select name="uid" required>
                <option value="">Selecione um eleitor</option>
                ${livres.map((u) => `<option value="${u.id}">${escapeHtml(u.nome)} · ${escapeHtml(u.email)}</option>`).join("")}
              </select>
            </label>
            <button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="submit">Habilitar →</button>
          </form>`
        : ""}`);
  }

  // ===== Cartão das rondas (1.ª e 2.ª volta) =====
  const roundRow = (e, r) => `
    <tr><td>${r.numero === 2 ? "2.ª" : "1.ª"} volta</td><td>${escapeHtml(period(r.data_inicio, r.data_fim))}</td>
    <td>${okLabel(r.estado.toUpperCase(), r.estado === "aberta")}</td>
    <td><div class="row-actions">
      ${e.estado === "em_curso" && r.estado === "aberta" ? `<button type="button" data-round="${r.numero}" data-round-action="encerrar">Encerrar ronda</button>` : ""}
      ${e.estado === "em_curso" && r.estado === "agendada" ? `<button type="button" data-round="${r.numero}" data-round-action="abrir">Abrir ronda</button>` : ""}
    </div></td></tr>`;

  const roundsCard = (e, rondas, podeSegunda, ativos) =>
    card(`
      ${cardHead("CALENDÁRIO", "Rondas")}
      ${rondas.length
        ? `<div class="table-scroll rounded-xl"><table>
            <thead><tr><th>Ronda</th><th>Período</th><th>Estado</th><th>Ações</th></tr></thead>
            <tbody>${rondas.map((r) => roundRow(e, r)).join("")}</tbody></table></div>`
        : '<p class="muted">Guarde as datas da eleição para criar a 1.ª volta.</p>'}
      ${podeSegunda
        ? `<form class="inline-form" data-second-round>
            <p class="muted">Criar 2.ª volta: escolha exatamente 2 candidatos.</p>
            ${ativos.map((c) => `<label class="radio-line rounded-xl transition hover:border-tv-accent"><input type="checkbox" name="cand" value="${c.id}"> ${escapeHtml(c.nome)}</label>`).join("")}
            <label class="field-label">Início<input type="datetime-local" name="inicio" required></label>
            <label class="field-label">Fim<input type="datetime-local" name="fim" required></label>
            <button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="submit">Criar 2.ª volta →</button>
          </form>`
        : ""}`);

  Object.assign((TV.teamView = TV.teamView || {}), { electionList, electionForm, candidatesCard, votersCard, roundsCard });
})();
