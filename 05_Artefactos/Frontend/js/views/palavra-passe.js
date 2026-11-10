/* View · cartão "Alterar a palavra-passe" (perfil do eleitor e configuração da equipa) */
(function () {
  "use strict";

  const TV = window.TrustVote;

  const card = () => `
    <article class="dash-card rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift" data-password>
      <p class="eyebrow">PALAVRA-PASSE</p>
      <h2>Alterar a palavra-passe</h2>
      <form class="inline-form" data-password-form>
        <label class="field-label">Palavra-passe atual<input type="password" name="atual" autocomplete="current-password" minlength="8" required></label>
        <label class="field-label">Nova palavra-passe<input type="password" name="nova" autocomplete="new-password" minlength="8" required></label>
        <label class="field-label">Repetir a nova<input type="password" name="repetir" autocomplete="new-password" minlength="8" required></label>
        <p class="form-message" role="status"></p>
        <button class="button rounded-xl button-primary shadow-sm hover:shadow-lift" type="submit">Alterar ${TV.icon("arrow-right")}</button>
      </form>
    </article>`;

  TV.passwordView = { card };
})();
