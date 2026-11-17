/* View · área da equipa, separadores "Candidatos" e "Eleitores": filtros e tabelas */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { ui, elections } = TV;
  const { escapeHtml, voterNumber } = TV.format;
  const { head } = TV.blocks;

  // ===== Candidatos: separadores por eleição, faixa da eleição escolhida e grelha de cartões =====
  const ativos = (e) => (e.candidatos || []).filter((c) => c.ativo).length;

  // Um separador por eleição: estado (ponto), título e número de candidatos ativos.
  // O mesmo em Candidatos e em Resultados; attr é o atributo data-* que o controller de cada separador lê.
  const electionTab = (e, escolhida, attr = "data-cand-election") => `
    <button class="cand-election-tab" type="button" role="tab" ${attr}="${e.id}" aria-selected="${e.id === escolhida}" title="${escapeHtml(e.titulo)}">
      <span class="cand-election-dot is-${escapeHtml(e.estado)}" aria-hidden="true"></span>
      <span class="cand-election-name">${escapeHtml(e.titulo)}</span>
      <span class="cand-election-count" data-cand-tab-count="${e.id}" aria-label="${ativos(e)} candidatos ativos">${ativos(e)}</span>
    </button>`;

  const candidatesPage = (detalhes, escolhida) => `
    ${head("GESTÃO ELEITORAL", "Candidatos", "")}
    ${detalhes.length
      ? `<div class="cand-election-tabs" role="tablist" aria-label="Eleição">${detalhes.map((e) => electionTab(e, escolhida)).join("")}</div>
         <div data-cand-strip></div>
         <div data-cand-board></div>`
      : `<article class="dash-card">${ui.empty("Ainda não existem eleições", "Os candidatos são adicionados dentro de cada eleição.", { label: "Criar a primeira eleição", go: "elections" })}</article>`}`;

  // Faixa da eleição escolhida: estado, período e atalho para a gestão completa
  const candidatesStrip = (e) => `
    <div class="cand-strip">
      <div>
        ${TV.blocks.stateBadge(e.estado)}
        <h2>${escapeHtml(e.titulo)}</h2>
        <small>${escapeHtml(e.periodo)}</small>
      </div>
      <button class="button button-outline" type="button" data-manage>Abrir eleição ${TV.icon("arrow-right")}</button>
    </div>`;

  // ===== Eleitores: indicadores, pesquisa e filtros, lista de contas e lista oficial de inscritos =====
  const { initials, plural } = TV.format;


  const votersPage = () => `
    ${head("ESTUDANTES", "Eleitores", "")}
    <div class="voter-stats" data-voter-stats>${ui.loading()}</div>
    <article class="dash-card" data-users></article>
    <article class="dash-card" data-enrolled></article>`;

  // Um indicador: número grande, legenda e detalhe opcional
  const stat = (valor, rotulo, detalhe = "", tom = "") => `
    <div class="voter-stat${tom ? ` is-${tom}` : ""}">
      <b>${valor}</b>
      <span>${rotulo}</span>
      ${detalhe ? `<small>${detalhe}</small>` : ""}
    </div>`;

  function voterStats(contas, inscritos) {
    const eleitores = contas.filter((u) => u.perfil !== "administrador");
    const suspensas = contas.filter((u) => !u.ativo).length;
    const com2fa = contas.filter((u) => u.totp_ativo).length;
    const registados = inscritos ? inscritos.estudantes.filter((s) => s.registado).length : 0;
    const total = inscritos ? inscritos.estudantes.length : 0;
    const admins = contas.length - eleitores.length;
    // "Contas de eleitor" exclui a equipa; "Contas ativas" conta todas (eleitores + administradores)
    // A lista oficial de inscritos só entra quando foi importada (sem ela, "0 de 0" não diz nada)
    return `
      ${stat(eleitores.length, "Contas de eleitor", admins ? `+ ${plural(admins, "administrador", "administradores")}` : "Sem administradores")}
      ${stat(`${contas.length - suspensas} <small>de ${contas.length}</small>`, "Contas ativas", suspensas ? `${suspensas} suspensa${suspensas === 1 ? "" : "s"}` : "Nenhuma suspensa", suspensas ? "warn" : "")}
      ${stat(contas.length ? `${Math.round((com2fa / contas.length) * 100)}%` : "—", "Com 2 fatores", plural(com2fa, "conta", "contas"))}
      ${inscritos
        ? total
          ? stat(`${Math.round((registados / total) * 100)}%`, "Inscritos com conta", `${registados} de ${total} na lista oficial`, "brand")
          : stat("—", "Lista oficial", "Por importar (ver abaixo)")
        : ""}`;
  }

  // Barra de ferramentas da lista de contas: pesquisa e filtros
  const filtros = [
    ["", "Todos"],
    ["eleitor", "Eleitores"],
    ["administrador", "Administradores"],
    ["suspenso", "Suspensos"],
  ];

  const usersToolbar = (contas) => {
    const contar = (f) => contas.filter((u) => usersFilter(u, f)).length;
    return `
      <div class="card-head">
        <div><h2>Contas · ${contas.length}</h2></div>
      </div>
      <div class="people-toolbar">
        <label class="cand-search">${TV.icon("search")}<input type="search" placeholder="Pesquisar eleitores…" title="Nome, e-mail, número ou curso" aria-label="Pesquisar contas" data-user-search></label>
        <div class="chip-row" role="group" aria-label="Filtrar contas">
          ${filtros.map(([valor, nome], i) => `<button class="chip" type="button" data-user-filter="${valor}" aria-pressed="${i === 0}">${nome} <span class="chip-count">${contar(valor)}</span></button>`).join("")}
        </div>
      </div>
      <div class="people-list" data-user-list role="list"></div>
      <div class="people-more" data-user-more></div>`;
  };

  function usersFilter(u, filtro) {
    if (filtro === "suspenso") return !u.ativo;
    if (filtro) return u.perfil === filtro;
    return true;
  }

  // Menu de ações de uma conta (exceto a própria)
  const userMenu = (u, eu) =>
    u.id === eu.id
      ? '<span class="person-self">A sua conta</span>'
      : `<details class="row-menu">
          <summary aria-label="Ações para ${escapeHtml(u.nome)}">Ações</summary>
          <div class="row-menu-list" role="menu">
            <button type="button" role="menuitem" data-user="${u.id}" data-patch='${JSON.stringify({ ativo: !u.ativo })}'>${u.ativo ? "Suspender conta" : "Reativar conta"}</button>
            <button type="button" role="menuitem" data-user="${u.id}" data-patch='${JSON.stringify({ perfil: u.perfil === "administrador" ? "eleitor" : "administrador" })}'>${u.perfil === "administrador" ? "Tornar eleitor" : "Tornar administrador"}</button>
            <button type="button" role="menuitem" class="is-danger" data-reset="${u.id}" data-nome="${escapeHtml(u.nome)}">Repor palavra-passe</button>
          </div>
        </details>`;

  const personRow = (u, eu) => `
    <div class="person-row${u.ativo ? "" : " is-off"}" role="listitem">
      <span class="cand-avatar" aria-hidden="true">${escapeHtml(initials(u.nome))}</span>
      <div class="person-main">
        <b title="${escapeHtml(u.nome)}">${escapeHtml(u.nome)}${u.id === eu.id ? ' <span class="person-you">tu</span>' : ""}</b>
        <small title="${escapeHtml(u.email)}">${escapeHtml(u.email)}</small>
      </div>
      <div class="person-meta">
        <span class="mono">${escapeHtml(voterNumber(u))}</span>
        <small title="${escapeHtml(u.curso || "Sem curso")}">${escapeHtml(u.curso || "Sem curso")}</small>
      </div>
      <div class="person-tags">
        <span class="cand-tag${u.perfil === "administrador" ? " is-orgao" : ""}">${u.perfil === "administrador" ? "Administrador" : "Eleitor"}</span>
        ${u.totp_ativo ? `<span class="cand-tag is-plain" title="Autenticação de dois fatores ativa">${TV.icon("shield-check")} 2FA</span>` : ""}
      </div>
      <span class="person-status${u.ativo ? "" : " is-off"}">${u.ativo ? "Ativa" : "Suspensa"}</span>
      <div class="person-actions">${userMenu(u, eu)}</div>
    </div>`;

  const usersRows = (lista, eu) =>
    lista.length ? lista.map((u) => personRow(u, eu)).join("") : `<p class="muted people-empty">${TV.icon("search")} Nenhuma conta corresponde à pesquisa.</p>`;

  // ===== Lista oficial de inscritos (quem pode criar conta quando o registo está restrito) =====
  const enrolledCard = ({ restrito, estudantes }) => {
    const registados = estudantes.filter((s) => s.registado).length;
    const pct = estudantes.length ? (registados / estudantes.length) * 100 : 0;
    return `
      <div class="card-head">
        <div><h2>Estudantes inscritos · ${estudantes.length}</h2></div>
        <span class="enroll-mode${restrito ? " is-closed" : ""}">${TV.icon(restrito ? "lock" : "info")} ${restrito ? "Registo restrito a esta lista" : "Registo aberto a qualquer número"}</span>
      </div>
      ${estudantes.length
        ? `<div class="enroll-progress">
            <div class="enroll-progress-text"><b>${registados}</b> de ${estudantes.length} já criaram conta</div>
            <div class="preview-track" aria-hidden="true"><span style="width:${pct.toFixed(1)}%"></span></div>
          </div>
          <div class="people-toolbar">
            <label class="cand-search">${TV.icon("search")}<input type="search" placeholder="Pesquisar eleitores…" title="Número, nome ou curso" aria-label="Pesquisar inscritos" data-enroll-search></label>
            <div class="chip-row" role="group" aria-label="Filtrar inscritos">
              <button class="chip" type="button" data-enroll-filter="" aria-pressed="true">Todos</button>
              <button class="chip" type="button" data-enroll-filter="sim" aria-pressed="false">Com conta <span class="chip-count">${registados}</span></button>
              <button class="chip" type="button" data-enroll-filter="nao" aria-pressed="false">Por criar <span class="chip-count">${estudantes.length - registados}</span></button>
            </div>
          </div>
          <div class="enroll-grid" data-enroll-list>${estudantes
            .map(
              (s) => `
              <div class="enroll-item" data-enroll-item data-registado="${s.registado ? "sim" : "nao"}" data-search="${escapeHtml([s.num_estudante, s.nome, s.curso].filter(Boolean).join(" ").toLowerCase())}">
                <span class="enroll-dot${s.registado ? " is-ok" : ""}" title="${s.registado ? "Conta criada" : "Conta por criar"}" aria-label="${s.registado ? "Conta criada" : "Conta por criar"}"></span>
                <div>
                  <b class="mono">${escapeHtml(s.num_estudante)}</b>
                  <small title="${escapeHtml([s.nome, s.curso].filter(Boolean).join(" · ") || "Sem nome")}">${escapeHtml([s.nome, s.curso].filter(Boolean).join(" · ") || "Sem nome")}</small>
                </div>
                <button type="button" class="enroll-remove" data-unenroll="${escapeHtml(s.num_estudante)}" aria-label="Remover ${escapeHtml(s.num_estudante)} da lista" title="Remover da lista">${TV.icon("x")}</button>
              </div>`
            )
            .join("")}</div>
          <p class="muted people-empty" data-enroll-empty hidden>${TV.icon("search")} Nenhum inscrito corresponde à pesquisa.</p>`
        : ui.empty("A lista está vazia", restrito ? "Ninguém consegue criar conta enquanto a lista estiver vazia." : "Acrescente estudantes abaixo ou importe um ficheiro CSV.")}
      <form class="enroll-import" data-enroll-form>
        <div class="enroll-import-head">
          <h3>Acrescentar estudantes</h3>
          <p class="muted">Uma linha por estudante: <code>número;nome;curso</code>. O nome e o curso são opcionais.</p>
        </div>
        <label class="enroll-drop" data-enroll-drop>
          <input type="file" accept=".csv,.txt,text/csv,text/plain" data-enroll-file>
          ${TV.icon("download")}
          <span><b>Arraste um ficheiro CSV</b> ou clique para escolher</span>
        </label>
        <label class="field-label">Ou cole aqui
          <textarea name="linhas" rows="4" placeholder="20260001;Ana Silva;Design&#10;20260002;Bruno Costa"></textarea>
        </label>
        <div class="enroll-parse" data-enroll-parse aria-live="polite"></div>
        <p class="form-message" role="status"></p>
        <div class="form-actions">
          <button class="button button-primary" type="submit" data-enroll-submit disabled>Acrescentar ${TV.icon("arrow-right")}</button>
        </div>
      </form>`;
  };

  // Lê as linhas coladas: válidas (número de 4 a 20 letras ou dígitos), repetidas e inválidas
  function parseEnrolled(texto, existentes = new Set()) {
    const validos = [];
    const invalidas = [];
    const vistos = new Set();
    let repetidos = 0;
    texto.split(/\r?\n/).forEach((linha, i) => {
      if (!linha.trim()) return;
      const [num_estudante = "", nome, curso] = linha.split(/[;,\t]/).map((p) => p.trim().replace(/^"|"$/g, ""));
      if (i === 0 && /^n[uú]mero|^num/i.test(num_estudante)) return; // cabeçalho do CSV
      if (!/^[A-Za-z0-9]{4,20}$/.test(num_estudante)) return invalidas.push(i + 1);
      if (vistos.has(num_estudante) || existentes.has(num_estudante)) return repetidos++;
      vistos.add(num_estudante);
      validos.push({ num_estudante, nome: nome || null, curso: curso || null });
    });
    return { validos, invalidas, repetidos };
  }

  const parseSummary = ({ validos, invalidas, repetidos }) =>
    !validos.length && !invalidas.length && !repetidos
      ? ""
      : `<span class="parse-ok">${TV.icon("circle-check")} ${plural(validos.length, "estudante pronto", "estudantes prontos")} a acrescentar</span>
         ${repetidos ? `<span class="parse-skip">${TV.icon("info")} ${plural(repetidos, "repetido ignorado", "repetidos ignorados")}</span>` : ""}
         ${invalidas.length ? `<span class="parse-bad">${TV.icon("circle-alert")} Linha${invalidas.length === 1 ? "" : "s"} ${invalidas.slice(0, 6).join(", ")}${invalidas.length > 6 ? "…" : ""} com número inválido</span>` : ""}`;

  Object.assign((TV.teamView = TV.teamView || {}), { electionTab, candidatesPage, candidatesStrip, votersPage, voterStats, usersToolbar, usersFilter, usersRows, enrolledCard, parseEnrolled, parseSummary });
})();
