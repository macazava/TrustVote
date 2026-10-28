/* View · autenticação de dois fatores: cartão nas definições, código QR e formulário do código */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { escapeHtml } = TV.format;

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

  const disableStep = () => `<p class="muted">Introduza um código atual da aplicação para confirmar.</p>${codeForm("Desativar")}`;

  const setupStep = (setup) => `
    <div class="totp-setup rounded-xl">
      <div class="totp-qr">${qrSvg(setup.uri)}</div>
      <div>
        <p class="muted">1. Leia o código QR com a aplicação autenticadora, ou introduza a chave manualmente:</p>
        <code class="totp-secret">${escapeHtml(setup.segredo)}</code>
        <p class="muted">2. Escreva o código que aparece na aplicação.</p>
        ${codeForm("Ativar")}
      </div>
    </div>`;

  TV.twoFactorView = { card, disableStep, setupStep };
})();
