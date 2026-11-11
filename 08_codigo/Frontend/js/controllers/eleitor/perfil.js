/* Controller · área do eleitor, separador "Perfil" */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { session, password } = TV;
  const { panel } = TV.panels;
  const voter = TV.voter;

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
  };
})();
