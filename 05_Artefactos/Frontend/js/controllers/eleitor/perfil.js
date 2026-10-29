/* Controller · área do eleitor, separador "Perfil" */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const { session, localReceipts, twoFactor } = TV;
  const { panel } = TV.panels;
  const voter = TV.voter;

  // Volta a desenhar quando as eleições chegam, depois de votar e ao mudar os dois fatores
  voter.renderProfile = function renderProfile() {
    const el = panel("profile");
    const lista = voter.state.lista;
    const numeros = {
      habilitado: lista.length,
      votadas: lista.filter((e) => e.votou).length,
      porVotar: lista.filter((e) => e.aberta && !e.votou).length,
      recibos: localReceipts.all().length,
    };

    el.innerHTML = TV.voterView.profilePage({ user: session.user, claims: session.claims() || {}, lista, numeros });

    el.querySelector("[data-logout-profile]").addEventListener("click", session.logout);
    voter.bindVoteButtons(el);
    twoFactor.wire(el, () => {
      renderProfile();
      voter.renderOverview();
    });
  };
})();
