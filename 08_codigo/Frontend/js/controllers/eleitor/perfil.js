/* Controller · área do eleitor, "Perfil" (abre ao clicar no avatar do topo) */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { session, password } = TV;
  const { panel } = TV.panels;
  const voter = TV.voter;

  let espiao = null;

  // Volta a desenhar quando as eleições chegam e depois de votar
  voter.renderProfile = function renderProfile() {
    const el = panel("profile");
    const lista = voter.state.lista;
    const numeros = {
      habilitado: lista.length,
      votadas: lista.filter((e) => e.votou).length,
      porVotar: lista.filter((e) => e.aberta && !e.votou).length,
    };

    el.innerHTML = TV.voterView.profilePage({ user: session.user, claims: session.claims() || {}, lista, numeros });

    el.querySelector("[data-logout-profile]").addEventListener("click", session.logout);
    voter.bindVoteButtons(el);
    password.wire(el);

    // ===== Palavra-passe: o formulário abre e fecha na própria linha =====
    const abrir = el.querySelector("[data-password-toggle]");
    const caixa = el.querySelector("#perfil-password");
    const form = caixa.querySelector("form");
    const mostrar = (sim) => {
      caixa.hidden = !sim;
      abrir.setAttribute("aria-expanded", String(sim));
      abrir.hidden = sim;
      if (sim) form.atual.focus();
      else {
        form.reset();
        TV.ui.message(form.querySelector(".form-message"), "");
        abrir.focus();
      }
    };
    abrir.addEventListener("click", () => mostrar(true));
    el.querySelector("[data-password-cancel]").addEventListener("click", () => mostrar(false));

    // ===== Preferências (o modo escuro é tratado por TrustVote.prefs para todos os botões) =====
    el.querySelectorAll("[data-pref]").forEach((b) =>
      b.addEventListener("click", () => TV.prefs.save({ [b.dataset.pref]: !TV.prefs.read()[b.dataset.pref] }))
    );
    TV.prefs.apply();

    // ===== Índice das secções: desliza até à secção (sem mudar o endereço) e marca a que está à vista =====
    const links = [...el.querySelectorAll("[data-section-link]")];
    const marcar = (id) => links.forEach((a) => (a.dataset.sectionLink === id ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
    links.forEach((a) =>
      a.addEventListener("click", (event) => {
        // O "#" do endereço é o separador aberto (paineis.js): não pode mudar aqui
        event.preventDefault();
        const destino = el.querySelector(`[data-section="${a.dataset.sectionLink}"]`);
        destino.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
        destino.querySelector("h2").focus({ preventScroll: true });
        marcar(a.dataset.sectionLink);
      })
    );
    el.querySelectorAll(".settings-section h2").forEach((h) => (h.tabIndex = -1));

    espiao?.disconnect();
    espiao = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visivel) marcar(visivel.target.dataset.section);
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );
    el.querySelectorAll("[data-section]").forEach((s) => espiao.observe(s));
  };
})();
