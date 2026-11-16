/* View · área da equipa, separador "Mensagens": caixa de entrada do formulário de contacto (Ajuda → Contactos).
   Lista à esquerda (pesquisa e filtros), leitura da mensagem escolhida à direita. */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { ui } = TV;
  const { escapeHtml, dateTime, initials, plural } = TV.format;
  const { head } = TV.blocks;


  // "agora", "há 5 min", "há 3 h", "ontem", "12/11"
  function relative(iso) {
    const diff = (Date.now() - Date.parse(iso)) / 6e4;
    if (diff < 1) return "agora";
    if (diff < 60) return `há ${Math.floor(diff)} min`;
    if (diff < 60 * 24 && new Date(iso).getDate() === new Date().getDate()) return `há ${Math.floor(diff / 60)} h`;
    const ontem = new Date(Date.now() - 864e5);
    if (new Date(iso).toDateString() === ontem.toDateString()) return "ontem";
    return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
  }

  // Responder abre o e-mail com o assunto "Re: …" e a mensagem original citada
  const responder = (m) =>
    `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(`Re: [TrustVote] ${m.assunto}`)}&body=${encodeURIComponent(
      `\n\n—\nEm ${dateTime(m.data)}, ${m.nome} escreveu:\n> ${m.mensagem.replace(/\n/g, "\n> ")}`
    )}`;

  const filtros = [
    ["", "Todas"],
    ["nova", "Por ler"],
    ["lida", "Lidas"],
  ];

  const messagesPage = (lista) => {
    const novas = lista.filter((m) => !m.lida).length;
    return `
      ${head("CONTACTOS", "Mensagens", "")}
      ${lista.length
        ? `<div class="inbox" data-inbox>
            <section class="inbox-list dash-card" aria-label="Mensagens recebidas">
              <div class="inbox-list-head">
                <h2>${novas ? plural(novas, "nova", "novas") : "Tudo lido"}<small> · ${plural(lista.length, "mensagem", "mensagens")}</small></h2>
                <label class="cand-search">${TV.icon("search")}<input type="search" placeholder="Pesquisar mensagens" aria-label="Pesquisar mensagens" data-msg-search></label>
                <div class="chip-row" role="group" aria-label="Filtrar mensagens">
                  ${filtros.map(([v, n], i) => `<button class="chip" type="button" data-msg-filter="${v}" aria-pressed="${i === 0}">${n}${v === "nova" && novas ? ` <span class="chip-count">${novas}</span>` : ""}</button>`).join("")}
                </div>
              </div>
              <div class="inbox-items" role="listbox" aria-label="Mensagens" data-msg-list></div>
            </section>
            <section class="inbox-reader dash-card" data-msg-reader aria-live="polite"></section>
          </div>`
        : `<article class="dash-card">${ui.empty("Ainda não chegaram mensagens", "As mensagens do formulário de contacto aparecem aqui.", { label: "Ver o formulário", href: "ajuda.html#contactos" })}</article>`}`;
  };

  const inboxItem = (m, escolhida) => `
    <button class="inbox-item${m.lida ? "" : " is-unread"}" type="button" role="option" data-msg="${m.id}" aria-selected="${m.id === escolhida}">
      <span class="cand-avatar" aria-hidden="true">${escapeHtml(initials(m.nome))}</span>
      <span class="inbox-item-text">
        <span class="inbox-item-top"><b>${escapeHtml(m.nome)}</b><time datetime="${escapeHtml(m.data)}">${escapeHtml(relative(m.data))}</time></span>
        <span class="inbox-item-subject">${m.lida ? "" : '<span class="unread-dot" aria-label="Por ler"></span>'}${escapeHtml(m.assunto)}</span>
        <span class="inbox-item-snippet">${escapeHtml(m.mensagem.slice(0, 140))}</span>
      </span>
    </button>`;

  const inboxItems = (lista, escolhida) =>
    lista.length ? lista.map((m) => inboxItem(m, escolhida)).join("") : `<p class="muted people-empty">${TV.icon("search")} Nenhuma mensagem corresponde.</p>`;

  const reader = (m) =>
    m
      ? `
        <button class="link-button inbox-back" type="button" data-msg-back>${TV.icon("arrow-left")} Voltar às mensagens</button>
        <header class="reader-head">
          <span class="cand-avatar" aria-hidden="true">${escapeHtml(initials(m.nome))}</span>
          <div>
            <b>${escapeHtml(m.nome)}</b>
            <small><a href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a> · ${escapeHtml(dateTime(m.data))}</small>
          </div>
        </header>
        <h3 class="reader-subject">${escapeHtml(m.assunto)}</h3>
        <div class="reader-body">${escapeHtml(m.mensagem)}</div>
        <div class="reader-actions">
          <a class="button button-primary" href="${responder(m)}">Responder por e-mail</a>
          <button class="button button-light" type="button" data-msg-copy="${escapeHtml(m.email)}">Copiar e-mail</button>
          <button class="button button-light" type="button" data-msg-toggle="${m.id}">${m.lida ? "Marcar como por ler" : "Marcar como lida"}</button>
        </div>`
      : `<div class="reader-empty">${TV.icon("inbox")}<p>Escolha uma mensagem para a ler.</p></div>`;

  Object.assign((TV.teamView = TV.teamView || {}), { messagesPage, inboxItems, messageReader: reader });
})();
