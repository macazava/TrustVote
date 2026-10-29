/* View · área do eleitor, separador "Perfil": identidade, participação, segurança e privacidade */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml, number, time, initials, voterNumber } = TV.format;
  const { head } = TV.blocks;
  const v = (TV.voterView = TV.voterView || {});

  const card = (conteudo, extra = "") =>
    `<article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift${extra}">${conteudo}</article>`;

  // ===== Cartão de identidade =====
  const identity = (user) => {
    const desde = user.data_registo ? new Date(user.data_registo).getFullYear() : null;
    return `
      <section class="profile-hero rounded-2xl shadow-soft">
        <span class="profile-avatar" aria-hidden="true">${escapeHtml(initials(user.nome))}</span>
        <div class="profile-id">
          <small>ELEITOR</small>
          <h2>${escapeHtml(user.nome)}</h2>
          <p>${escapeHtml(user.email)}</p>
          <div class="profile-tags">
            <span class="${user.ativo === false ? "is-off" : ""}">${user.ativo === false ? "! Conta suspensa" : "✓ Conta ativa"}</span>
            <span>Nº ${escapeHtml(voterNumber(user))}</span>
            ${desde ? `<span>Registado desde ${desde}</span>` : ""}
          </div>
        </div>
        <button class="button rounded-xl button-light" type="button" data-logout-profile>Terminar sessão</button>
      </section>`;
  };

  // ===== Números da participação =====
  const stat = (valor, texto) => `<div class="profile-stat rounded-2xl"><b>${valor}</b><small>${texto}</small></div>`;

  const stats = ({ habilitado, votadas, porVotar, recibos }) => `
    <div class="profile-stats grid-cols-2 lg:grid-cols-4">
      ${stat(number(habilitado), habilitado === 1 ? "eleição em que estás habilitado" : "eleições em que estás habilitado")}
      ${stat(number(votadas), votadas === 1 ? "voto depositado" : "votos depositados")}
      ${stat(number(porVotar), porVotar === 1 ? "votação aberta por votar" : "votações abertas por votar")}
      ${stat(number(recibos), recibos === 1 ? "recibo neste dispositivo" : "recibos neste dispositivo")}
    </div>`;

  // ===== Participação: uma linha por eleição =====
  function estado(e) {
    if (e.votou) return '<span class="ok-label">✓ VOTASTE</span>';
    if (e.aberta) return `<button class="button button-small rounded-xl button-primary" type="button" data-vote="${e.id}">Votar agora →</button>`;
    if (e.estado === "encerrada") return '<span class="ok-label is-off">ENCERRADA</span>';
    return `<span class="ok-label is-off">${escapeHtml(e.estadoLabel)}</span>`;
  }

  const participation = (lista) =>
    card(`
      <p class="eyebrow">PARTICIPAÇÃO</p>
      <h2>As minhas eleições</h2>
      ${lista.length
        ? `<ol class="profile-timeline">${lista
          .map(
            (e) => `
            <li class="${e.votou ? "is-done" : e.aberta ? "is-open" : ""}">
              <span class="profile-dot" aria-hidden="true"></span>
              <div><b>${escapeHtml(e.titulo)}</b><small>${e.ano} · ${escapeHtml(e.periodo)}</small></div>
              ${estado(e)}
            </li>`
          )
          .join("")}</ol>`
        : '<p class="muted">Ainda não estás habilitado em nenhuma eleição.</p>'}`);

  // ===== Sessão e privacidade =====
  const sessionCard = (claims) =>
    card(`
      <p class="eyebrow">SESSÃO ATUAL</p>
      <h2>Sessão verificada</h2>
      ${claims.iat && claims.exp
        ? `<div class="profile-session">
            <div><small>INICIADA</small><b>${time(new Date(claims.iat * 1000).toISOString())}</b></div>
            <div><small>TERMINA</small><b>${time(new Date(claims.exp * 1000).toISOString())}</b></div>
          </div>`
        : '<p class="muted">Sessão iniciada neste navegador.</p>'}
      <p class="muted">Se a sessão terminar a meio do voto, a opção marcada fica guardada até voltares a entrar.</p>`);

  const privacyCard = () =>
    card(`
      <p class="eyebrow">PRIVACIDADE</p>
      <h2>O que fica guardado</h2>
      <ul class="profile-list">
        <li class="is-yes">Nome, e-mail e número de eleitor</li>
        <li class="is-yes">Se já votaste em cada eleição, para impedir votos repetidos</li>
        <li class="is-no">Em quem votaste: o voto é separado da tua identidade</li>
      </ul>
      <p class="muted">Os dados eleitorais são geridos pela instituição. Para corrigir algum dado, contacta a comissão eleitoral.</p>
      <a class="text-link" href="privacidade.html">Política de privacidade →</a>`);

  // d = { user, claims, lista, numeros }
  const profilePage = (d) => `
    ${head("A MINHA CONTA", "Perfil", "A tua identidade de eleitor, a participação nas eleições e a segurança da conta.")}
    ${identity(d.user)}
    ${stats(d.numeros)}
    <div class="profile-grid grid-cols-1 lg:grid-cols-[1.35fr_1fr]">
      <div>${participation(d.lista)}${privacyCard()}</div>
      <div>${TV.twoFactor.card(d.user)}${sessionCard(d.claims)}</div>
    </div>`;

  Object.assign(v, { profilePage });
})();
