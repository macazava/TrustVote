/* Controller · ativar e desativar a autenticação de dois fatores (definições do eleitor e da equipa) */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, ui, session } = TV;
  const view = TV.twoFactorView;

  // Liga os botões do cartão; onChange volta a desenhar as definições depois de ativar/desativar
  function wire(root, onChange) {
    const box = root.querySelector("[data-totp]");
    if (!box) return;
    const area = box.querySelector("[data-totp-area]");
    const message = box.querySelector("[data-totp-message]");
    const active = !!(session.user && session.user.totp_ativo);

    box.querySelector("[data-totp-start]").addEventListener("click", async () => {
      ui.message(message, "");
      if (active) {
        area.innerHTML = view.disableStep();
      } else {
        try {
          area.innerHTML = view.setupStep(await api.auth.totpConfigurar());
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

  // As definições usam twoFactor.card (desenho) e twoFactor.wire (comportamento)
  TV.twoFactor = { card: view.card, wire };
})();
