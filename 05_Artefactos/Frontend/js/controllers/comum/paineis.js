/* Controller · troca de separador nas áreas do eleitor e da equipa (botões data-view / data-view-go) */
(function () {
  "use strict";

  const TV = window.TrustVote;

  // Atalhos usados pelos controllers das duas áreas
  TV.panels = {
    // O separador <section data-panel="nome">
    panel: (name) => document.querySelector(`[data-panel="${name}"]`),
    // Abre um separador como se o utilizador tivesse clicado no menu
    go: (view) => document.querySelector(`.panel-nav [data-view="${view}"]`)?.click(),
    // Guarda o resultado ou o erro de um pedido, sem parar os outros
    attempt: (promise) => promise.then((data) => ({ data }), (error) => ({ error })),
  };

  document.addEventListener("DOMContentLoaded", () => {
    function activateView(view) {
      const panel = document.querySelector(`[data-panel="${view}"]`);

      if (!panel) return;

      document.querySelectorAll("[data-panel]").forEach((item) => {
        item.classList.toggle("active", item.dataset.panel === view);
      });

      document.querySelectorAll("[data-view]").forEach((button) => {
        const active = button.dataset.view === view;
        button.classList.toggle("active", active);
        button.setAttribute("aria-current", active ? "page" : "false");
      });

      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => activateView(button.dataset.view));
    });

    document.querySelectorAll("[data-view-go]").forEach((button) => {
      button.addEventListener("click", () => activateView(button.dataset.viewGo));
    });
  });
})();
