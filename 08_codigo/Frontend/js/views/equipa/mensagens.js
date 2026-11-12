/* View · área da equipa, separador "Mensagens": o que chega pelo formulário de contacto (Ajuda → Contactos) */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { ui } = TV;
  const { escapeHtml, dateTime } = TV.format;
  const { head } = TV.blocks;

  // Responder abre o e-mail com o assunto "Re: …" e a mensagem original citada
  const responder = (m) =>
    `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(`Re: [TrustVote] ${m.assunto}`)}&body=${encodeURIComponent(
      `\n\n—\nEm ${dateTime(m.data)}, ${m.nome} escreveu:\n> ${m.mensagem.replace(/\n/g, "\n> ")}`
    )}`;

  const mensagem = (m) => `
    <article class="message-card${m.lida ? "" : " is-unread"}">
      <header>
        <span class="avatar" aria-hidden="true">${escapeHtml(TV.format.initials(m.nome))}</span>
        <div>
          <b>${escapeHtml(m.nome)}</b>
          <small>${escapeHtml(m.email)} · ${dateTime(m.data)}</small>
        </div>
        ${m.lida ? "" : '<span class="status-pill tone-scheduled">NOVA</span>'}
      </header>
      <p class="message-subject">${escapeHtml(m.assunto)}</p>
      <p class="message-body">${escapeHtml(m.mensagem)}</p>
      <div class="row-actions">
        <a class="button button-primary" href="${responder(m)}" data-reply="${m.id}">${TV.icon("send")} Responder</a>
        <button type="button" data-read="${m.id}" data-lida="${!m.lida}">${m.lida ? "Marcar como por ler" : "Marcar como lida"}</button>
      </div>
    </article>`;

  const messagesPage = (lista) => {
    const novas = lista.filter((m) => !m.lida).length;
    return `
      ${head("CONTACTOS", "Mensagens", "O que os estudantes enviam pelo formulário da página Ajuda → Contactos.")}
      <article class="dash-card">
        <h2>${novas ? `${novas} ${novas === 1 ? "mensagem nova" : "mensagens novas"}` : "Tudo lido"} · ${lista.length} no total</h2>
        ${lista.length
          ? `<div class="message-list">${lista.map(mensagem).join("")}</div>`
          : ui.empty("Ainda não chegaram mensagens", "As mensagens do formulário de contacto aparecem aqui.", { label: "Ver o formulário", href: "ajuda.html#contactos" })}
      </article>`;
  };

  Object.assign((TV.teamView = TV.teamView || {}), { messagesPage });
})();
