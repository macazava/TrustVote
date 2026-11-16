/* Controller · área da equipa, separador "Mensagens" (formulário de contacto): caixa de entrada com leitura ao lado */
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
    const lista = (await api.contactos.listar()).sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
    el.innerHTML = TV.teamView.messagesPage(lista);
    badge(lista);

    const inbox = el.querySelector("[data-inbox]");
    if (!inbox) return;
    const itens = el.querySelector("[data-msg-list]");
    const leitor = el.querySelector("[data-msg-reader]");
    const pesquisa = el.querySelector("[data-msg-search]");
    const chips = [...el.querySelectorAll("[data-msg-filter]")];
    let filtro = "";
    let escolhida = null;

    const visiveis = () => {
      const termo = pesquisa.value.trim().toLowerCase();
      return lista.filter(
        (m) =>
          (!filtro || (filtro === "nova" ? !m.lida : m.lida)) &&
          (!termo || [m.nome, m.email, m.assunto, m.mensagem].join(" ").toLowerCase().includes(termo))
      );
    };

    function desenharLista() {
      itens.innerHTML = TV.teamView.inboxItems(visiveis(), escolhida);
      itens.querySelectorAll("[data-msg]").forEach((b) => b.addEventListener("click", () => abrir(Number(b.dataset.msg))));
    }

    // Grava o estado lida/por ler no servidor e atualiza o ecrã sem recarregar tudo
    async function marcar(m, lida) {
      try {
        await api.contactos.marcar(m.id, lida);
        m.lida = lida;
        badge(lista);
        desenharLista();
        desenharLeitor();
      } catch (error) {
        ui.toast(error.message, true);
      }
    }

    function desenharLeitor() {
      const m = lista.find((x) => x.id === escolhida);
      leitor.innerHTML = TV.teamView.messageReader(m);
      if (!m) return;
      leitor.querySelector("[data-msg-back]").addEventListener("click", () => {
        inbox.classList.remove("is-reading");
        itens.querySelector(`[data-msg="${m.id}"]`)?.focus();
      });
      leitor.querySelector("[data-msg-copy]").addEventListener("click", (event) => ui.copy(event.currentTarget.dataset.msgCopy, "E-mail copiado."));
      leitor.querySelector("[data-msg-toggle]").addEventListener("click", () => marcar(m, !m.lida));
    }

    // Abrir uma mensagem por ler (com clique) marca-a como lida
    function abrir(id, automatico = false) {
      escolhida = id;
      inbox.classList.add("is-reading");
      const m = lista.find((x) => x.id === id);
      desenharLista();
      desenharLeitor();
      if (m && !m.lida && !automatico) marcar(m, true);
    }

    pesquisa.addEventListener("input", desenharLista);
    chips.forEach((chip) =>
      chip.addEventListener("click", () => {
        filtro = chip.dataset.msgFilter;
        chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
        desenharLista();
      })
    );
    // Setas para cima e para baixo percorrem a lista
    itens.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
      const botoes = [...itens.querySelectorAll("[data-msg]")];
      const i = botoes.indexOf(document.activeElement);
      const next = botoes[Math.max(0, Math.min(botoes.length - 1, i + (event.key === "ArrowDown" ? 1 : -1)))];
      if (next) {
        event.preventDefault();
        next.focus();
      }
    });

    desenharLista();
    desenharLeitor();
    // Em ecrãs largos mostra logo a mais recente por ler (ou a mais recente), sem a marcar como lida
    if (window.matchMedia("(min-width: 1101px)").matches) {
      const primeira = lista.find((m) => !m.lida) || lista[0];
      if (primeira) abrir(primeira.id, true);
    }
  };
})();
