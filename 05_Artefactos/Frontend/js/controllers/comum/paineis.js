/* Controller · troca de separador nas áreas do eleitor e da equipa (botões data-view) */
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
    // O separador aberto fica no endereço (ex.: eleitor.html#recibos): atualizar a página,
    // o botão "voltar" do browser e os links partilhados abrem o separador certo.
    const views = [...document.querySelectorAll(".panel-nav [data-view]")].map((b) => b.dataset.view);
    const viewFromHash = () => {
      const view = decodeURIComponent(window.location.hash.slice(1));
      return views.includes(view) ? view : null;
    };

    // Troca de separador com transição suave (View Transitions), se o browser a suportar.
    // Só nos cliques do utilizador: quando o código muda de separador (go()) o separador tem de abrir já,
    // porque a seguir desenha e foca conteúdo dentro dele.
    const smooth = document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    function activateView(view, scroll = true, animate = false) {
      if (!document.querySelector(`[data-panel="${view}"]`)) return;
      // (se o browser não puder animar, a troca acontece na mesma; o aviso de "transição cancelada" é ignorado)
      if (smooth && animate) document.startViewTransition(() => showView(view, "instant")).ready.catch(() => {});
      else showView(view, scroll);
    }

    function showView(view, scroll) {
      const panel = document.querySelector(`[data-panel="${view}"]`);

      if (!panel) return;

      document.querySelectorAll("[data-panel]").forEach((item) => {
        item.classList.toggle("active", item.dataset.panel === view);
      });

      document.querySelectorAll("[data-view]").forEach((button) => {
        const active = button.dataset.view === view;
        button.classList.toggle("active", active);
        if (active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });

      if (scroll) window.scrollTo({ top: 0, behavior: scroll === "instant" ? "instant" : "smooth" });
    }

    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", (event) => {
        const view = button.dataset.view;
        activateView(view, true, event.isTrusted);
        if (viewFromHash() !== view) history.pushState(null, "", `#${view}`);
      });
    });

    // Botões "voltar" / "avançar" do browser
    window.addEventListener("popstate", () => activateView(viewFromHash() || views[0]));

    // Separador pedido no endereço ao abrir a página
    const inicial = viewFromHash();
    if (inicial) activateView(inicial, false);
  });
})();
