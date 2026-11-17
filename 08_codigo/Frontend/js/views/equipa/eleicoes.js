/* View · área da equipa, separador "Eleições": lista, formulário e cartões de candidatos, eleitores e rondas */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { ui, elections } = TV;
  const { escapeHtml, percent, dateTime, period } = TV.format;
  const { head, cardHead, okLabel, stateBadge } = TV.blocks;

  const card = (conteudo) => `<article class="dash-card">${conteudo}</article>`;

  // ===== Lista de eleições =====
  // Prazo da eleição: contagem até abrir ou fechar (o controller atualiza [data-countdown] sozinho)
  function deadline(e) {
    const auto = e.encerramento_automatico !== false;
    const chip = `<span class="auto-chip${auto ? "" : " is-off"}" title="${auto ? "Fecha sozinha à hora de fim" : "Encerramento manual pela equipa"}">${auto ? "Fecho automático" : "Fecho manual"}</span>`;
    if (e.estado === "em_curso" && e.ronda && e.ronda.estado === "aberta" && e.fim)
      return `<span class="deadline is-live">Fecha em <b data-countdown="${escapeHtml(e.fim)}">${TV.format.countdown(e.fim)}</b></span>${chip}`;
    if (e.estado === "agendada" && e.inicio)
      return `<span class="deadline">Abre em <b data-countdown="${escapeHtml(e.inicio)}">${TV.format.countdown(e.inicio)}</b></span>${chip}`;
    if (e.estado === "em_curso") return `<span class="deadline">À espera da equipa</span>${chip}`;
    return e.estado === "rascunho" ? chip : "";
  }

  const electionRow = (e, stats) => `
    <div class="election-row${e.estado === "em_curso" ? "" : " is-muted"}">
      <span class="round-mark">${TV.icon("vote")}</span>
      <div>
        ${stateBadge(e.estado)}
        <h3>${escapeHtml(e.titulo)}</h3>
        <small>${escapeHtml(e.periodo)} · ${(e.candidatos || []).filter((c) => c.ativo).length} candidatos</small>
        <div class="election-deadline">${deadline(e)}</div>
      </div>
      <div class="turnout"><b>${stats.data ? percent(stats.data.participacao) : "—"}</b><small>participação</small></div>
      <button class="button button-outline" type="button" data-edit="${e.id}">${e.estado === "rascunho" ? "Configurar" : "Gerir"}</button>
    </div>`;

  const electionList = (detalhes, stats) => `
    ${head("GESTÃO ELEITORAL", "Eleições", "", `<button class="button button-primary" type="button" data-new>Nova eleição ${TV.icon("arrow-right")}</button>`)}
    ${card(`
      ${cardHead("GESTÃO ELEITORAL", "Eleições configuradas")}
      ${detalhes.length
      ? `<div class="election-rows">${detalhes.map((e, i) => electionRow(e, stats[i])).join("")}</div>`
      : ui.empty("Ainda não existem eleições", "Crie a primeira eleição para começar.")}`)}`;

  // ===== Formulário da eleição (criar ou editar): passos à esquerda, resumo ao vivo à direita =====
  const durations = [
    [60, "1 hora"],
    [240, "4 horas"],
    [1440, "1 dia"],
    [4320, "3 dias"],
    [10080, "1 semana"],
  ];

  const step = (n, titulo, texto, conteudo) => `
    <section class="builder-step">
      <header class="builder-step-head">
        <span class="builder-step-num" aria-hidden="true">${String(n).padStart(2, "0")}</span>
        <div><h2>${titulo}</h2><p class="muted">${texto}</p></div>
      </header>
      ${conteudo}
    </section>`;

  function electionForm(e, { editavel, r1, next }) {
    const dis = editavel ? "" : " disabled";
    const auto = !e || e.encerramento_automatico !== false;
    const quorum = e ? Number(e.quorum || 0) : 0;
    return `
      ${head("GESTÃO ELEITORAL", e ? "Editar eleição" : "Criar eleição", "")}
      <form class="election-builder" data-election-form>
        <div class="builder-main dash-card">
          ${step(1, "Identificação", "O nome e a descrição que os eleitores vão ver.", `
            <label class="field-label">Título<input name="titulo" required minlength="3" maxlength="150" placeholder="Ex.: Eleições para a Associação de Estudantes 2027" value="${escapeHtml(e ? e.titulo : "")}"${dis}></label>
            <label class="field-label"><span>Descrição <span class="field-optional">opcional</span></span><textarea name="descricao" rows="3" maxlength="5000" placeholder="O que se elege, para que mandato e quem pode votar."${dis}>${escapeHtml(e ? e.descricao || "" : "")}</textarea></label>`)}

          ${step(2, "Calendário", "Quando abre e quando fecha a votação da 1.ª volta.", `
            <div class="builder-dates">
              <label class="field-label">Abre
                <input type="datetime-local" name="inicio" required value="${r1 ? elections.toLocalInput(r1.data_inicio) : ""}"${dis}>
              </label>
              <span class="builder-dates-arrow" aria-hidden="true">${TV.icon("arrow-right")}</span>
              <label class="field-label">Fecha
                <input type="datetime-local" name="fim" required value="${r1 ? elections.toLocalInput(r1.data_fim) : ""}"${dis}>
              </label>
            </div>
            ${editavel
              ? `<div class="chip-row" role="group" aria-label="Atalhos de calendário">
                  <button class="chip" type="button" data-start-now>Abrir daqui a 5 min</button>
                  ${durations.map(([min, txt]) => `<button class="chip" type="button" data-duration="${min}" aria-pressed="false">${txt}</button>`).join("")}
                </div>`
              : ""}`)}

          ${step(3, "Regras", "Validade do resultado e o que acontece à hora de fecho.", `
            <div class="field-label">
              <span id="quorum-label">Quórum mínimo <span class="field-optional">% dos eleitores habilitados que têm de votar · 0 = sem quórum</span></span>
              <div class="quorum-control">
                <input type="range" min="0" max="100" step="1" value="${quorum}" data-quorum-range aria-labelledby="quorum-label"${dis}>
                <input type="number" name="quorum" min="0" max="100" step="0.01" value="${quorum}" aria-labelledby="quorum-label"${dis}>
              </div>
            </div>
            <div class="toggle-row builder-toggle">
              <div>
                <b>Encerrar automaticamente à hora de fecho</b>
                <small>A votação fecha, os votos são apurados e a eleição fica encerrada sem ninguém ter de carregar num botão. Desligue se quiser decidir uma 2.ª volta depois da 1.ª.</small>
              </div>
              <button class="switch" type="button" role="switch" aria-checked="${auto}" data-auto-close aria-label="Encerrar automaticamente à hora de fecho"${dis}></button>
            </div>
            ${e
              ? `<label class="field-label">Estado
                  <select name="estado">
                    <option value="">${elections.statusLabels[e.estado]} (atual)</option>
                    ${next ? `<option value="${next[0]}">Passar para: ${next[1]}</option>` : ""}
                  </select>
                </label>`
              : ""}`)}

          <p class="form-message" role="status"></p>
          <div class="form-actions">
            ${e && e.estado === "rascunho" ? '<button class="button button-outline" type="button" data-remove>Apagar eleição</button>' : ""}
            <button class="button button-light" type="button" data-back>Cancelar</button>
            <button class="button button-primary" type="submit">${e ? "Guardar alterações" : `Criar eleição ${TV.icon("arrow-right")}`}</button>
          </div>
        </div>

        <aside class="builder-preview" aria-label="Resumo da eleição">
          <div class="dash-card builder-preview-card" data-preview aria-live="off"></div>
        </aside>
      </form>
      ${e ? '<div data-candidates-card></div><div data-voters-card></div><div data-rounds-card></div>' : ""}`;
  }

  // 90 min → "1 h e 30 min"; 3 dias e 2 h → "3 dias e 2 h"
  function durationText(ms) {
    const min = Math.round(ms / 6e4);
    const d = Math.floor(min / 1440);
    const h = Math.floor((min % 1440) / 60);
    const m = min % 60;
    const partes = [d && `${d} ${d === 1 ? "dia" : "dias"}`, h && `${h} h`, m && `${m} min`].filter(Boolean);
    if (!partes.length) return "menos de 1 min";
    return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
  }

  // Resumo ao vivo, redesenhado a cada alteração do formulário (e a cada 30 s)
  function electionPreview({ titulo, estado, inicio, fim, quorum, auto }) {
    const now = Date.now();
    const ini = Date.parse(inicio);
    const end = Date.parse(fim);
    const valido = !Number.isNaN(ini) && !Number.isNaN(end) && end > ini;
    let relogio = '<p class="muted preview-empty">Escolha as datas para ver o calendário.</p>';
    if (valido) {
      const [rotulo, alvo] = now < ini ? ["Abre em", inicio] : now < end ? ["Fecha em", fim] : ["Hora de fecho já passou", null];
      const progresso = Math.min(100, Math.max(0, ((now - ini) / (end - ini)) * 100));
      relogio = `
        <div class="preview-clock">
          <small>${rotulo}</small>
          <b>${alvo ? TV.format.countdown(alvo) : "—"}</b>
        </div>
        <div class="preview-track" aria-hidden="true"><span style="width:${progresso.toFixed(1)}%"></span></div>
        <div class="preview-ends"><span>${escapeHtml(dateTime(inicio))}</span><span>${escapeHtml(dateTime(fim))}</span></div>`;
    }
    return `
      <p class="preview-eyebrow">Resumo</p>
      ${stateBadge(estado)}
      <h3 class="preview-title">${escapeHtml(titulo || "Eleição sem título")}</h3>
      ${relogio}
      <dl class="preview-facts">
        <div><dt>Duração</dt><dd>${valido ? escapeHtml(durationText(end - ini)) : "—"}</dd></div>
        <div><dt>Quórum</dt><dd>${Number(quorum) > 0 ? `${Number(quorum)}%` : "Sem quórum"}</dd></div>
        <div><dt>Fecho</dt><dd>${auto ? "Automático" : "Manual"}</dd></div>
      </dl>
      <p class="preview-note">${auto
        ? "À hora de fecho, a votação termina e os resultados são apurados automaticamente."
        : "Depois da 1.ª volta, a eleição fica em curso até a equipa a encerrar ou criar a 2.ª volta."}</p>`;
  }

  // ===== Cartão dos candidatos da eleição: grelha de cartões + formulário com pré-visualização =====
  const initials = TV.format.initials;


  const candidateTile = (c, i, editavel) => `
    <article class="cand-tile${c.ativo ? "" : " is-off"}" data-cand-tile data-orgao="${escapeHtml(c.orgao)}" data-search="${escapeHtml([c.nome, c.partido, c.curso, c.descricao].filter(Boolean).join(" ").toLowerCase())}">
      <header class="cand-tile-head">
        <span class="cand-avatar" aria-hidden="true">${escapeHtml(initials(c.nome))}</span>
        <div class="cand-tile-id">
          <small class="mono">Opção ${String(i + 1).padStart(2, "0")}</small>
          <h3>${escapeHtml(c.nome)}</h3>
        </div>
        ${editavel
          ? `<button class="switch" type="button" role="switch" aria-checked="${c.ativo}" data-toggle="${c.id}" data-ativo="${c.ativo}" aria-label="${c.ativo ? "Desativar" : "Ativar"} ${escapeHtml(c.nome)}" title="${c.ativo ? "Ativo no boletim" : "Fora do boletim"}"></button>`
          : okLabel(c.ativo ? "ATIVO" : "INATIVO", c.ativo)}
      </header>
      <div class="cand-tags">
        <span class="cand-tag is-orgao">${escapeHtml(elections.orgaoLabels[c.orgao] || c.orgao)}</span>
        ${c.partido ? `<span class="cand-tag">${escapeHtml(c.partido)}</span>` : ""}
        ${c.curso || c.ano ? `<span class="cand-tag is-plain">${escapeHtml([c.curso, c.ano ? `${c.ano}.º ano` : ""].filter(Boolean).join(", "))}</span>` : ""}
      </div>
      <p class="cand-desc${c.descricao ? "" : " is-empty"}">${escapeHtml(c.descricao || "Sem descrição.")}</p>
      ${editavel
        ? `<footer class="cand-tile-actions">
            <button class="link-button" type="button" data-edit-cand="${c.id}">Editar</button>
            <button class="link-button is-danger" type="button" data-remove-cand="${c.id}">Remover</button>
          </footer>`
        : ""}
    </article>`;

  // Pré-visualização do candidato enquanto se escreve (o mesmo aspeto do cartão final)
  const candidatePreview = (c) => `
    <p class="preview-eyebrow">No boletim</p>
    ${candidateTile({ ativo: true, orgao: "direcao", ...c, nome: c.nome || "Nome do candidato" }, 0, false).replace(/<small class="mono">[^<]*<\/small>/, "")}`;

  function candidatesCard(e) {
    const editavel = ["rascunho", "agendada"].includes(e.estado);
    const lista = e.candidatos || [];
    const ativos = lista.filter((c) => c.ativo).length;
    const orgaos = [...new Set(lista.map((c) => c.orgao))];
    const pronto = ativos >= 2;

    const resumo = `
      <div class="cand-summary">
        <span class="cand-count"><b>${ativos}</b> ativo${ativos === 1 ? "" : "s"}${lista.length > ativos ? ` · ${lista.length - ativos} inativo${lista.length - ativos === 1 ? "" : "s"}` : ""}</span>
        ${editavel ? `<span class="cand-ready${pronto ? " is-ok" : ""}">${TV.icon(pronto ? "circle-check" : "circle-alert")} ${pronto ? "Pronto para agendar" : `Faltam ${2 - ativos} para agendar`}</span>` : ""}
      </div>`;

    const filtros = lista.length >= 4
      ? `<div class="cand-filters">
          <label class="cand-search">${TV.icon("search")}<input type="search" placeholder="Pesquisar candidatos" aria-label="Pesquisar candidatos" data-cand-search></label>
          ${orgaos.length > 1
            ? `<div class="chip-row" role="group" aria-label="Filtrar por órgão">
                <button class="chip" type="button" data-cand-filter="" aria-pressed="true">Todos</button>
                ${orgaos.map((o) => `<button class="chip" type="button" data-cand-filter="${escapeHtml(o)}" aria-pressed="false">${escapeHtml(elections.orgaoLabels[o] || o)}</button>`).join("")}
              </div>`
            : ""}
        </div>`
      : "";

    const anos = [1, 2, 3, 4, 5, 6];
    const formulario = `
      <div class="cand-editor" data-cand-editor${lista.length ? " hidden" : ""}>
        <form class="cand-form" data-cand-form>
          <input type="hidden" name="candidato">
          <h3 data-cand-form-title>Novo candidato</h3>
          <label class="field-label">Nome completo<input name="nome" required maxlength="255" placeholder="Ex.: Ana Martins" autocomplete="off"></label>
          <fieldset class="segmented">
            <legend>Órgão</legend>
            ${Object.entries(elections.orgaoLabels).map(([valor, nome], i) => `<label><input type="radio" name="orgao" value="${valor}"${i === 0 ? " checked" : ""}><span>${nome}</span></label>`).join("")}
          </fieldset>
          <div class="cand-form-grid">
            <label class="field-label">Lista <span class="field-optional">opcional</span><input name="partido" maxlength="200" placeholder="Ex.: Lista A"></label>
            <label class="field-label">Curso <span class="field-optional">opcional</span><input name="curso" maxlength="150" placeholder="Ex.: Design de Jogos"></label>
            <label class="field-label">Ano
              <select name="ano"><option value="">—</option>${anos.map((a) => `<option value="${a}">${a}.º ano</option>`).join("")}</select>
            </label>
          </div>
          <label class="field-label"><span>Descrição <span class="field-optional" data-desc-count>0 / 5000</span></span>
            <textarea name="descricao" rows="3" maxlength="5000" placeholder="Propostas principais, numa ou duas frases."></textarea>
          </label>
          <div class="form-actions">
            <button class="button button-light" type="button" data-cancel-cand>Cancelar</button>
            <button class="button button-primary" type="submit" data-cand-submit>Adicionar candidato ${TV.icon("arrow-right")}</button>
          </div>
        </form>
        <aside class="cand-preview" data-cand-preview aria-hidden="true"></aside>
      </div>`;

    return card(`
      ${cardHead("CANDIDATURAS", `Candidatos · ${lista.length}`, editavel && lista.length ? `<button class="button button-primary" type="button" data-cand-new>Adicionar candidato</button>` : "")}
      ${lista.length ? resumo : ""}
      ${editavel ? formulario : ""}
      ${filtros}
      ${lista.length
        ? `<div class="cand-grid" data-cand-grid>${lista.map((c, i) => candidateTile(c, i, editavel)).join("")}</div>
           <p class="muted cand-no-results" data-cand-empty hidden>Nenhum candidato corresponde à pesquisa.</p>`
        : editavel ? "" : '<p class="muted">Esta eleição não tem candidatos.</p>'}
      ${editavel ? "" : '<p class="muted cand-locked">' + TV.icon("lock") + " Os candidatos só podem ser alterados antes de a votação começar.</p>"}`);
  }

  // ===== Cartão do caderno eleitoral (quem pode votar) =====
  function votersCard(habilitados, livres) {
    const acoes = `<div class="row-actions">${habilitados.length ? '<button type="button" data-voter-csv>Exportar CSV</button>' : ""}${livres.length ? `<button class="button button-outline" type="button" data-voter-all>Habilitar todos (${livres.length})</button>` : ""}</div>`;
    return card(`
      ${cardHead("CADERNO ELEITORAL", `Eleitores habilitados · ${habilitados.length}`, acoes)}
      ${habilitados.length
        ? `<div class="table-scroll voter-picker"><table data-table="Pesquisar eleitores habilitados">
            <thead><tr><th>Eleitor</th><th>E-mail</th><th>Habilitado em</th><th></th></tr></thead>
            <tbody>${habilitados
          .map(
            (h) => `
                <tr><td><b>${escapeHtml(h.nome)}</b></td><td>${escapeHtml(h.email)}</td><td data-sort="${escapeHtml(h.data)}">${dateTime(h.data)}</td>
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
            <button class="button button-primary" type="submit">Habilitar ${TV.icon("arrow-right")}</button>
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
      <p class="muted">Uma eleição agendada começa sozinha à hora de início da 1.ª volta. Cada volta fecha sozinha à hora de fim e os votos são logo apurados. ${e.encerramento_automatico !== false
        ? "Com o encerramento automático ligado, a eleição fica encerrada logo a seguir."
        : "Com o encerramento manual, depois da 1.ª volta a equipa decide se cria a 2.ª volta ou encerra a eleição."}</p>
      ${rondas.length
        ? `<div class="table-scroll"><table>
            <thead><tr><th>Ronda</th><th>Período</th><th>Estado</th><th>Ações</th></tr></thead>
            <tbody>${rondas.map((r) => roundRow(e, r)).join("")}</tbody></table></div>`
        : '<p class="muted">Guarde as datas da eleição para criar a 1.ª volta.</p>'}
      ${podeSegunda
        ? `<form class="inline-form" data-second-round>
            <p class="muted">Criar 2.ª volta: escolha exatamente 2 candidatos.</p>
            ${ativos.map((c) => `<label class="radio-line"><input type="checkbox" name="cand" value="${c.id}"> ${escapeHtml(c.nome)}</label>`).join("")}
            <label class="field-label">Início<input type="datetime-local" name="inicio" required></label>
            <label class="field-label">Fim<input type="datetime-local" name="fim" required></label>
            <button class="button button-primary" type="submit">Criar 2.ª volta ${TV.icon("arrow-right")}</button>
          </form>`
        : ""}`);

  Object.assign((TV.teamView = TV.teamView || {}), { electionList, electionForm, electionPreview, candidatesCard, candidatePreview, votersCard, roundsCard });
})();
