/* View · peças reutilizáveis: estados (a carregar, erro, vazio), avisos, títulos e etiquetas */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml } = TV.format;

  // ===== Estados visuais (TrustVote.ui) =====
  const ui = {
    loading: (label = "A carregar…") => `<div class="state-box"><span class="spinner"></span><p>${escapeHtml(label)}</p></div>`,

    error: (error, retry = true) => `
      <div class="state-box">
        <span class="large-icon rounded-xl">${error && error.pending ? "…" : "!"}</span>
        <h3>${error && error.pending ? "Funcionalidade por disponibilizar" : "Não foi possível carregar"}</h3>
        <p>${escapeHtml((error && error.message) || error)}</p>
        ${retry ? '<button class="button rounded-xl button-outline" type="button" data-retry>Tentar novamente</button>' : ""}
      </div>`,

    empty: (title, text = "") => `
      <div class="state-box">
        <span class="large-icon rounded-xl">▤</span>
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

  const pill = (text, warn = false) => `<span class="status-pill rounded-full${warn ? " status-warn" : ""}"><i></i> ${escapeHtml(text)}</span>`;

  const okLabel = (text, ok = true) => `<span class="ok-label${ok ? "" : " is-off"}">${ok ? "✓" : "!"} ${escapeHtml(text)}</span>`;

  TV.ui = ui;
  TV.blocks = { head, cardHead, pill, okLabel };
})();
