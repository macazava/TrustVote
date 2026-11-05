/* Controller · área do eleitor, separador "Recibos" (verificar e descarregar) */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { api, ui, localReceipts, download } = TV;
  const { panel } = TV.panels;
  const voter = TV.voter;

  // ===== Recibos =====
  voter.loadReceipts = function loadReceipts() {
    const el = panel("receipts");
    const view = TV.voterView;
    el.innerHTML = view.receiptsPage();
    const box = el.querySelector("[data-receipts]");
    ui.mount(box, async () => {
      // O servidor não liga recibos a eleitores (é isso que mantém o voto secreto):
      // os recibos só existem neste dispositivo, guardados no momento do voto.
      const recibos = localReceipts.all();
      if (!recibos.length) {
        box.innerHTML = view.noReceipts();
        return;
      }
      box.innerHTML = view.localNotice() + recibos.map(view.receiptCard).join("");

      box.querySelectorAll("[data-verify]").forEach((b) =>
        b.addEventListener("click", async () => {
          const r = recibos[b.dataset.verify];
          const pill = box.querySelector(`[data-verify-status="${b.dataset.verify}"]`);
          const checks = box.querySelector(`[data-verify-checks="${b.dataset.verify}"]`);
          try {
            const resposta = await ui.busy(b, "A verificar…", () => api.votacao.verificarRecibo(r.recibo));
            pill.classList.toggle("status-warn", !(resposta.valido && resposta.incluido));
            pill.innerHTML = view.verifyPill(resposta);
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
})();
