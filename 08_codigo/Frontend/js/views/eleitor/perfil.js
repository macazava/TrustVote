/* View · área do eleitor, "Perfil" (abre ao clicar no avatar do topo): página de definições com
   cabeçalho da conta, índice das secções à esquerda e as secções Conta, Participação, Segurança,
   Preferências e Sessão à direita, em linhas rótulo · valor · ação */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml, number, time, date, initials, voterNumber } = TV.format;
  const { stateBadge } = TV.blocks;
  const v = (TV.voterView = TV.voterView || {});

  const seccoes = [
    ["conta", "Conta"],
    ["participacao", "Participação"],
    ["seguranca", "Segurança"],
    ["preferencias", "Preferências"],
    ["sessao", "Sessão"],
  ];

  // ===== Cabeçalho da conta =====
  const identity = (user) => `
    <section class="profile-hero">
      <span class="profile-avatar" aria-hidden="true">${escapeHtml(initials(user.nome))}</span>
      <div class="profile-id">
        <small>CONTA DE ELEITOR</small>
        <h1 tabindex="-1">${escapeHtml(user.nome)}</h1>
        <p>${escapeHtml(user.email)}</p>
      </div>
      <div class="profile-tags">
        <span class="${user.ativo === false ? "is-off" : ""}">${user.ativo === false ? `${TV.icon("circle-alert")} Conta suspensa` : `${TV.icon("circle-check")} Credencial válida`}</span>
        <span>N.º ${escapeHtml(voterNumber(user))}</span>
      </div>
    </section>`;

  // Uma linha de definições: rótulo (e ajuda), valor e ação opcional
  const row = (rotulo, valor, acao = "", ajuda = "") => `
    <div class="settings-row">
      <div class="settings-label"><span>${rotulo}</span>${ajuda ? `<small>${ajuda}</small>` : ""}</div>
      <div class="settings-value">${valor}</div>
      ${acao ? `<div class="settings-action">${acao}</div>` : ""}
    </div>`;

  const section = (id, titulo, texto, conteudo) => `
    <section class="settings-section" id="perfil-${id}" data-section="${id}" aria-labelledby="perfil-${id}-titulo">
      <header>
        <h2 id="perfil-${id}-titulo">${titulo}</h2>
        ${texto ? `<p>${texto}</p>` : ""}
      </header>
      ${conteudo}
    </section>`;

  const copiar = (valor, rotulo) =>
    `<button class="link-button" type="button" data-copy="${escapeHtml(valor)}" aria-label="Copiar ${rotulo}">Copiar</button>`;

  // ===== Conta: dados vindos da instituição =====
  const account = (user) =>
    section(
      "conta",
      "Conta",
      "Os dados vêm dos registos da instituição.",
      `<div class="settings-rows">
        ${row("Nome", escapeHtml(user.nome))}
        ${row("E-mail", escapeHtml(user.email), copiar(user.email, "e-mail"))}
        ${row("Número de estudante", `<span class="mono">${escapeHtml(voterNumber(user))}</span>`, copiar(voterNumber(user), "número"))}
        ${row("Curso", escapeHtml(user.curso || "—"))}
        ${row("Membro desde", user.data_registo ? date(user.data_registo) : "—")}
        ${row("Estado", user.ativo === false ? '<span class="settings-state is-off">Suspensa</span>' : '<span class="settings-state">Ativa</span>')}
      </div>
      <p class="settings-foot">Algum dado errado? <a href="ajuda.html#contactos">Contacte a comissão eleitoral</a>.</p>`
    );

  // ===== Participação: números e uma linha por eleição =====
  function estado(e) {
    if (e.votou) return stateBadge("votou");
    if (e.aberta) return `<button class="button button-small button-primary" type="button" data-vote="${e.id}">Votar agora ${TV.icon("arrow-right")}</button>`;
    return stateBadge(e.estado);
  }
  const numero = (valor, texto) => `<div><b>${number(valor)}</b><small>${texto}</small></div>`;

  const participation = (lista, n) =>
    section(
      "participacao",
      "Participação",
      "",
      `<div class="profile-numbers">
        ${numero(n.habilitado, n.habilitado === 1 ? "eleição disponível" : "eleições disponíveis")}
        ${numero(n.votadas, n.votadas === 1 ? "voto registado" : "votos registados")}
        ${numero(n.porVotar, "por votar")}
      </div>
      ${lista.length
        ? `<ol class="profile-timeline">${lista
          .map(
            (e) => `
            <li class="${e.votou ? "is-done" : e.aberta ? "is-open" : ""}">
              <span class="profile-dot" aria-hidden="true"></span>
              <div><b>${escapeHtml(e.titulo)}</b><small>${escapeHtml(e.periodo)}</small></div>
              ${estado(e)}
            </li>`
          )
          .join("")}</ol>`
        : '<p class="muted">Ainda não tem eleições em que possa votar.</p>'}
      <p class="settings-foot">Os comprovativos de cada voto estão em <button class="link-button" type="button" data-go="receipts">Recibos</button>.</p>`
    );

  // ===== Segurança: palavra-passe (o formulário abre na própria linha) =====
  const security = () =>
    section(
      "seguranca",
      "Segurança",
      "",
      `<div class="settings-rows">
        ${row(
          "Palavra-passe",
          '<span class="settings-dots" aria-label="Definida">••••••••••</span>',
          '<button class="button button-light button-small" type="button" data-password-toggle aria-expanded="false" aria-controls="perfil-password">Alterar</button>',
          "Pelo menos 8 caracteres, com letras e números."
        )}
        <div class="settings-expand" id="perfil-password" hidden>
          <form data-password-form>
            <div class="settings-form-grid">
              <label class="field-label">Palavra-passe atual<input type="password" name="atual" autocomplete="current-password" minlength="8" required></label>
              <span></span>
              <label class="field-label">Nova palavra-passe<input type="password" name="nova" autocomplete="new-password" minlength="8" required></label>
              <label class="field-label">Repetir a nova<input type="password" name="repetir" autocomplete="new-password" minlength="8" required></label>
            </div>
            <p class="form-message" role="status"></p>
            <div class="settings-form-actions">
              <button class="button button-light" type="button" data-password-cancel>Cancelar</button>
              <button class="button button-primary" type="submit">Guardar palavra-passe</button>
            </div>
          </form>
        </div>
        ${row("O seu voto", "Secreto: o voto é guardado sem ligação à sua conta.", '<a class="link-button" href="privacidade.html">Privacidade</a>')}
      </div>`
    );

  // ===== Preferências deste navegador =====
  const toggle = (id, rotulo, ajuda, atributo) => `
    <div class="settings-row">
      <div class="settings-label"><span id="pref-${id}">${rotulo}</span><small>${ajuda}</small></div>
      <div class="settings-action"><button class="switch" type="button" ${atributo} aria-labelledby="pref-${id}"></button></div>
    </div>`;

  const preferences = () =>
    section(
      "preferencias",
      "Preferências",
      "Guardadas só neste navegador.",
      `<div class="settings-rows">
        ${toggle("tema", "Modo escuro", "Sem escolha, segue o sistema.", "data-theme-toggle")}
        ${toggle("texto", "Texto maior", "Aumenta o tamanho de todas as páginas.", 'data-pref="largeText"')}
        ${toggle("contraste", "Contraste elevado", "Cores com mais contraste.", 'data-pref="contrast"')}
      </div>`
    );

  // ===== Sessão: quando começou, quanto falta e o botão para sair =====
  function sessionSection(claims) {
    const ok = claims.iat && claims.exp;
    const pct = ok ? Math.min(100, Math.max(0, ((Date.now() / 1000 - claims.iat) / (claims.exp - claims.iat)) * 100)) : 0;
    return section(
      "sessao",
      "Sessão",
      "",
      `${ok
        ? `<div class="profile-session">
            <div><small>INICIADA</small><b>${time(new Date(claims.iat * 1000).toISOString())}</b></div>
            <div><small>TERMINA</small><b>${time(new Date(claims.exp * 1000).toISOString())}</b></div>
          </div>
          <div class="settings-progress" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></div>`
        : ""}
      <div class="settings-rows">
        ${row("Terminar sessão", "Se a sessão terminar a meio do voto, a opção marcada fica guardada até voltar a entrar.", `<button class="button button-outline button-small" type="button" data-logout-profile>Terminar sessão</button>`)}
      </div>`
    );
  }

  // d = { user, claims, lista, numeros }
  const profilePage = (d) => `
    ${identity(d.user)}
    <div class="settings-layout">
      <nav class="settings-nav" aria-label="Secções do perfil">
        ${seccoes.map(([id, nome], i) => `<a href="#perfil-${id}" data-section-link="${id}"${i === 0 ? ' aria-current="true"' : ""}>${nome}</a>`).join("")}
      </nav>
      <div class="settings-content">
        ${account(d.user)}
        ${participation(d.lista, d.numeros)}
        ${security()}
        ${preferences()}
        ${sessionSection(d.claims)}
      </div>
    </div>`;

  Object.assign(v, { profilePage });
})();
