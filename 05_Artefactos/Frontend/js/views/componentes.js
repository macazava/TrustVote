/* View · peças reutilizáveis: estados (a carregar, erro, vazio), avisos, títulos e etiquetas */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml } = TV.format;

  // ===== Estados visuais (TrustVote.ui) =====
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
        <h3>Não foi possível carregar</h3>
        <p>${escapeHtml((error && error.message) || error)}</p>
        ${retry ? '<button class="button button-outline" type="button" data-retry>Tentar novamente</button>' : ""}
      </div>`,

    empty: (title, text = "") => `
      <div class="state-box">
        <span class="large-icon">${TV.icon("inbox")}</span>
        <h3>${escapeHtml(title)}</h3>
        ${text ? `<p>${escapeHtml(text)}</p>` : ""}
      </div>`,

    message(el, text, ok = false) {
      if (!el) return;
      el.textContent = text || "";
      el.classList.toggle("is-ok", !!ok);
    },

    toast(text, error = false) {
      let host = document.querySelector(".toast-host");
      if (!host) {
        host = document.createElement("div");
        host.className = "toast-host";
        host.setAttribute("aria-live", "polite");
        document.body.appendChild(host);
      }
      const item = document.createElement("p");
      item.className = `toast${error ? " toast-error" : ""}`;
      item.textContent = text;
      host.appendChild(item);
      setTimeout(() => item.remove(), 4200);
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
  const head = (eyebrow, title, text = "", extra = "") => `
    <div class="page-head">
      <div>
        <p class="eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
        ${text ? `<p class="muted">${text}</p>` : ""}
      </div>
      ${extra}
    </div>`;

  const cardHead = (eyebrow, title, extra = "") =>
    `<div class="card-head"><div><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div>${extra}</div>`;

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

  TV.ui = ui;
  TV.blocks = { head, cardHead, okLabel, stateBadge };
})();
