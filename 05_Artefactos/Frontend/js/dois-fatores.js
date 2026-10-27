/* Autenticação de dois fatores (usada nas definições do eleitor e da equipa) */
(function () {
  "use strict";

  const { api, ui, format, session } = window.TrustVote;
  const { escapeHtml } = format;

  function qrSvg(text) {
    if (typeof window.qrcode !== "function") return "";
    const qr = window.qrcode(0, "M");
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }

  function card(user) {
    const active = !!(user && user.totp_ativo);
    return `
      <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift" data-totp>
        <p class="eyebrow">PRIVACIDADE E SEGURANÇA</p>
        <h2>Proteção da conta</h2>
        <div class="toggle-row">
          <div>
            <b>Autenticação de dois fatores</b>
            <small>Pede um código da aplicação autenticadora (Google Authenticator, Authy…) em cada início de sessão.</small>
          </div>
          <span class="toggle-state">${active ? "ATIVA" : "DESATIVADA"}</span>
          <button class="switch" type="button" data-totp-start aria-pressed="${active}" aria-label="${active ? "Desativar" : "Ativar"} a autenticação de dois fatores"></button>
        </div>
        <div data-totp-area></div>
        <p class="form-message" data-totp-message role="status"></p>
      </article>`;
  }

  function codeForm(label) {
    return `
      <form class="totp-form" data-totp-form>
        <label class="field-label">
          Código de 6 dígitos
          <input name="codigo" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="000000">
        </label>
        <button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="submit">${label} →</button>
      </form>`;
  }

  function wire(root, onChange) {
    const box = root.querySelector("[data-totp]");
    if (!box) return;
    const area = box.querySelector("[data-totp-area]");
    const message = box.querySelector("[data-totp-message]");
    const active = !!(session.user && session.user.totp_ativo);

    box.querySelector("[data-totp-start]").addEventListener("click", async (event) => {
      ui.message(message, "");
      if (active) {
        area.innerHTML = `<p class="muted">Introduza um código atual da aplicação para confirmar.</p>${codeForm("Desativar")}`;
      } else {
        try {
          const setup = await api.auth.totpConfigurar();
          area.innerHTML = `
            <div class="totp-setup rounded-xl">
              <div class="totp-qr">${qrSvg(setup.uri)}</div>
              <div>
                <p class="muted">1. Leia o código QR com a aplicação autenticadora, ou introduza a chave manualmente:</p>
                <code class="totp-secret">${escapeHtml(setup.segredo)}</code>
                <p class="muted">2. Escreva o código que aparece na aplicação.</p>
                ${codeForm("Ativar")}
              </div>
            </div>`;
        } catch (error) {
          ui.message(message, error.message);
          return;
        }
      }

      area.querySelector("[data-totp-form]").addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const codigo = form.codigo.value.trim();
        try {
          await ui.busy(form.querySelector("button"), "A validar…", () =>
            active ? api.auth.totpDesativar(codigo) : api.auth.totpAtivar(codigo)
          );
          await session.refresh();
          ui.toast(active ? "Autenticação de dois fatores desativada." : "Autenticação de dois fatores ativada.");
          onChange();
        } catch (error) {
          ui.message(message, error.message);
        }
      });
    });
  }

  window.TrustVote.twoFactor = { card, wire };
})();
