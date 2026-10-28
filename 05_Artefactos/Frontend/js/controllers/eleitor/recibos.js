/* Controller · área do eleitor, separadores "Recibos" (verificar e descarregar) e "Definições" */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, ui, session, localReceipts, twoFactor, download } = TV;
  const { panel } = TV.panels;
  const voter = TV.voter;

  // ===== Recibos =====
  voter.loadReceipts = function loadReceipts() {
    const el = panel("receipts");
    const view = TV.voterView;
    el.innerHTML = view.receiptsPage();
    const box = el.querySelector("[data-receipts]");
    ui.mount(box, async () => {
      // Sem a rota no backend, mostra os recibos guardados neste dispositivo
      let recibos;
      let aviso = "";
      try {
        recibos = await api.votacao.recibos();
      } catch (error) {
        if (!error.pending) throw error;
        recibos = localReceipts.all();
        aviso = view.localNotice();
      }
      if (!recibos.length) {
        box.innerHTML = view.noReceipts();
        return;
      }
      box.innerHTML = aviso + recibos.map(view.receiptCard).join("");

      box.querySelectorAll("[data-verify]").forEach((b) =>
        b.addEventListener("click", async () => {
          const r = recibos[b.dataset.verify];
          const pill = box.querySelector(`[data-verify-status="${b.dataset.verify}"]`);
          const checks = box.querySelector(`[data-verify-checks="${b.dataset.verify}"]`);
          try {
            const resposta = await ui.busy(b, "A verificar…", () => api.votacao.verificarRecibo(r.recibo));
            pill.classList.toggle("status-warn", !resposta.valido);
            pill.innerHTML = view.verifyPill(resposta.valido);
            checks.innerHTML = view.verifyChecks(resposta);
          } catch (error) {
            ui.toast(error.message, true);
          }
        })
      );
      box.querySelectorAll("[data-download]").forEach((b) =>
        b.addEventListener("click", () => {
          const r = recibos[b.dataset.download];
          download.ficheiro(`recibo-${r.recibo}.txt`, view.receiptText(r), "text/plain");
        })
      );
    });
  };

  // ===== Definições =====
  // O cartão de acessibilidade já vem no HTML: os cartões novos entram antes dele (guardado na primeira vez)
  let acessibilidade = null;

  voter.renderSettings = function renderSettings() {
    const settings = panel("settings");
    if (!acessibilidade) acessibilidade = settings.querySelector(".dash-card");
    settings.querySelectorAll("[data-settings-extra]").forEach((n) => n.remove());

    settings.querySelector("h1").insertAdjacentHTML("afterend", TV.voterView.settingsIntro());
    acessibilidade.insertAdjacentHTML("beforebegin", TV.voterView.settingsCards(session.user, session.claims() || {}));

    settings.querySelector("[data-logout-settings]").addEventListener("click", session.logout);
    twoFactor.wire(settings, () => {
      renderSettings();
      voter.renderOverview();
    });
  };
})();
