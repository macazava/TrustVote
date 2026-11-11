/* Controller · área da equipa, separador "Mensagens" (formulário de contacto) */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, ui } = TV;
  const { panel } = TV.panels;
  const team = (TV.team = TV.team || {});

  // Número de mensagens por ler, ao lado do nome do separador
  function badge(lista) {
    const novas = lista.filter((m) => !m.lida).length;
    const b = document.querySelector('.panel-nav [data-view="messages"] [data-unread]');
    if (!b) return;
    b.hidden = !novas;
    b.textContent = novas;
    b.setAttribute("aria-label", `${novas} por ler`);
  }

  team.renderMessages = async function renderMessages() {
    const el = panel("messages");
    const lista = await api.contactos.listar();
    el.innerHTML = TV.teamView.messagesPage(lista);
    badge(lista);

    const marcar = async (id, lida) => {
      try {
        await api.contactos.marcar(id, lida);
        await renderMessages();
      } catch (error) {
        ui.toast(error.message, true);
      }
    };
    el.querySelectorAll("[data-read]").forEach((b) => b.addEventListener("click", () => marcar(b.dataset.read, b.dataset.lida === "true")));
    // Responder também marca como lida
    el.querySelectorAll("[data-reply]").forEach((a) =>
      a.addEventListener("click", () => {
        const m = lista.find((x) => String(x.id) === a.dataset.reply);
        if (m && !m.lida) setTimeout(() => marcar(m.id, true), 300);
      })
    );
  };
})();
