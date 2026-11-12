/* View · peças reutilizáveis: estados (a carregar, erro, vazio), avisos, títulos e etiquetas */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml } = TV.format;

  // Ilustração dos estados vazios: uma urna com um boletim a entrar (cores dos papéis, segue o tema)
  const ilustracaoVazia = `
    <svg class="empty-art" viewBox="0 0 160 110" aria-hidden="true">
      <ellipse class="ea-shadow" cx="80" cy="101" rx="54" ry="6"></ellipse>
      <g class="ea-paper">
        <rect x="62" y="8" width="36" height="40" rx="4"></rect>
        <path d="M70 19h20M70 27h12"></path>
        <path class="ea-tick" d="m83 35 4 4 8-9"></path>
      </g>
      <rect class="ea-box" x="32" y="42" width="96" height="54" rx="9"></rect>
      <rect class="ea-slot" x="56" y="40" width="48" height="7" rx="3.5"></rect>
      <path class="ea-line" d="M64 70h32"></path>
      <circle class="ea-dot" cx="128" cy="24" r="3"></circle>
      <circle class="ea-dot" cx="34" cy="30" r="2"></circle>
      <circle class="ea-dot" cx="140" cy="54" r="2"></circle>
    </svg>`;

  // ===== Estados visuais (TrustVote.ui) =====
  let pendente = null; // ação à espera de "Desfazer" (ui.undoable)
  // Ao sair da página, a ação pendente segue já para o servidor
  window.addEventListener("pagehide", () => pendente && pendente.flush());

  const ui = {
    // Skeleton: blocos com a forma do conteúdo enquanto os dados chegam (o texto fica só para leitores de ecrã)
    loading: (label = "A carregar…") => `
      <div class="skeleton-group" role="status" aria-busy="true">
        <span class="sr-only">${escapeHtml(label)}</span>
        <span class="skeleton skeleton-title"></span>
        <span class="skeleton skeleton-card"></span>
        <span class="skeleton skeleton-card skeleton-card-short"></span>
      </div>`,

    // Copia um texto (ex.: código do recibo) e confirma com um aviso
    async copy(text, done = "Código copiado.") {
      try {
        await navigator.clipboard.writeText(text);
        ui.toast(done);
      } catch {
        ui.toast("Não foi possível copiar. Selecione o código e copie à mão.", true);
      }
    },

    error: (error, retry = true) => `
      <div class="state-box">
        <span class="large-icon">${TV.icon("circle-alert")}</span>
        <h2>Não foi possível carregar</h2>
        <p>${escapeHtml((error && error.message) || error)}</p>
        ${retry ? '<button class="button button-outline" type="button" data-retry>Tentar novamente</button>' : ""}
      </div>`,

    // Estado vazio: ilustração, título, texto e (opcional) a ação sugerida
    // action = { label, href } para um link, ou { label, go } para abrir um separador do painel
    empty: (title, text = "", action = null) => `
      <div class="state-box state-empty">
        ${ilustracaoVazia}
        <h2>${escapeHtml(title)}</h2>
        ${text ? `<p>${escapeHtml(text)}</p>` : ""}
        ${
          !action
            ? ""
            : action.href
              ? `<a class="button button-outline" href="${escapeHtml(action.href)}">${escapeHtml(action.label)} ${TV.icon("arrow-right")}</a>`
              : `<button class="button button-outline" type="button" data-go="${escapeHtml(action.go)}">${escapeHtml(action.label)} ${TV.icon("arrow-right")}</button>`
        }
      </div>`,

    message(el, text, ok = false) {
      if (!el) return;
      el.textContent = text || "";
      el.classList.toggle("is-ok", !!ok);
    },

    // Aviso no canto do ecrã; action = { label, onClick, ms } junta um botão (ex.: "Desfazer")
    toast(text, error = false, action = null) {
      let host = document.querySelector(".toast-host");
      if (!host) {
        host = document.createElement("div");
        host.className = "toast-host";
        host.setAttribute("aria-live", "polite");
        document.body.appendChild(host);
      }
      const item = document.createElement("p");
      item.className = `toast${error ? " toast-error" : ""}${action ? " toast-action" : ""}`;
      const span = document.createElement("span");
      span.textContent = text;
      item.appendChild(span);
      if (action) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = action.label;
        button.addEventListener("click", () => {
          action.onClick();
          item.remove();
        });
        item.appendChild(button);
      }
      host.appendChild(item);
      setTimeout(() => item.remove(), action ? action.ms || 6000 : 4200);
    },

    // Ação que se pode desfazer: esconde logo o que foi removido e só fala com o servidor
    // passados 6 segundos (ou antes, se outra ação começar ou a página fechar).
    // { text, hide: [elementos], commit: async () => …, after: () => … }
    undoable({ text, hide = [], commit, after }) {
      if (pendente) pendente.flush();
      hide.forEach((el) => (el.hidden = true));
      let fechado = false;
      const mostrar = () => hide.forEach((el) => (el.hidden = false));
      const flush = async () => {
        if (fechado) return;
        fechado = true;
        clearTimeout(timer);
        pendente = null;
        try {
          await commit();
          if (after) after();
        } catch (error) {
          mostrar();
          ui.toast(error.message, true);
        }
      };
      const timer = setTimeout(flush, 6000);
      pendente = { flush };
      ui.toast(text, false, {
        label: "Desfazer",
        ms: 6000,
        onClick: () => {
          if (fechado) return;
          fechado = true;
          clearTimeout(timer);
          pendente = null;
          mostrar();
          ui.toast("Ação desfeita.");
        },
      });
    },

    // Janela de confirmação (substitui window.confirm): devolve true em "Confirmar", false em "Cancelar" ou Esc
    confirm({ title, text = "", ok = "Confirmar", danger = false }) {
      return new Promise((resolve) => {
        const dialog = document.createElement("dialog");
        dialog.className = "confirm-dialog";
        dialog.innerHTML = `
          <form method="dialog">
            <h2>${escapeHtml(title)}</h2>
            ${text ? `<p class="muted">${escapeHtml(text)}</p>` : ""}
            <div class="form-actions">
              <button class="button button-light" value="cancelar">Cancelar</button>
              <button class="button ${danger ? "button-danger" : "button-primary"}" value="ok">${escapeHtml(ok)}</button>
            </div>
          </form>`;
        document.body.appendChild(dialog);
        dialog.addEventListener("close", () => {
          resolve(dialog.returnValue === "ok");
          dialog.remove();
        });
        dialog.showModal();
        dialog.querySelector('[value="cancelar"]').focus();
      });
    },

    // Bloqueia o botão enquanto o pedido corre
    async busy(button, label, fn) {
      const original = button ? button.innerHTML : "";
      if (button) {
        button.disabled = true;
        button.textContent = label;
      }
      try {
        return await fn();
      } finally {
        if (button) {
          button.disabled = false;
          button.innerHTML = original;
        }
      }
    },

    // Mostra "a carregar", depois o conteúdo ou o erro com botão de repetir
    async mount(el, load) {
      el.innerHTML = ui.loading();
      try {
        await load();
      } catch (error) {
        el.innerHTML = ui.error(error);
        el.querySelector("[data-retry]")?.addEventListener("click", () => ui.mount(el, load));
      }
    },
  };

  // ===== Títulos e etiquetas das áreas do eleitor e da equipa (TrustVote.blocks) =====
  // O primeiro argumento (etiqueta em maiúsculas) já não é desenhado: o título chega. Fica na assinatura
  // para não ter de mudar todas as chamadas.
  const head = (_etiqueta, title, text = "", extra = "") => `
    <div class="page-head">
      <div>
        <h1>${title}</h1>
        ${text ? `<p class="muted">${text}</p>` : ""}
      </div>
      ${extra}
    </div>`;

  const cardHead = (_etiqueta, title, extra = "") =>
    `<div class="card-head"><div><h2>${title}</h2></div>${extra}</div>`;

  const okLabel = (text, ok = true) => `<span class="ok-label${ok ? "" : " is-off"}">${TV.icon(ok ? "check" : "circle-alert")} ${escapeHtml(text)}</span>`;

  // Etiqueta de estado de uma eleição: o mesmo texto, ícone e cor em todo o site (nunca só a cor)
  const estados = {
    em_curso: ["VOTAÇÃO ABERTA", "vote", "open"],
    agendada: ["AGENDADA", "calendar", "scheduled"],
    encerrada: ["ENCERRADA", "lock", "closed"],
    rascunho: ["RASCUNHO", "clipboard-list", "draft"],
    votou: ["VOTO REGISTADO", "circle-check", "open"],
    indisponivel: ["INDISPONÍVEL", "circle-alert", "scheduled"],
  };
  const stateBadge = (estado, label = "") => {
    const [texto, icone, tom] = estados[estado] || [String(estado || "").toUpperCase(), "info", "closed"];
    return `<span class="status-pill tone-${tom}">${TV.icon(icone)} ${escapeHtml(label || texto)}</span>`;
  };

  // Botão "Adicionar ao calendário": descarrega um .ics com o período de votação (controllers/comum/agenda.js)
  // ev = { id, titulo, inicio, fim, descricao }; sem datas não mostra nada
  const calendarButton = (ev, classe = "link-button") =>
    ev && ev.inicio && ev.fim
      ? `<button class="${classe}" type="button" data-ics="${escapeHtml(JSON.stringify(ev))}">${TV.icon("calendar")} Adicionar ao calendário</button>`
      : "";

  TV.ui = ui;
  // Uma linha de ficha de dados (<dl>): rótulo em cima, valor em baixo
  const campo = (rotulo, valor) => `<div><dt>${rotulo}</dt><dd>${valor}</dd></div>`;

  TV.blocks = { head, cardHead, okLabel, stateBadge, calendarButton, campo };
})();
