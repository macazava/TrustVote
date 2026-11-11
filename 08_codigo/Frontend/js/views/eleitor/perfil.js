/* View · área do eleitor, separador "Perfil": conta, dados pessoais, participação, segurança e privacidade */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml, number, time, date, initials, voterNumber } = TV.format;
  const { stateBadge } = TV.blocks;
  const v = (TV.voterView = TV.voterView || {});

  const card = (conteudo, extra = "") => `<article class="dash-card ${extra}">${conteudo}</article>`;
  const cabeca = (eyebrow, titulo) => `<p class="eyebrow">${eyebrow}</p><h2>${titulo}</h2>`;

  // ===== Cabeçalho da conta: quem é e em que estado está =====
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
        <span>${TV.icon("user-check")} N.º ${escapeHtml(voterNumber(user))}</span>
      </div>
    </section>`;

  // ===== Dados pessoais: ficha só de leitura (os dados vêm da instituição) =====
  const personal = (user) =>
    card(`
      ${cabeca("DADOS PESSOAIS", "Identificação")}
      <dl class="profile-data">
        ${TV.blocks.campo("Nome de utilizador", escapeHtml(user.nome))}
        ${TV.blocks.campo("E-mail", escapeHtml(user.email))}
        ${TV.blocks.campo("Número de estudante", escapeHtml(voterNumber(user)))}
        ${TV.blocks.campo("Curso", escapeHtml(user.curso || "—"))}
        ${TV.blocks.campo("Conta criada a", user.data_registo ? date(user.data_registo) : "—")}
        ${TV.blocks.campo("Estado", user.ativo === false ? "Suspensa" : "Ativa")}
      </dl>
      <p class="profile-note">${TV.icon("info")}<span>Os dados vêm dos registos da instituição. Para corrigir algum, <a href="ajuda.html#contactos">contacte a comissão eleitoral</a>.</span></p>`);

  // ===== Participação: resumo em números e uma linha por eleição =====
  function estado(e) {
    if (e.votou) return stateBadge("votou");
    if (e.aberta) return `<button class="button button-small button-primary" type="button" data-vote="${e.id}">Votar agora ${TV.icon("arrow-right")}</button>`;
    return stateBadge(e.estado);
  }
  const numero = (valor, texto) => `<div><b>${number(valor)}</b><small>${texto}</small></div>`;

  const participation = (lista, n) =>
    card(`
      ${cabeca("PARTICIPAÇÃO", "As minhas eleições")}
      <div class="profile-numbers">
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
        : '<p class="muted">Ainda não tem eleições em que possa votar.</p>'}`);

  // ===== Sessão: quando começou, quando termina e o botão para sair =====
  const sessionCard = (claims) =>
    card(`
      ${cabeca("SESSÃO", "Sessão neste navegador")}
      ${claims.iat && claims.exp
        ? `<div class="profile-session">
            <div><small>INICIADA</small><b>${time(new Date(claims.iat * 1000).toISOString())}</b></div>
            <div><small>TERMINA</small><b>${time(new Date(claims.exp * 1000).toISOString())}</b></div>
          </div>`
        : ""}
      <p class="muted">Se a sessão terminar a meio do voto, a opção marcada fica guardada até voltar a entrar.</p>
      <button class="button button-outline" type="button" data-logout-profile>${TV.icon("log-out")} Terminar sessão</button>`);

  // ===== Privacidade: o que o sistema guarda e o que nunca guarda =====
  const privacyCard = () =>
    card(`
      ${cabeca("PRIVACIDADE", "O que fica guardado")}
      <ul class="profile-list">
        <li class="is-yes">Nome, e-mail, curso e número de estudante</li>
        <li class="is-yes">Se já votou em cada eleição, para impedir votos repetidos</li>
        <li class="is-no">Em quem votou: o voto é separado da sua identidade</li>
      </ul>
      <a class="text-link" href="privacidade.html">Política de privacidade ${TV.icon("arrow-right")}</a>`);

  // d = { user, claims, lista, numeros }
  const profilePage = (d) => `
    ${identity(d.user)}
    <div class="profile-grid grid-cols-1 lg:grid-cols-[1.35fr_1fr]">
      <div>${personal(d.user)}${participation(d.lista, d.numeros)}</div>
      <div>${TV.password.card()}${sessionCard(d.claims)}${privacyCard()}</div>
    </div>`;

  Object.assign(v, { profilePage });
})();
