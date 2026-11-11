/* Controller · alterar a palavra-passe (perfil do eleitor e configuração da equipa) */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, ui } = TV;

  function wire(root) {
    const form = root.querySelector("[data-password-form]");
    if (!form) return;
    const message = form.querySelector(".form-message");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      ui.message(message, "");
      const { atual, nova, repetir } = form.elements;
      if (nova.value !== repetir.value) return ui.message(message, "As palavras-passe novas não coincidem.");
      if (!/[A-Za-z]/.test(nova.value) || !/\d/.test(nova.value)) return ui.message(message, "A nova palavra-passe tem de ter letras e números.");
      try {
        await ui.busy(form.querySelector("button"), "A alterar…", () => api.auth.alterarPassword(atual.value, nova.value));
        form.reset();
        ui.message(message, "Palavra-passe alterada.", true);
      } catch (error) {
        ui.message(message, error.message);
      }
    });
  }

  // As áreas usam password.card (desenho) e password.wire (comportamento)
  TV.password = { card: TV.passwordView.card, wire };
})();
